import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const BASE_URL = "http://127.0.0.1:5002";
let server: ChildProcessWithoutNullStreams | null = null;
let logs = "";

const DESKTOP_UA = "Mozilla/5.0 (X11; Linux x86_64)";
const MOBILE_UA = "Mozilla/5.0 (Linux; Android 14; Mobile)";

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
    body: JSON.stringify({ notes: "switch-test", expiryDays, maxUses: 2 }),
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

async function listAnimals(token: string) {
  const res = await fetch(`${BASE_URL}/api/animals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() as Array<{ tagId: string }> };
}

async function createAnimal(token: string, tagId: string) {
  return fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tagId, sex: "ewe" }),
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
      PORT: "5002",
    },
    stdio: "pipe",
    detached: true,
  });
  server.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  server.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    process.kill(-server.pid!, "SIGTERM");
  }
});

test("same device + same code re-login returns same workspace userId (no switch)", async () => {
  const codeA = await adminCreateCode(30);
  const device = randomDeviceId("same-code-relogin");

  const first = await validateCode(codeA.code, device, MOBILE_UA);
  assert.equal(first.status, 200);
  const firstData = await first.json() as { userId: string; token: string; message: string };
  assert.ok(firstData.userId);

  // Re-login with the EXACT same code
  const second = await validateCode(codeA.code, device, MOBILE_UA);
  assert.equal(second.status, 200);
  const secondData = await second.json() as { userId: string; message: string };
  assert.equal(secondData.userId, firstData.userId, "Same-code relogin must return the same workspace userId");
  assert.match(secondData.message, /Already activated/i);
});

test("same device + DIFFERENT valid code switches workspace and returns NEW userId", async () => {
  const codeA = await adminCreateCode(30);
  const codeB = await adminCreateCode(30);
  const device = randomDeviceId("workspace-switch");

  // Activate code A
  const activateA = await validateCode(codeA.code, device, MOBILE_UA);
  assert.equal(activateA.status, 200);
  const dataA = await activateA.json() as { userId: string; token: string };
  const userA = dataA.userId;

  // Create an animal under workspace A
  assert.equal((await createAnimal(dataA.token, "SWITCH-A-001")).status, 201);
  const listA = await listAnimals(dataA.token);
  assert.equal(listA.body.some(a => a.tagId === "SWITCH-A-001"), true);

  // Now switch to code B with the SAME device
  const activateB = await validateCode(codeB.code, device, MOBILE_UA);
  assert.equal(activateB.status, 200, `Expected 200 on workspace switch; body: ${JSON.stringify(await activateB.clone().json().catch(() => null))}`);
  const dataB = await activateB.json() as { userId: string; token: string; message: string };
  assert.notEqual(dataB.userId, userA, "Workspace switch must return a DIFFERENT userId than the previous code's workspace");
  assert.match(dataB.message, /Workspace switched/i);

  // Listing animals under code B's workspace must NOT include code A's animal
  const listB = await listAnimals(dataB.token);
  assert.equal(listB.status, 200);
  assert.equal(listB.body.some(a => a.tagId === "SWITCH-A-001"), false,
    "Animals from code A's workspace must not leak into code B after switch");
});

test("after switching back to original code, original workspace data is still intact", async () => {
  const codeA = await adminCreateCode(30);
  const codeB = await adminCreateCode(30);
  const device = randomDeviceId("switch-back");

  const a1 = await validateCode(codeA.code, device, MOBILE_UA);
  const a1Data = await a1.json() as { userId: string; token: string };
  assert.equal((await createAnimal(a1Data.token, "BACK-A-001")).status, 201);

  // Switch to B
  const b1 = await validateCode(codeB.code, device, MOBILE_UA);
  const b1Data = await b1.json() as { userId: string; token: string };
  assert.notEqual(b1Data.userId, a1Data.userId);
  // Code B workspace is empty
  const bList = await listAnimals(b1Data.token);
  assert.equal(bList.body.length, 0);

  // Switch back to A
  const a2 = await validateCode(codeA.code, device, MOBILE_UA);
  assert.equal(a2.status, 200);
  const a2Data = await a2.json() as { userId: string; token: string; message: string };
  // Switching back is also a workspace switch (existing activation now points at code B)
  assert.match(a2Data.message, /Workspace switched/i);
  assert.equal(a2Data.userId, a1Data.userId, "Switching back to original code must restore original workspace userId");
  // Code A's animal must still be visible
  const aList = await listAnimals(a2Data.token);
  assert.equal(aList.body.some(a => a.tagId === "BACK-A-001"), true,
    "Original workspace data must persist after switching away and back");
});

test("workspace switch is BLOCKED when new code's slot for this device type is already full", async () => {
  const codeA = await adminCreateCode(30);
  const codeB = await adminCreateCode(30);
  const myDevice = randomDeviceId("switcher-mobile");
  const otherMobile = randomDeviceId("other-mobile");

  // myDevice activates code A
  const a = await validateCode(codeA.code, myDevice, MOBILE_UA);
  assert.equal(a.status, 200);
  const aData = await a.json() as { userId: string };

  // Another mobile device fills the mobile slot on code B
  assert.equal((await validateCode(codeB.code, otherMobile, MOBILE_UA)).status, 200);

  // myDevice tries to switch to code B — mobile slot is full
  const switchAttempt = await validateCode(codeB.code, myDevice, MOBILE_UA);
  assert.equal(switchAttempt.status, 400);
  const errBody = await switchAttempt.text();
  assert.match(errBody, /mobile slot|both device slots/i);

  // myDevice must STILL be on code A — re-validate code A and confirm same workspace
  const stillOnA = await validateCode(codeA.code, myDevice, MOBILE_UA);
  assert.equal(stillOnA.status, 200);
  const stillData = await stillOnA.json() as { userId: string; message: string };
  assert.equal(stillData.userId, aData.userId, "Failed switch must NOT silently move device off original workspace");
  assert.match(stillData.message, /Already activated/i);
});

test("workspace switch is BLOCKED when target code is expired; old workspace stays intact", async () => {
  const codeA = await adminCreateCode(30);
  const expiredCode = await adminCreateCode(-1); // already expired
  const device = randomDeviceId("switch-to-expired");

  const a = await validateCode(codeA.code, device, MOBILE_UA);
  assert.equal(a.status, 200);
  const aData = await a.json() as { userId: string };

  const switchAttempt = await validateCode(expiredCode.code, device, MOBILE_UA);
  assert.equal(switchAttempt.status, 400);
  assert.match(await switchAttempt.text(), /expired/i);

  // Re-validate code A; must still resolve to same workspace
  const recheck = await validateCode(codeA.code, device, MOBILE_UA);
  assert.equal(recheck.status, 200);
  const recheckData = await recheck.json() as { userId: string };
  assert.equal(recheckData.userId, aData.userId);
});

test("workspace switch is BLOCKED for non-existent code; old workspace stays intact", async () => {
  const codeA = await adminCreateCode(30);
  const device = randomDeviceId("switch-to-bogus");

  const a = await validateCode(codeA.code, device, MOBILE_UA);
  const aData = await a.json() as { userId: string };

  const bogus = await validateCode("ZZZZ9999", device, MOBILE_UA);
  assert.equal(bogus.status, 400);

  const recheck = await validateCode(codeA.code, device, MOBILE_UA);
  const recheckData = await recheck.json() as { userId: string };
  assert.equal(recheckData.userId, aData.userId);
});

test("after workspace switch, mobile + desktop on the new code STILL share one herd", async () => {
  const codeA = await adminCreateCode(30);
  const codeB = await adminCreateCode(30);
  const myMobile = randomDeviceId("share-mobile");
  const newDesktop = randomDeviceId("share-desktop");

  // myMobile activates code A first
  assert.equal((await validateCode(codeA.code, myMobile, MOBILE_UA)).status, 200);

  // Now myMobile switches to code B
  const switched = await validateCode(codeB.code, myMobile, MOBILE_UA);
  assert.equal(switched.status, 200);
  const switchedData = await switched.json() as { userId: string; token: string };

  // A fresh desktop activates code B — should share workspace with myMobile (now on code B)
  const desktopOnB = await validateCode(codeB.code, newDesktop, DESKTOP_UA);
  assert.equal(desktopOnB.status, 200);
  const desktopData = await desktopOnB.json() as { userId: string; token: string };
  assert.equal(desktopData.userId, switchedData.userId, "Desktop joining code B must resolve to same workspace as the switched mobile");

  // Create animal from desktop, see it on mobile
  assert.equal((await createAnimal(desktopData.token, "SHARED-B-001")).status, 201);
  const mobileList = await listAnimals(switchedData.token);
  assert.equal(mobileList.body.some(a => a.tagId === "SHARED-B-001"), true,
    "After switch, mobile and desktop on the new code must see the same herd");
});

test("third device on a code is still blocked after workspace switches happen", async () => {
  const codeA = await adminCreateCode(30);
  const codeB = await adminCreateCode(30);
  const dev1 = randomDeviceId("d1");
  const dev2 = randomDeviceId("d2");
  const dev3 = randomDeviceId("d3-blocked");

  assert.equal((await validateCode(codeA.code, dev1, DESKTOP_UA)).status, 200);
  assert.equal((await validateCode(codeA.code, dev2, MOBILE_UA)).status, 200);
  // dev1 switches off A → frees the desktop slot on A
  assert.equal((await validateCode(codeB.code, dev1, DESKTOP_UA)).status, 200);

  // dev3 (desktop) can now activate code A because dev1 freed the desktop slot
  assert.equal((await validateCode(codeA.code, dev3, DESKTOP_UA)).status, 200);

  // But a 4th desktop device on code A is still blocked
  const dev4 = randomDeviceId("d4-blocked");
  const blocked = await validateCode(codeA.code, dev4, DESKTOP_UA);
  assert.equal(blocked.status, 400);
  assert.match(await blocked.text(), /desktop slot|both device slots/i);
});

test("ensureUserIsolation client guard exists and triggers on userId change", () => {
  // Static check: the client must call ensureUserIsolation with deviceInfo.userId
  // and clearAllOfflineData must be invoked when the stored userId differs.
  const useAuthSrc = fs.readFileSync("client/src/hooks/use-auth.ts", "utf8");
  assert.match(useAuthSrc, /ensureUserIsolation\(deviceInfo\.userId\)/,
    "use-auth must call ensureUserIsolation with the resolved deviceInfo.userId");

  const indexedDbSrc = fs.readFileSync("client/src/lib/indexeddb.ts", "utf8");
  assert.match(indexedDbSrc, /clearAllOfflineData\(\)/,
    "indexeddb must invoke clearAllOfflineData when user changes");
  assert.match(indexedDbSrc, /storedUserId !== userId/,
    "isolation guard must compare stored userId to incoming userId");
});

test("seed dry-run does not output targetUserId equal to access code string", async () => {
  // Static check on the resolver: when --access-code is passed, the resolved
  // targetUserId must come from the user/sharedUserId chain, not be echoed back as the code.
  const seedSrc = fs.readFileSync("scripts/seed-field-test-simulation.ts", "utf8");
  assert.match(seedSrc, /resolveTargetUserId/,
    "seed script must export resolveTargetUserId helper");
  assert.match(seedSrc, /shared_?[Uu]ser_?[Ii]d/,
    "resolver must consult sharedUserId chain");
  assert.doesNotMatch(seedSrc, /targetUserId\s*=\s*accessCode\b/,
    "resolver must not echo the access code string as targetUserId");
});
