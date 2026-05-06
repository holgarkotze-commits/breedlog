import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const BASE_URL = "http://127.0.0.1:5001";
let server: ChildProcessWithoutNullStreams | null = null;
let logs = "";

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready. Logs:\n${logs}`);
}

function randomDeviceId(prefix: string): string {
  return `${prefix}-${randomUUID()}-${randomUUID()}`;
}

async function adminCreateCode(expiryDays = 30) {
  const res = await fetch(`${BASE_URL}/api/admin/invite-codes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "AdminPin 1234",
    },
    body: JSON.stringify({ notes: "phase4-test", expiryDays, maxUses: 2 }),
  });
  assert.equal(res.status, 201);
  return res.json() as Promise<{ id: number; code: string; expiresAt: string }>;
}

async function validateCode(code: string, deviceId: string, userAgent: string) {
  return fetch(`${BASE_URL}/api/beta/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({ code, deviceId }),
  });
}

before(async () => {
  server = spawn("./node_modules/.bin/tsx", ["server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      USE_IN_MEMORY_STORAGE: "1",
      SESSION_SECRET: "test-secret",
      ADMIN_PIN: "1234",
      PORT: "5001",
    },
    stdio: "pipe",
    detached: true,
  });

  server.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    process.kill(-server.pid!, "SIGTERM");
  }
});

test("same invite code activates one desktop + one mobile and shares workspace data", async () => {
  const code = await adminCreateCode(30);

  const desktopDevice = randomDeviceId("desktop-1");
  const mobileDevice = randomDeviceId("mobile-1");

  const desktopValidation = await validateCode(code.code, desktopDevice, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(desktopValidation.status, 200);
  const desktopData = await desktopValidation.json() as { token: string };
  assert.ok(desktopData.token);

  const mobileValidation = await validateCode(code.code, mobileDevice, "Mozilla/5.0 (Linux; Android 14; Mobile)");
  assert.equal(mobileValidation.status, 200);
  const mobileData = await mobileValidation.json() as { token: string };
  assert.ok(mobileData.token);

  const createAnimal = await fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${desktopData.token}`,
    },
    body: JSON.stringify({ tagId: "PH4-A-001", sex: "ewe" }),
  });
  assert.equal(createAnimal.status, 201);

  const mobileList = await fetch(`${BASE_URL}/api/animals`, {
    headers: {
      Authorization: `Bearer ${mobileData.token}`,
    },
  });
  assert.equal(mobileList.status, 200);
  const animals = await mobileList.json() as Array<{ tagId: string }>;
  assert.equal(animals.some((a) => a.tagId === "PH4-A-001"), true);
});

test("same mobile and desktop can re-validate repeatedly with same valid code", async () => {
  const code = await adminCreateCode(30);
  const desktopDevice = randomDeviceId("desktop-repeat");
  const mobileDevice = randomDeviceId("mobile-repeat");

  for (let i = 0; i < 3; i += 1) {
    const desktopTry = await validateCode(code.code, desktopDevice, "Mozilla/5.0 (X11; Linux x86_64)");
    assert.equal(desktopTry.status, 200);
  }

  for (let i = 0; i < 3; i += 1) {
    const mobileTry = await validateCode(code.code, mobileDevice, "Mozilla/5.0 (Linux; Android 14; Mobile)");
    assert.equal(mobileTry.status, 200);
  }
});

