import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Device session data stored in express session
declare module "express-session" {
  interface SessionData {
    deviceId?: string;
    userId?: string;
    isAdmin?: boolean;
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
}

// Get userId from session (device-based)
export function getUserId(req: Request): string | null {
  return req.session?.userId || null;
}

// Get deviceId from session
export function getDeviceId(req: Request): string | null {
  return req.session?.deviceId || null;
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
  if (!req.session?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Register device auth routes
export function registerDeviceAuthRoutes(app: Express) {
  // Register a new device (called on first launch)
  app.post("/api/device/register", async (req, res) => {
    try {
      const { deviceId, deviceName } = req.body;
      
      if (!deviceId || typeof deviceId !== "string" || deviceId.length < 32) {
        return res.status(400).json({ message: "Invalid device ID" });
      }
      
      // Check if device already exists
      let user = await storage.getUserByDeviceId(deviceId);
      
      if (!user) {
        // Create new user for this device
        user = await storage.upsertUser({
          deviceId,
          deviceName: deviceName || "Unknown Device",
        });
      } else {
        // Update last seen
        await storage.updateUserLastSeen(user.id);
      }
      
      // Set session
      req.session.deviceId = deviceId;
      req.session.userId = user.id;
      
      res.json({ 
        success: true, 
        userId: user.id,
        deviceId: user.deviceId
      });
    } catch (error) {
      console.error("Device registration error:", error);
      res.status(500).json({ message: "Failed to register device" });
    }
  });
  
  // Get current device/user info
  app.get("/api/device/info", (req, res) => {
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
      res.json({ success: true });
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
