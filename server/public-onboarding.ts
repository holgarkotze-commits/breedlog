import crypto from "node:crypto";
import type { Express, Request } from "express";
import { z } from "zod";
import { storage } from "./storage";
import {
  ManagedAuthError, buildManagedAuthProfile, createManagedAuthProvider,
  registerManagedAccount, loginManagedAccount, requestPasswordRecovery,
  resetPasswordWithToken, verifyAccountEmail,
} from "./managed-auth";
import { BREEDLOG_PLANS } from "../shared/commercial";
import { canSendTransactionalEmail } from "./email";

export const PUBLIC_TRIAL_SOURCE = "public_free_trial";
const provider = createManagedAuthProvider(storage);
const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(10).max(128),
});

async function newAccountDevice() {
  // Server-generated ID: never attach an untrusted caller-supplied workspace.
  const deviceId = crypto.randomUUID();
  const deviceUser = await storage.upsertUser({ deviceId, deviceName: "Farmer browser" });
  return { deviceId, deviceUserId: deviceUser.id };
}

async function establishSession(req: Request, accountId: string, userId: string, deviceId: string) {
  await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
  req.session.accountId = accountId;
  req.session.userId = userId;
  req.session.deviceId = deviceId;
  await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
}

// Existing SQL-backed settings retain abuse counters across restarts. This
// supplements the IP limiter; neither login nor recovery trusts a device ID.
async function limitIdentity(identity: string, action: string, limit = 12) {
  const window = Math.floor(Date.now() / (15 * 60_000));
  // system_settings.key is varchar(64). Hash action and identity together:
  // the fixed prefix plus a complete SHA-256 base64url digest is 54 characters.
  const key = `auth-limit:${crypto.createHash("sha256").update(`${action}\0${identity}`).digest("base64url")}`;
  const raw = await storage.getSystemSetting(key);
  const previous = raw ? JSON.parse(raw) : null;
  const count = previous?.window === window ? previous.count + 1 : 1;
  await storage.setSystemSetting(key, JSON.stringify({ window, count }), "Authentication abuse protection");
  if (count > limit) throw new ManagedAuthError("AUTH_RATE_LIMITED", "Too many attempts. Try again in 15 minutes.", 429);
}

async function issueRecoveryCode(accountId: string) {
  return (await provider.issueToken("password_recovery", accountId, 365 * 24 * 60, { purpose: "saved_recovery_code" })).token;
}

