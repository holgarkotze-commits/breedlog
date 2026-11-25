import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";
import { generateDeviceToken } from "../server/device-auth";
import { redactForLog } from "../server/observability";

test("public farmer onboarding, isolation, revocation and recovery", async t => {
  assert.equal(process.env.USE_IN_MEMORY_STORAGE, "1", "Never run against farmer data");
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ message: "Internal error" }));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (path: string, body?: any, cookie = "", headers = {}) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie,
      setCookie: response.headers.get("set-cookie") || "" };
  };
  try {
    const password = "Farmer-test-password-01";
    const legacy = await storage.upsertUser({ deviceId: "legacy-device-public-onboarding-test" });
    const legacyAnimal = await storage.createAnimal(legacy.id, { tagId: "LEGACY-KEEP", sex: "ewe" } as any);
    let farmerA: Awaited<ReturnType<typeof request>>;
    let farmerB: Awaited<ReturnType<typeof request>>;
    await t.test("anonymous status and signup consent / bot validation", async () => {
      assert.equal((await request("/api/auth/me")).body.authenticated, false);
      assert.equal((await request("/api/animals")).status, 401);
      assert.equal((await request("/api/auth/register", { email: "first@test.example", password })).status, 400);
      assert.equal((await request("/api/auth/register", { email: "first@test.example", password, acceptedTerms: true, website: "spam" })).status, 400);
      assert.equal((await request("/api/auth/register", { email: "first@test.example", password, acceptedTerms: true }, "", { Origin: "https://evil.example" })).status, 403);
    });
    await t.test("fresh signup ignores attacker workspace/device IDs and starts empty", async () => {
      farmerA = await request("/api/auth/register", { email: "first@test.example", password, acceptedTerms: true,
        deviceId: legacy.deviceId, workspaceUserId: legacy.id });
      assert.equal(farmerA.status, 201);
      assert.notEqual(farmerA.body.profile.workspaceUserId, legacy.id);
      assert.ok(farmerA.setCookie.includes("HttpOnly"));
      assert.ok(farmerA.setCookie.includes("SameSite=Lax"));
      assert.equal(farmerA.body.token, undefined);
      assert.ok(farmerA.body.recoveryCode.startsWith("password_recovery_"));
      assert.deepEqual((await request("/api/animals", undefined, farmerA.cookie)).body, []);
      assert.equal((await request("/api/auth/me", undefined, farmerA.cookie)).body.trial, true);
      assert.equal((await request(`/api/animals/${legacyAnimal.id}`, undefined, farmerA.cookie)).status, 404);
    });
    await t.test("second farmer has a different empty workspace", async () => {
      farmerB = await request("/api/auth/register", { email: "second@test.example", password, acceptedTerms: true });
      assert.equal(farmerB.status, 201);
      assert.notEqual(farmerA.body.profile.workspaceUserId, farmerB.body.profile.workspaceUserId);
      assert.deepEqual((await request("/api/animals", undefined, farmerB.cookie)).body, []);
    });
    await t.test("own records persist through reads and cannot be read by another farmer", async () => {
      const created = await request("/api/animals", { tagId: "FARM-A-001", sex: "ewe", status: "active" }, farmerA.cookie);
      assert.equal(created.status, 201);
      const id = created.body.id;
      assert.equal((await request(`/api/animals/${id}`, undefined, farmerA.cookie)).status, 200);
      const denied = await request(`/api/animals/${id}`, undefined, farmerB.cookie);
      assert.equal(denied.status, 404);
      assert.match(denied.body.message, /not found/i);
      assert.doesNotMatch(denied.body.message, /premium|upgrade/i);
      assert.deepEqual((await request("/api/animals", undefined, farmerB.cookie)).body, []);
    });
    await t.test("trial may read approved prices without enabling checkout", async () => {
      const result = await request("/api/billing/catalog?billingCountry=ZA", undefined, farmerA.cookie);
      assert.equal(result.status, 200); assert.equal(result.body.pricing.currency, "ZAR");
      assert.equal(result.body.pricing.monthlyMinor, 7999); assert.equal(result.body.pricing.checkoutEnabled, false);
      assert.equal((await request("/api/billing/checkout-session", { provider: "paytoday", productCode: "premium_monthly" }, farmerA.cookie)).status, 403);
    });
    await t.test("paid AI and simulated billing are blocked for trials", async () => {
      for (const path of ["/api/ai/ask", "/api/billing/checkout-session", "/api/billing/portal-session"]) {
        const result = await request(path, {}, farmerA.cookie);
        assert.equal(result.status, 403);
        assert.equal(result.body.code, "COMING_SOON");
      }
    });
    await t.test("known account device ID cannot mint legacy-token access", async () => {
      const deviceId = farmerA.body.profile.devices[0].deviceId;
      assert.equal((await request("/api/device/register", { deviceId })).status, 403);
      assert.equal((await request("/api/animals", undefined, "", { Authorization: `Bearer ${generateDeviceToken(deviceId)}` })).status, 401);
    });
    await t.test("failed credentials and explicit one-device replacement", async () => {
      assert.equal((await request("/api/auth/login", { email: "first@test.example", password: "wrong" })).status, 401);
      const blocked = await request("/api/auth/login", { email: "first@test.example", password });
      assert.equal(blocked.body.code, "DEVICE_LIMIT_REACHED");
      const replaced = await request("/api/auth/login", { email: "first@test.example", password, replaceDevice: true });
      assert.equal(replaced.status, 200);
      assert.equal((await request("/api/animals", undefined, farmerA.cookie)).status, 401);
      farmerA.cookie = replaced.cookie;
    });
    await t.test("logout revokes session and replay cannot restore access", async () => {
      const oldCookie = farmerA.cookie;
      assert.equal((await request("/api/auth/logout", {}, oldCookie)).status, 200);
      assert.equal((await request("/api/animals", undefined, oldCookie)).status, 401);
      const login = await request("/api/auth/login", { email: "first@test.example", password });
      assert.equal(login.status, 200);
      assert.notEqual(login.cookie, oldCookie);
      farmerA.cookie = login.cookie;
    });
    await t.test("one-time recovery rejects weak password, revokes sessions and rotates code", async () => {
      const token = farmerA.body.recoveryCode;
      assert.equal((await request("/api/auth/recovery/confirm", { token, newPassword: "weak" })).status, 400);
      const reset = await request("/api/auth/recovery/confirm", { token, newPassword: "Changed-password-01" });
      assert.equal(reset.status, 200);
      assert.ok(reset.body.recoveryCode);
      assert.notEqual(reset.body.recoveryCode, token);
      assert.equal(reset.body.profile, undefined);
      assert.equal((await request("/api/animals", undefined, farmerA.cookie)).status, 401);
      assert.equal((await request("/api/auth/recovery/confirm", { token, newPassword: "Changed-password-02" })).status, 400);
      assert.equal((await request("/api/auth/login", { email: "first@test.example", password })).status, 401);
      const login = await request("/api/auth/login", { email: "first@test.example", password: "Changed-password-01" });
      assert.equal(login.status, 200);
      assert.equal((await request("/api/animals", undefined, login.cookie)).body.length, 1);
    });
    await t.test("email recovery never returns tokens or claims unavailable email was sent", async () => {
      const response = await request("/api/auth/recovery/request", { email: "first@test.example" });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "RECOVERY_EMAIL_UNAVAILABLE");
      assert.equal(response.body.token, undefined);
      const unknown = await request("/api/auth/recovery/request", { email: "unknown@test.example" });
      assert.equal(unknown.status, 503);
    });
    await t.test("legacy records and beta token access remain unchanged", async () => {
      assert.equal((await storage.getAnimal(legacy.id, legacyAnimal.id))?.tagId, "LEGACY-KEEP");
      const token = generateDeviceToken(legacy.deviceId!);
      assert.equal((await request("/api/animals", undefined, "", { Authorization: `Bearer ${token}` })).status, 200);
    });
    await t.test("free trial limits and identity abuse protection are enforced", async () => {
      const owner = farmerB.body.profile.workspaceUserId;
      for (let i = 0; i < 30; i++) await storage.createAnimal(owner, { tagId: `CAP-${i}`, sex: "ewe", status: "active" } as any);
      assert.equal((await request("/api/animals", { tagId: "CAP-31", sex: "ewe", status: "active" }, farmerB.cookie)).status, 403);
      let last;
      for (let i = 0; i < 13; i++) last = await request("/api/auth/login", { email: "no-account@test.example", password: "wrong" });
      assert.equal(last!.status, 429);
      const redacted = redactForLog({ recoveryCode: "private", password: "private", token: "private" }) as any;
      assert.equal(redacted.recoveryCode, "[REDACTED]");
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
