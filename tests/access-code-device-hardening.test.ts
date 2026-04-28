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

test("logout does not clear offline herd data path and offline authorized fallback exists in source", () => {
  const authSource = fs.readFileSync("client/src/hooks/use-auth.ts", "utf8");
  assert.doesNotMatch(authSource, /clearAllOfflineData\(\)/);
  assert.match(authSource, /if \(!navigator\.onLine\)/);
  assert.match(authSource, /if \(token\) \{\s*return \{ registered: true \}/s);
});
