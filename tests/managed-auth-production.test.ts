import test from "node:test";
import assert from "node:assert/strict";
import { storage } from "../server/storage";
import {
  buildManagedAuthProfile,
  createManagedAuthProvider,
  loginManagedAccount,
  ManagedAuthError,
  registerManagedAccount,
  requestPasswordRecovery,
  resetPasswordWithToken,
  verifyAccountEmail,
} from "../server/managed-auth";
import { applyBillingEvent } from "../server/commercial";

const provider = createManagedAuthProvider(storage);

test("managed auth registration preserves the legacy workspace and issues verification", async () => {
  const deviceId = "managed-auth-device-1";
  const deviceUser = await storage.upsertUser({ deviceId, deviceName: "Desktop A" });

  const result = await registerManagedAccount(storage, provider, {
    email: "managed-auth-register@example.com",
    password: "VerySecurePass1",
    deviceId,
    deviceUserId: deviceUser.id,
    deviceName: "Desktop A",
    platform: "windows",
  });

  assert.equal(result.profile.workspaceUserId, deviceUser.id);
  assert.ok(result.verification.token.startsWith("email_verification_"));

  const workspace = await storage.getAccountWorkspace(result.account.id);
  assert.equal(workspace?.workspaceUserId, deviceUser.id);

  const profile = await buildManagedAuthProfile(storage, result.account.id);
  assert.equal(profile.devices.length, 1);
  assert.equal(profile.devices[0].deviceId, deviceId);
});

test("managed auth registration preserves an existing shared workspace mapping", async () => {
  const primary = await storage.upsertUser({ deviceId: "managed-auth-shared-primary", deviceName: "Primary Shared" });
  const secondary = await storage.upsertUser({ deviceId: "managed-auth-shared-secondary", deviceName: "Secondary Shared" });
  await storage.setSharedUserId(secondary.id, primary.id);

  const result = await registerManagedAccount(storage, provider, {
    email: "managed-auth-shared@example.com",
    password: "VerySecurePassShared1",
    deviceId: "managed-auth-shared-secondary",
    deviceUserId: secondary.id,
    deviceName: "Secondary Shared",
    platform: "android",
  });

  assert.equal(result.profile.workspaceUserId, primary.id);
  assert.equal((await storage.getUserById(secondary.id))?.sharedUserId, primary.id);
});

test("managed auth email verification and password recovery are deterministic", async () => {
  const deviceId = "managed-auth-device-verify";
  const deviceUser = await storage.upsertUser({ deviceId, deviceName: "Tablet A" });
  const registered = await registerManagedAccount(storage, provider, {
    email: "managed-auth-verify@example.com",
    password: "VerySecurePass2",
    deviceId,
    deviceUserId: deviceUser.id,
    deviceName: "Tablet A",
    platform: "android",
  });

  const verifiedProfile = await verifyAccountEmail(storage, provider, registered.verification.token);
  assert.equal(verifiedProfile.emailVerified, true);

  const recovery = await requestPasswordRecovery(storage, provider, "managed-auth-verify@example.com");
  assert.ok(recovery.token);
  const resetProfile = await resetPasswordWithToken(storage, provider, recovery.token!, "EvenMoreSecurePass2");
  assert.equal(resetProfile.accountId, registered.account.id);

  const loggedIn = await loginManagedAccount(storage, provider, {
    email: "managed-auth-verify@example.com",
    password: "EvenMoreSecurePass2",
    deviceId,
    deviceUserId: deviceUser.id,
    deviceName: "Tablet A",
    platform: "android",
  });
  assert.equal(loggedIn.account.id, registered.account.id);
});

test("password recovery fails closed in production when transactional email is unavailable", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSmtpHost = process.env.SMTP_HOST;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;
  process.env.NODE_ENV = "production";
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  try {
    await assert.rejects(
      () => requestPasswordRecovery(storage, provider, "managed-auth-verify@example.com"),
      (error: unknown) => error instanceof ManagedAuthError && error.code === "RECOVERY_EMAIL_UNAVAILABLE",
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSmtpHost === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = originalSmtpHost;
    if (originalSmtpUser === undefined) delete process.env.SMTP_USER; else process.env.SMTP_USER = originalSmtpUser;
    if (originalSmtpPass === undefined) delete process.env.SMTP_PASS; else process.env.SMTP_PASS = originalSmtpPass;
  }
});

test("device limits enforce free one-device and premium three-device boundaries", async () => {
  const primary = await storage.upsertUser({ deviceId: "managed-limit-primary", deviceName: "Primary" });
  const registered = await registerManagedAccount(storage, provider, {
    email: "managed-auth-limits@example.com",
    password: "VerySecurePass3",
    deviceId: "managed-limit-primary",
    deviceUserId: primary.id,
    deviceName: "Primary",
    platform: "windows",
  });

  const second = await storage.upsertUser({ deviceId: "managed-limit-second", deviceName: "Second" });
  await assert.rejects(
    () =>
      loginManagedAccount(storage, provider, {
        email: "managed-auth-limits@example.com",
        password: "VerySecurePass3",
        deviceId: "managed-limit-second",
        deviceUserId: second.id,
        deviceName: "Second",
        platform: "android",
      }),
    (error: unknown) => error instanceof ManagedAuthError && error.code === "DEVICE_LIMIT_REACHED",
  );

  await applyBillingEvent(storage, {
    provider: "test-provider",
    providerEventId: "managed-auth-premium-1",
    accountId: registered.account.id,
    eventType: "subscription.created",
    planId: "premium",
    effectiveAt: new Date().toISOString(),
  });

  const secondLogin = await loginManagedAccount(storage, provider, {
    email: "managed-auth-limits@example.com",
    password: "VerySecurePass3",
    deviceId: "managed-limit-second",
    deviceUserId: second.id,
    deviceName: "Second",
    platform: "android",
  });
  assert.equal(secondLogin.profile.devices.filter((device) => device.status === "active").length, 2);

  const third = await storage.upsertUser({ deviceId: "managed-limit-third", deviceName: "Third" });
  await loginManagedAccount(storage, provider, {
    email: "managed-auth-limits@example.com",
    password: "VerySecurePass3",
    deviceId: "managed-limit-third",
    deviceUserId: third.id,
    deviceName: "Third",
    platform: "ios",
  });

  const fourth = await storage.upsertUser({ deviceId: "managed-limit-fourth", deviceName: "Fourth" });
  await assert.rejects(
    () =>
      loginManagedAccount(storage, provider, {
        email: "managed-auth-limits@example.com",
        password: "VerySecurePass3",
        deviceId: "managed-limit-fourth",
        deviceUserId: fourth.id,
        deviceName: "Fourth",
        platform: "linux",
      }),
    (error: unknown) => error instanceof ManagedAuthError && error.code === "DEVICE_LIMIT_REACHED",
  );

  const mappedSecond = await storage.getUserByDeviceId("managed-limit-second");
  assert.equal(mappedSecond?.sharedUserId, primary.id);
});
