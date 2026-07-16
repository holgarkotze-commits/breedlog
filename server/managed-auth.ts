import crypto from "crypto";
import type { IStorage } from "./storage";
import { getEntitlementState } from "./commercial";
import { canSendTransactionalEmail, sendManagedAuthTokenEmail } from "./email";

const PASSWORD_ITERATIONS = 210000;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_DIGEST = "sha256";

type TokenKind = "email_verification" | "password_recovery";

export class ManagedAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ManagedAuthError";
  }
}

export type ManagedAuthProfile = {
  accountId: string;
  email: string;
  emailVerified: boolean;
  workspaceUserId: string;
  devices: Array<{
    deviceId: string;
    deviceName: string | null;
    platform: string | null;
    status: string;
    lastSeenAt: string | null;
    revokedAt: string | null;
  }>;
};

export type ManagedAuthProvider = {
  providerName: string;
  googleEnabled: boolean;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  issueToken(kind: TokenKind, accountId: string, ttlMinutes: number, metadata?: Record<string, unknown>): Promise<{ token: string; expiresAt: Date }>;
  consumeToken(kind: TokenKind, token: string): Promise<{ accountId: string; metadata: Record<string, unknown> | null }>;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function enforcePasswordStrength(password: string) {
  if (password.length < 10) {
    throw new ManagedAuthError("WEAK_PASSWORD", "Password must be at least 10 characters long.");
  }
}

function hashTokenValue(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function serializePasswordHash(salt: Buffer, derived: Buffer): string {
  return `pbkdf2$${PASSWORD_ITERATIONS}$${PASSWORD_DIGEST}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function deserializePasswordHash(hash: string): { iterations: number; digest: string; salt: Buffer; derived: Buffer } {
  const [scheme, iterationsRaw, digest, saltRaw, derivedRaw] = hash.split("$");
  if (scheme !== "pbkdf2" || !iterationsRaw || !digest || !saltRaw || !derivedRaw) {
    throw new ManagedAuthError("INVALID_PASSWORD_HASH", "Stored password hash is invalid.", 500);
  }
  return {
    iterations: Number(iterationsRaw),
    digest,
    salt: Buffer.from(saltRaw, "base64"),
    derived: Buffer.from(derivedRaw, "base64"),
  };
}

export function createManagedAuthProvider(storage: IStorage): ManagedAuthProvider {
  return {
    providerName: "deterministic-local",
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    async hashPassword(password: string): Promise<string> {
      enforcePasswordStrength(password);
      const salt = crypto.randomBytes(16);
      const derived = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_BYTES, PASSWORD_DIGEST);
      return serializePasswordHash(salt, derived);
    },
    async verifyPassword(password: string, hash: string): Promise<boolean> {
      const parsed = deserializePasswordHash(hash);
      const derived = crypto.pbkdf2Sync(password, parsed.salt, parsed.iterations, parsed.derived.length, parsed.digest);
      return crypto.timingSafeEqual(derived, parsed.derived);
    },
    async issueToken(kind: TokenKind, accountId: string, ttlMinutes: number, metadata?: Record<string, unknown>) {
      const token = `${kind}_${crypto.randomBytes(24).toString("base64url")}`;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      await storage.createAccountToken({
        accountId,
        tokenType: kind,
        tokenHash: hashTokenValue(token),
        expiresAt,
        metadata: metadata ?? null,
      });
      return { token, expiresAt };
    },
    async consumeToken(kind: TokenKind, token: string) {
      const stored = await storage.getAccountToken(kind, hashTokenValue(token));
      if (!stored || stored.consumedAt || stored.expiresAt.getTime() < Date.now()) {
        throw new ManagedAuthError("INVALID_TOKEN", "The supplied authentication token is invalid or expired.", 400);
      }
      await storage.consumeAccountToken(stored.id);
      return { accountId: stored.accountId, metadata: (stored.metadata as Record<string, unknown> | null) ?? null };
    },
  };
}

async function assertDeviceLimit(storage: IStorage, accountId: string, currentDeviceId: string) {
  const workspace = await storage.getAccountWorkspace(accountId);
  const entitlementScopeId = workspace?.workspaceUserId ?? accountId;
  const entitlement = await getEntitlementState(storage, entitlementScopeId);
  const devices = (await storage.getAccountDevices(accountId)).filter((device) => device.status === "active");
  const alreadyRegistered = devices.some((device) => device.deviceId === currentDeviceId);
  const limit = entitlement.planId === "premium" ? 3 : 1;
  if (!alreadyRegistered && devices.length >= limit) {
    throw new ManagedAuthError(
      "DEVICE_LIMIT_REACHED",
      entitlement.planId === "premium"
        ? "Premium accounts can have at most three registered devices."
        : "Free accounts can have one registered active device.",
      403,
    );
  }
}

export async function buildManagedAuthProfile(storage: IStorage, accountId: string): Promise<ManagedAuthProfile> {
  const account = await storage.getAccountById(accountId);
  const workspace = await storage.getAccountWorkspace(accountId);
  if (!account || !workspace) {
    throw new ManagedAuthError("ACCOUNT_NOT_READY", "Managed account is missing its workspace mapping.", 500);
  }
  const devices = await storage.getAccountDevices(accountId);
  return {
    accountId: account.id,
    email: account.email,
    emailVerified: account.emailVerified,
    workspaceUserId: workspace.workspaceUserId,
    devices: devices.map((device) => ({
      deviceId: device.deviceId,
      deviceName: device.deviceName ?? null,
      platform: device.platform ?? null,
      status: device.status,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      revokedAt: device.revokedAt?.toISOString() ?? null,
    })),
  };
}

export async function registerManagedAccount(
  storage: IStorage,
  provider: ManagedAuthProvider,
  params: {
    email: string;
    password: string;
    deviceId: string;
    deviceUserId: string;
    deviceName?: string | null;
    platform?: string | null;
  },
) {
  const email = normalizeEmail(params.email);
  const existing = await storage.getAccountByEmail(email);
  if (existing) {
    throw new ManagedAuthError("EMAIL_IN_USE", "An account already exists for that email address.", 409);
  }
  const deviceUser = await storage.getUserById(params.deviceUserId);
  if (!deviceUser) {
    throw new ManagedAuthError("DEVICE_USER_NOT_FOUND", "The current device workspace could not be resolved.", 404);
  }
  const workspaceUserId = deviceUser.sharedUserId || deviceUser.id;

  const account = await storage.createAccount({
    email,
    passwordHash: await provider.hashPassword(params.password),
    authProvider: "local",
    emailVerified: false,
  });

  await storage.linkAccountWorkspace({
    accountId: account.id,
    workspaceUserId,
    legacyDeviceUserId: params.deviceUserId,
    migrationSource: "legacy_device_register",
  });
  await storage.setSharedUserId(params.deviceUserId, workspaceUserId);
  await storage.upsertAccountDevice({
    accountId: account.id,
    workspaceUserId,
    deviceUserId: params.deviceUserId,
    deviceId: params.deviceId,
    deviceName: params.deviceName ?? null,
    platform: params.platform ?? null,
    authProvider: "local",
  });
  const verification = await provider.issueToken("email_verification", account.id, 60 * 24, {
    email,
  });
  if (process.env.NODE_ENV === "production" && canSendTransactionalEmail()) {
    await sendManagedAuthTokenEmail({
      email,
      kind: "email_verification",
      token: verification.token,
      expiresAt: verification.expiresAt,
    });
  }
  await storage.createAccountAuditEvent({
    accountId: account.id,
    workspaceUserId,
    deviceId: params.deviceId,
    eventType: "account.registered",
    metadata: { email },
  });
  return {
    account,
    verification,
    profile: await buildManagedAuthProfile(storage, account.id),
  };
}

export async function loginManagedAccount(
  storage: IStorage,
  provider: ManagedAuthProvider,
  params: {
    email: string;
    password: string;
    deviceId: string;
    deviceUserId: string;
    deviceName?: string | null;
    platform?: string | null;
  },
) {
  const email = normalizeEmail(params.email);
  const account = await storage.getAccountByEmail(email);
  if (!account || !account.passwordHash) {
    throw new ManagedAuthError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
  }
  const ok = await provider.verifyPassword(params.password, account.passwordHash);
  if (!ok) {
    await storage.createAccountAuditEvent({
      accountId: account.id,
      deviceId: params.deviceId,
      eventType: "account.login",
      result: "failed",
      detail: "invalid_credentials",
    });
    throw new ManagedAuthError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
  }

  const workspace = await storage.getAccountWorkspace(account.id);
  if (!workspace) {
    throw new ManagedAuthError("WORKSPACE_MISSING", "Managed account has no linked workspace.", 500);
  }

  await assertDeviceLimit(storage, account.id, params.deviceId);
  await storage.setSharedUserId(params.deviceUserId, workspace.workspaceUserId);
  await storage.upsertAccountDevice({
    accountId: account.id,
    workspaceUserId: workspace.workspaceUserId,
    deviceUserId: params.deviceUserId,
    deviceId: params.deviceId,
    deviceName: params.deviceName ?? null,
    platform: params.platform ?? null,
    authProvider: "local",
  });
  await storage.updateAccount(account.id, {
    lastLoginAt: new Date(),
    recoveryRequired: false,
  });
  await storage.createAccountAuditEvent({
    accountId: account.id,
    workspaceUserId: workspace.workspaceUserId,
    deviceId: params.deviceId,
    eventType: "account.login",
  });
  return {
    account,
    profile: await buildManagedAuthProfile(storage, account.id),
    workspaceUserId: workspace.workspaceUserId,
  };
}

export async function requestPasswordRecovery(
  storage: IStorage,
  provider: ManagedAuthProvider,
  email: string,
) {
  if (process.env.NODE_ENV === "production" && !canSendTransactionalEmail()) {
    throw new ManagedAuthError(
      "RECOVERY_EMAIL_UNAVAILABLE",
      "Password recovery email is temporarily unavailable. Please contact support.",
      503,
    );
  }
  const account = await storage.getAccountByEmail(normalizeEmail(email));
  if (!account) {
    return { requested: true, token: null as string | null, expiresAt: null as Date | null };
  }
  const token = await provider.issueToken("password_recovery", account.id, 60, {
    email: account.email,
  });
  if (process.env.NODE_ENV === "production") {
    const sent = await sendManagedAuthTokenEmail({
      email: account.email,
      kind: "password_recovery",
      token: token.token,
      expiresAt: token.expiresAt,
    });
    if (!sent) {
      throw new ManagedAuthError(
        "RECOVERY_EMAIL_UNAVAILABLE",
        "Password recovery email is temporarily unavailable. Please contact support.",
        503,
      );
    }
  }
  await storage.updateAccount(account.id, { recoveryRequired: true });
  await storage.createAccountAuditEvent({
    accountId: account.id,
    eventType: "account.recovery_requested",
  });
  return { requested: true, token: token.token, expiresAt: token.expiresAt };
}

export async function resetPasswordWithToken(
  storage: IStorage,
  provider: ManagedAuthProvider,
  token: string,
  newPassword: string,
) {
  const resolved = await provider.consumeToken("password_recovery", token);
  const account = await storage.updateAccount(resolved.accountId, {
    passwordHash: await provider.hashPassword(newPassword),
    recoveryRequired: false,
  });
  if (!account) {
    throw new ManagedAuthError("ACCOUNT_NOT_FOUND", "Recovery token refers to an unknown account.", 404);
  }
  await storage.createAccountAuditEvent({
    accountId: account.id,
    eventType: "account.password_reset",
  });
  return buildManagedAuthProfile(storage, account.id);
}

export async function verifyAccountEmail(
  storage: IStorage,
  provider: ManagedAuthProvider,
  token: string,
) {
  const resolved = await provider.consumeToken("email_verification", token);
  const account = await storage.updateAccount(resolved.accountId, {
    emailVerified: true,
    emailVerifiedAt: new Date(),
  });
  if (!account) {
    throw new ManagedAuthError("ACCOUNT_NOT_FOUND", "Verification token refers to an unknown account.", 404);
  }
  await storage.createAccountAuditEvent({
    accountId: account.id,
    eventType: "account.email_verified",
  });
  return buildManagedAuthProfile(storage, account.id);
}

export async function revokeManagedDevice(
  storage: IStorage,
  accountId: string,
  deviceId: string,
) {
  const revoked = await storage.revokeAccountDevice(accountId, deviceId);
  if (!revoked) {
    throw new ManagedAuthError("DEVICE_NOT_FOUND", "The selected device is not registered to this account.", 404);
  }
  const linkedUser = await storage.getUserByDeviceId(deviceId);
  if (linkedUser) {
    await storage.setSharedUserId(linkedUser.id, null);
  }
  await storage.createAccountAuditEvent({
    accountId,
    deviceId,
    workspaceUserId: revoked.workspaceUserId,
    eventType: "account.device_revoked",
  });
  return buildManagedAuthProfile(storage, accountId);
}