export function registerPublicOnboardingRoutes(app: Express) {
  app.use("/api/auth", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const handle = (fn: (req: any, res: any) => Promise<any>) =>
    async (req: any, res: any, next: any) => {
      try { await fn(req, res); }
      catch (err: any) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
        if (err instanceof ManagedAuthError) return res.status(err.status).json({ message: err.message, code: err.code });
        if (err?.code === "23505") return res.status(409).json({ message: "Unable to create this account. Try signing in or account recovery." });
        next(err);
      }
    };

  app.get("/api/auth/me", handle(async (req, res) => {
    if (!req.session.accountId) return res.json({ authenticated: false });
    const profile = await buildManagedAuthProfile(storage, req.session.accountId);
    const workspace = await storage.getAccountWorkspace(profile.accountId);
    res.json({ authenticated: true, profile, trial: workspace?.migrationSource === PUBLIC_TRIAL_SOURCE,
      limits: BREEDLOG_PLANS.free.limits, billingAvailable: false, aiAvailable: false });
  }));

  app.post("/api/auth/register", handle(async (req, res) => {
    if (process.env.BREEDLOG_PUBLIC_TRIAL_SIGNUP === "disabled") {
      return res.status(503).json({ message: "New trial registration is temporarily paused. Existing farmers can still sign in." });
    }
    const body = credentials.extend({ acceptedTerms: z.literal(true), website: z.string().max(0).optional() }).parse(req.body);
    await limitIdentity(body.email, "register", 5);
    if (await storage.getAccountByEmail(body.email)) {
      return res.status(409).json({ message: "Unable to create this account. Try signing in or account recovery." });
    }
    const device = await newAccountDevice();
    const result = await registerManagedAccount(storage, provider, { ...body, ...device });
    await storage.linkAccountWorkspace({
      accountId: result.account.id, workspaceUserId: result.profile.workspaceUserId,
      migrationSource: PUBLIC_TRIAL_SOURCE,
    });
    await storage.createAccountAuditEvent({
      accountId: result.account.id, workspaceUserId: result.profile.workspaceUserId,
      eventType: "account.public_trial_started",
      metadata: { acceptedTerms: true, acceptedPrivacy: true, termsPath: "/legal/terms", privacyPath: "/legal/privacy" },
    });
    const recoveryCode = await issueRecoveryCode(result.account.id);
    await establishSession(req, result.account.id, result.profile.workspaceUserId, device.deviceId);
    res.status(201).json({ authenticated: true, profile: result.profile, recoveryCode,
      trial: true, limits: BREEDLOG_PLANS.free.limits, billingAvailable: false, aiAvailable: false });
  }));

  app.post("/api/auth/login", handle(async (req, res) => {
    const body = credentials.extend({ password: z.string().min(1).max(128), replaceDevice: z.boolean().optional() }).parse(req.body);
    await limitIdentity(body.email, "login");
    // Verify before allocating a device: invalid logins do not create records.
    const account = await storage.getAccountByEmail(body.email);
    if (!account?.passwordHash || !await provider.verifyPassword(body.password, account.passwordHash)) {
      // Equal work for unknown emails limits timing-based enumeration.
      if (!account?.passwordHash) await provider.hashPassword("unknown-account-dummy-password");
      throw new ManagedAuthError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    }
    const currentDevice = req.session.accountId === account.id && req.session.deviceId
      ? await storage.getAccountDeviceByDeviceId(req.session.deviceId) : null;
    const device = currentDevice
      ? { deviceId: currentDevice.deviceId, deviceUserId: currentDevice.deviceUserId }
      : await newAccountDevice();
    const result = await loginManagedAccount(storage, provider, { ...body, ...device });
    await establishSession(req, account.id, result.workspaceUserId, device.deviceId);
    res.json({ authenticated: true, profile: result.profile });
  }));

  app.post("/api/auth/logout", handle(async (req, res) => {
    if (req.session.accountId && req.session.deviceId) {
      await storage.revokeAccountDevice(req.session.accountId, req.session.deviceId);
    }
    await new Promise<void>((resolve, reject) => req.session.destroy((err: any) => err ? reject(err) : resolve()));
    res.clearCookie("connect.sid");
    res.json({ success: true });
  }));

  app.post("/api/auth/recovery/request", handle(async (req, res) => {
    const { email } = z.object({ email: credentials.shape.email }).parse(req.body);
    await limitIdentity(email, "recovery", 3);
    if (!canSendTransactionalEmail()) {
      throw new ManagedAuthError("RECOVERY_EMAIL_UNAVAILABLE", "Email recovery is unavailable. Use the recovery code you saved at sign-up.", 503);
    }
    await requestPasswordRecovery(storage, provider, email);
    // Never return recovery credentials to an unauthenticated caller, even in dev.
    res.json({ requested: true });
  }));

  app.post("/api/auth/recovery/confirm", handle(async (req, res) => {
    const body = z.object({ token: z.string().min(10).max(256), newPassword: credentials.shape.password }).parse(req.body);
    await limitIdentity(crypto.createHash("sha256").update(body.token).digest("hex"), "reset", 5);
    const profile = await resetPasswordWithToken(storage, provider, body.token, body.newPassword);
    res.json({ success: true, recoveryCode: await issueRecoveryCode(profile.accountId) });
  }));

  app.post("/api/auth/verify-email", handle(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10).max(256) }).parse(req.body);
    await verifyAccountEmail(storage, provider, token);
    res.json({ success: true });
  }));

  // Public trials must not call any paid AI provider or simulated checkout.
  app.use(["/api/ai", "/api/billing"], async (req, res, next) => {
    try {
      const workspace = req.session.accountId ? await storage.getAccountWorkspace(req.session.accountId) : null;
      if (workspace?.migrationSource === PUBLIC_TRIAL_SOURCE) {
        return res.status(403).json({ code: "COMING_SOON", message: "AI and paid plans are coming soon. Your free trial remains available." });
      }
      return next();
    } catch (err) { return next(err); }
  });
}
