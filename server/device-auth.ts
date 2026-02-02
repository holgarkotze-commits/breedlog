import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import { storage } from "./storage";

// Device session data stored in express session
declare module "express-session" {
  interface SessionData {
    deviceId?: string;
    userId?: string;
    isAdmin?: boolean;
  }
}

// Token-based auth: store device info on request after validation
declare global {
  namespace Express {
    interface Request {
      deviceAuth?: {
        userId: string;
        deviceId: string;
        token: string;
      };
    }
  }
}

// Generate a secure device token
export function generateDeviceToken(deviceId: string): string {
  const secret = process.env.SESSION_SECRET || "fallback-secret";
  const timestamp = Date.now().toString(36);
  const payload = `${deviceId}:${timestamp}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex").substring(0, 16);
  return `${payload}:${signature}`;
}

// Validate device token
export function validateDeviceToken(token: string): { valid: boolean; deviceId?: string } {
  try {
    const secret = process.env.SESSION_SECRET || "fallback-secret";
    const parts = token.split(":");
    if (parts.length !== 3) return { valid: false };
    
    const [deviceId, timestamp, signature] = parts;
    const payload = `${deviceId}:${timestamp}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex").substring(0, 16);
    
    if (signature !== expectedSig) return { valid: false };
    
    // Token valid for 365 days
    const tokenTime = parseInt(timestamp, 36);
    const maxAge = 365 * 24 * 60 * 60 * 1000;
    if (Date.now() - tokenTime > maxAge) return { valid: false };
    
    return { valid: true, deviceId };
  } catch {
    return { valid: false };
  }
}

// Setup device-based session management
export function setupDeviceAuth(app: Express) {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  }));
  
  // Token-based auth middleware - runs before routes
  // Checks X-Device-Token header for token auth (more reliable than cookies on mobile)
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers["x-device-token"] as string;
    
    if (token) {
      const validation = validateDeviceToken(token);
      if (validation.valid && validation.deviceId) {
        // Look up user by deviceId
        const user = await storage.getUserByDeviceId(validation.deviceId);
        if (user) {
          req.deviceAuth = {
            userId: user.id,
            deviceId: validation.deviceId,
            token
          };
          // Also sync to session for backwards compatibility
          req.session.deviceId = validation.deviceId;
          req.session.userId = user.id;
        }
      }
    }
    next();
  });
}

// Get userId from token auth first, then session
export function getUserId(req: Request): string | null {
  return req.deviceAuth?.userId || req.session?.userId || null;
}

// Get deviceId from token auth first, then session
export function getDeviceId(req: Request): string | null {
  return req.deviceAuth?.deviceId || req.session?.deviceId || null;
}

// Middleware to require device authentication
export const requireDeviceAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = getUserId(req);
  const deviceId = getDeviceId(req);
  
  if (!userId || !deviceId) {
    return res.status(401).json({ message: "Device not registered" });
  }
  next();
};

// Middleware to require admin access (via ADMIN_PIN)
export const requireAdminPin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const adminPin = process.env.ADMIN_PIN;
  
  // Check Authorization header first (more reliable than session cookies)
  if (authHeader && authHeader.startsWith("AdminPin ")) {
    const pin = authHeader.substring(9);
    if (pin === adminPin) {
      console.log("[Admin Middleware] Authorized via header");
      return next();
    }
  }
  
  // Fall back to session check
  console.log("[Admin Middleware] Session ID:", req.sessionID, "isAdmin:", req.session?.isAdmin);
  if (req.session?.isAdmin) {
    return next();
  }
  
  return res.status(403).json({ message: "Admin access required" });
};

// Register device auth routes
export function registerDeviceAuthRoutes(app: Express) {
  // Diagnostics endpoint for support/debugging
  app.get("/api/device/status", async (req, res) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache"
    });
    
    const token = req.headers["x-device-token"] as string;
    const tokenValidation = token ? validateDeviceToken(token) : { valid: false };
    const userId = getUserId(req);
    const deviceId = getDeviceId(req);
    
    res.json({
      hasTokenOnRequest: !!token,
      tokenValid: tokenValidation.valid,
      deviceId: deviceId || tokenValidation.deviceId || null,
      isRegistered: !!userId,
      userId: userId || null,
      serverTime: new Date().toISOString(),
      env: process.env.NODE_ENV || "development",
      dbHost: process.env.PGHOST?.substring(0, 20) + "..." || "unknown"
    });
  });

  // Register a new device (called on first launch)
  app.post("/api/device/register", async (req, res) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache"
    });
    
    try {
      const { deviceId, deviceName } = req.body;
      
      if (!deviceId || typeof deviceId !== "string" || deviceId.length < 32) {
        return res.status(400).json({ message: "Invalid device ID" });
      }
      
      // Check if device already exists
      let user = await storage.getUserByDeviceId(deviceId);
      
      if (!user) {
        try {
          // Create new user for this device
          user = await storage.upsertUser({
            deviceId,
            deviceName: deviceName || "Unknown Device",
          });
        } catch (err: any) {
          // Handle race condition - device was registered by concurrent request
          if (err.code === '23505' || err.message?.includes('unique constraint')) {
            user = await storage.getUserByDeviceId(deviceId);
            if (!user) {
              throw new Error("Device registration failed after retry");
            }
          } else {
            throw err;
          }
        }
      } else {
        // Update last seen
        await storage.updateUserLastSeen(user.id);
      }
      
      // Generate device token for localStorage-based auth
      const token = generateDeviceToken(deviceId);
      
      // Set session (backup auth method)
      req.session.deviceId = deviceId;
      req.session.userId = user.id;
      
      res.json({ 
        success: true, 
        userId: user.id,
        deviceId: user.deviceId,
        token  // Client should store this in localStorage
      });
    } catch (error) {
      console.error("Device registration error:", error);
      res.status(500).json({ message: "Failed to register device" });
    }
  });
  
  // Get current device/user info
  app.get("/api/device/info", (req, res) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache"
    });
    
    const userId = getUserId(req);
    const deviceId = getDeviceId(req);
    
    if (!userId || !deviceId) {
      return res.status(401).json({ registered: false });
    }
    
    res.json({
      registered: true,
      userId,
      deviceId
    });
  });
  
  // Admin PIN authentication
  app.post("/api/admin/login", (req, res) => {
    const { pin } = req.body;
    const adminPin = process.env.ADMIN_PIN;
    
    if (!adminPin) {
      return res.status(500).json({ message: "Admin PIN not configured" });
    }
    
    if (pin === adminPin) {
      req.session.isAdmin = true;
      req.session.save((err) => {
        if (err) {
          console.error("[Admin Login] Session save error:", err);
          return res.status(500).json({ message: "Session error" });
        }
        console.log("[Admin Login] Session saved, isAdmin:", req.session.isAdmin);
        res.json({ success: true });
      });
    } else {
      res.status(401).json({ message: "Invalid PIN" });
    }
  });
  
  // Check admin status
  app.get("/api/admin/check", (req, res) => {
    res.json({ isAdmin: !!req.session?.isAdmin });
  });
  
  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    req.session.isAdmin = false;
    res.json({ success: true });
  });
  
  // Clear device session (logout)
  app.post("/api/device/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });
}