test("third mobile and third desktop are blocked once slot is already occupied", async () => {
  const code = await adminCreateCode(30);

  const desktop1 = randomDeviceId("desktop-main");
  const mobile1 = randomDeviceId("mobile-main");
  const mobile2 = randomDeviceId("mobile-blocked");
  const desktop2 = randomDeviceId("desktop-blocked");

  assert.equal((await validateCode(code.code, desktop1, "Mozilla/5.0 (X11; Linux x86_64)")).status, 200);
  assert.equal((await validateCode(code.code, mobile1, "Mozilla/5.0 (Linux; Android 14; Mobile)")).status, 200);

  const blockedMobile = await validateCode(code.code, mobile2, "Mozilla/5.0 (Linux; Android 14; Mobile)");
  assert.equal(blockedMobile.status, 400);
  assert.match(await blockedMobile.text(), /mobile slot|both device slots/i);

  const blockedDesktop = await validateCode(code.code, desktop2, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(blockedDesktop.status, 400);
  assert.match(await blockedDesktop.text(), /desktop slot|both device slots/i);
});

test("expired access code is blocked", async () => {
  const expiredCode = await adminCreateCode(-1);
  const device = randomDeviceId("expired-device");
  const res = await validateCode(expiredCode.code, device, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(res.status, 400);
  assert.match(await res.text(), /expired/i);
});

test("admin can release slot and replacement device can register", async () => {
  const code = await adminCreateCode(30);
  const mobile1 = randomDeviceId("mobile-release-1");
  const mobile2 = randomDeviceId("mobile-release-2");

  assert.equal((await validateCode(code.code, mobile1, "Mozilla/5.0 (Linux; Android 14; Mobile)")).status, 200);

  const initiallyBlocked = await validateCode(code.code, mobile2, "Mozilla/5.0 (Linux; Android 14; Mobile)");
  assert.equal(initiallyBlocked.status, 400);

  const release = await fetch(`${BASE_URL}/api/admin/invite-codes/${code.id}/reset-slot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "AdminPin 1234",
    },
    body: JSON.stringify({ slotType: "mobile" }),
  });
  assert.equal(release.status, 200);

  const replacement = await validateCode(code.code, mobile2, "Mozilla/5.0 (Linux; Android 14; Mobile)");
  assert.equal(replacement.status, 200);
});

async function adminLookupCode(code: string) {
  const res = await fetch(`${BASE_URL}/api/admin/invite-codes/lookup/${code}`, {
    headers: { Authorization: "AdminPin 1234" },
  });
  return { status: res.status, body: await res.json() as any };
}

test("MM5DBB4H regression: maxUses=1 code with mobile taken still allows desktop activation", async () => {
  // Reproduce a legacy code: maxUses=1 (old codes were created this way).
  const createRes = await fetch(`${BASE_URL}/api/admin/invite-codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({ notes: "legacy-maxuses-1", expiryDays: 30, maxUses: 1 }),
  });
  assert.equal(createRes.status, 201);
  const code = await createRes.json() as { id: number; code: string };

  // Mobile activates first → usesCount becomes 1 (== maxUses).
  const mobile = randomDeviceId("legacy-mobile");
  assert.equal((await validateCode(code.code, mobile, "Mozilla/5.0 (Linux; Android 14; Mobile)")).status, 200);

  // Desktop must STILL be allowed because the desktop slot is empty.
  const desktop = randomDeviceId("legacy-desktop");
  const desktopRes = await validateCode(code.code, desktop, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(desktopRes.status, 200, `desktop should activate; got ${desktopRes.status}: ${await desktopRes.text()}`);

  // Diagnostic must show NON-CONTRADICTORY output: codeStatus=active,
  // both slots taken, desktop.canActivate=false (taken not "max uses").
  const lookup = await adminLookupCode(code.code);
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.codeStatus, "active");
  assert.equal(lookup.body.blockReason, null);
  assert.equal(lookup.body.slots.desktop.taken, true);
  assert.equal(lookup.body.slots.mobile.taken, true);
  assert.equal(lookup.body.slots.desktop.canActivate, false);
  assert.equal(lookup.body.slots.mobile.canActivate, false);
  assert.match(String(lookup.body.slots.desktop.reason ?? ''), /already taken/i);
  // Critically, the legacy "max uses reached" string must be gone.
  assert.doesNotMatch(JSON.stringify(lookup.body), /max(imum)? uses/i);
});

test("diagnostic lookup: free slot on active code reports canActivate=true (no contradictions)", async () => {
  const code = await adminCreateCode(30);
  const mobile = randomDeviceId("diag-mobile");
  assert.equal((await validateCode(code.code, mobile, "Mozilla/5.0 (Linux; Android 14; Mobile)")).status, 200);

  const lookup = await adminLookupCode(code.code);
  assert.equal(lookup.body.codeStatus, "active");
  assert.equal(lookup.body.slots.desktop.taken, false);
  assert.equal(lookup.body.slots.desktop.canActivate, true);
  assert.equal(lookup.body.slots.mobile.taken, true);
  assert.equal(lookup.body.slots.mobile.canActivate, false);
  // licenseActivatedAt should reflect the mobile activation.
  assert.ok(lookup.body.licenseActivatedAt);
});

test("admin extend-expiry pushes expiresAt forward without changing status or activations", async () => {
  const code = await adminCreateCode(5);
  const mobile = randomDeviceId("extend-mobile");
  assert.equal((await validateCode(code.code, mobile, "Mozilla/5.0 (Linux; Android 14; Mobile)")).status, 200);
  const before = await adminLookupCode(code.code);
  const beforeExpiry = new Date(before.body.code.expiresAt).getTime();

  const ext = await fetch(`${BASE_URL}/api/admin/invite-codes/${code.id}/extend-expiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({ days: 60 }),
  });
  assert.equal(ext.status, 200);

  const after = await adminLookupCode(code.code);
  assert.equal(after.body.codeStatus, "active");
  assert.ok(new Date(after.body.code.expiresAt).getTime() > beforeExpiry);
  // Mobile activation must still be intact.
  assert.equal(after.body.slots.mobile.taken, true);
  assert.equal(after.body.slots.mobile.deviceId, mobile);
});

test("admin reactivate brings back a revoked code; original device can re-login to same workspace", async () => {
  const code = await adminCreateCode(30);
  const desktop = randomDeviceId("reactivate-desktop");
  const firstLogin = await validateCode(code.code, desktop, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(firstLogin.status, 200);
  const firstUserId = (await firstLogin.json() as any).userId;

  // Add an animal so we can verify workspace data survives revoke+reactivate.
  const token = (await (await validateCode(code.code, desktop, "Mozilla/5.0 (X11; Linux x86_64)")).json() as any).token;
  const created = await fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tagId: "REACT-001", sex: "ewe" }),
  });
  assert.equal(created.status, 201);

  // Revoke.
  const rev = await fetch(`${BASE_URL}/api/admin/invite-codes/${code.id}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
  });
  assert.equal(rev.status, 200);
  const revLookup = await adminLookupCode(code.code);
  assert.equal(revLookup.body.codeStatus, "revoked");
  // While revoked, login is blocked.
  const blocked = await validateCode(code.code, desktop, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(blocked.status, 400);

  // Reactivate (no extend needed — still in future).
  const react = await fetch(`${BASE_URL}/api/admin/invite-codes/${code.id}/reactivate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({}),
  });
  assert.equal(react.status, 200);
  const reactBody = await react.json() as any;
  assert.equal(reactBody.code.status, "active");

  // Original device re-logs in and lands on the same workspace (same userId, same animals).
  const reloginRes = await validateCode(code.code, desktop, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(reloginRes.status, 200);
  const reloginBody = await reloginRes.json() as any;
  assert.equal(reloginBody.userId, firstUserId);
  const animalsRes = await fetch(`${BASE_URL}/api/animals`, {
    headers: { Authorization: `Bearer ${reloginBody.token}` },
  });
  assert.equal(animalsRes.status, 200);
  const animals = await animalsRes.json() as Array<{ tagId: string }>;
  assert.equal(animals.some((a) => a.tagId === "REACT-001"), true);
});

test("admin reactivate of expired code pushes expiry forward when extendDays not given", async () => {
  const expired = await adminCreateCode(-1);
  const lookup1 = await adminLookupCode(expired.code);
  assert.equal(lookup1.body.codeStatus, "expired");

  const react = await fetch(`${BASE_URL}/api/admin/invite-codes/${expired.id}/reactivate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({}),
  });
  assert.equal(react.status, 200);

  const lookup2 = await adminLookupCode(expired.code);
  assert.equal(lookup2.body.codeStatus, "active");
  assert.ok(new Date(lookup2.body.code.expiresAt) > new Date());

  // A device can now activate.
  const dev = randomDeviceId("reactivate-expired");
  const res = await validateCode(expired.code, dev, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(res.status, 200);
});

test("admin reset-slot does NOT delete workspace data — re-activating restores same animals", async () => {
  const code = await adminCreateCode(30);
  const desktop1 = randomDeviceId("reset-desktop-1");
  const login1 = await validateCode(code.code, desktop1, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(login1.status, 200);
  const token1 = (await login1.json() as any).token;

  const created = await fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token1}` },
    body: JSON.stringify({ tagId: "RESET-001", sex: "ram" }),
  });
  assert.equal(created.status, 201);

  // Reset desktop slot.
  const reset = await fetch(`${BASE_URL}/api/admin/invite-codes/${code.id}/reset-slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({ slotType: "desktop" }),
  });
  assert.equal(reset.status, 200);

  // A different desktop activates and lands on the same workspace.
  const desktop2 = randomDeviceId("reset-desktop-2");
  const login2 = await validateCode(code.code, desktop2, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(login2.status, 200);
  const token2 = (await login2.json() as any).token;
  const animals = await (await fetch(`${BASE_URL}/api/animals`, { headers: { Authorization: `Bearer ${token2}` } })).json() as Array<{ tagId: string }>;
  assert.equal(animals.some((a) => a.tagId === "RESET-001"), true);
});

test("reset-slot on legacy maxUses=1 code does NOT mutate usesCount and does NOT block re-activation", async () => {
  const createRes = await fetch(`${BASE_URL}/api/admin/invite-codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({ notes: "legacy-reset", expiryDays: 30, maxUses: 1 }),
  });
  assert.equal(createRes.status, 201);
  const code = await createRes.json() as { id: number; code: string };

  const desktop1 = randomDeviceId("legacy-reset-d1");
  assert.equal((await validateCode(code.code, desktop1, "Mozilla/5.0 (X11; Linux x86_64)")).status, 200);
  const beforeLookup = await adminLookupCode(code.code);
  const usesBefore = beforeLookup.body.code.usesCount;
  assert.equal(usesBefore, 1);

  // Free the desktop slot.
  const reset = await fetch(`${BASE_URL}/api/admin/invite-codes/${code.id}/reset-slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({ slotType: "desktop" }),
  });
  assert.equal(reset.status, 200);

  const afterLookup = await adminLookupCode(code.code);
  // usesCount must be unchanged (do not decrement).
  assert.equal(afterLookup.body.code.usesCount, usesBefore);
  assert.equal(afterLookup.body.codeStatus, "active");
  assert.equal(afterLookup.body.slots.desktop.taken, false);
  assert.equal(afterLookup.body.slots.desktop.canActivate, true);
  assert.doesNotMatch(JSON.stringify(afterLookup.body), /max(imum)? uses/i);

  // A different desktop must be able to claim the freed slot, even with maxUses=1.
  const desktop2 = randomDeviceId("legacy-reset-d2");
  const replace = await validateCode(code.code, desktop2, "Mozilla/5.0 (X11; Linux x86_64)");
  assert.equal(replace.status, 200, `replacement desktop should activate; got ${replace.status}: ${await replace.text()}`);
});

test("logout does not clear offline herd data path and offline authorized fallback exists in source", () => {
  const authSource = fs.readFileSync("client/src/hooks/use-auth.ts", "utf8");
  assert.doesNotMatch(authSource, /clearAllOfflineData\(\)/);
  assert.match(authSource, /if \(!navigator\.onLine\)/);
  assert.match(authSource, /if \(token\) \{\s*return \{ registered: true \}/s);
});
