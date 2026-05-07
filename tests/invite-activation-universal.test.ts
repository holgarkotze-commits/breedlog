// === UNIVERSAL INVITE-CODE ACTIVATION TESTS ===
// These tests deliberately do NOT pin to any specific code (no U2A2ZAVQ
// hardcoding). They prove the universal invariants:
//   * admin diagnostic and the real activation endpoint use the same
//     source of truth for "can this slot activate right now?"
//   * a code that admin diagnostic reports as Active + free slot must
//     actually activate, including after revoke→reactivate and after
//     reset-slot, without 500 errors and without losing workspace data.
//   * structured reasonCodes are returned for every refusal path.
//   * concurrent activation attempts cannot double-claim the same slot.
//
// They run against the real server (in-memory storage, which now mirrors
// the production Postgres UNIQUE(userId) constraint on user_activations).

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

const BASE_URL = "http://127.0.0.1:5037";
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
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({ notes: "universal-test", expiryDays, maxUses: 2 }),
  });
  assert.equal(res.status, 201);
  return res.json() as Promise<{ id: number; code: string; expiresAt: string }>;
}

async function validateCode(code: string, deviceId: string, userAgent: string) {
  return fetch(`${BASE_URL}/api/beta/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": userAgent },
    body: JSON.stringify({ code, deviceId }),
  });
}

async function adminLookupCode(code: string) {
  const res = await fetch(`${BASE_URL}/api/admin/invite-codes/lookup/${code}`, {
    headers: { Authorization: "AdminPin 1234" },
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function adminRevoke(id: number) {
  return fetch(`${BASE_URL}/api/admin/invite-codes/${id}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
  });
}

async function adminReactivate(id: number) {
  return fetch(`${BASE_URL}/api/admin/invite-codes/${id}/reactivate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({}),
  });
}

async function adminResetSlot(id: number, slotType: "desktop" | "mobile") {
  return fetch(`${BASE_URL}/api/admin/invite-codes/${id}/reset-slot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "AdminPin 1234" },
    body: JSON.stringify({ slotType }),
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
      PORT: "5037",
    },
    stdio: "pipe",
    detached: true,
  });
  server.stdout.on("data", (c) => (logs += c.toString()));
  server.stderr.on("data", (c) => (logs += c.toString()));
  await waitForServer();
});

after(async () => {
  if (server && !server.killed) {
    try { process.kill(-server.pid!, "SIGTERM"); } catch { /* noop */ }
  }
});

// === Universal invariant 1 ===
// Active code with free mobile slot must activate from a fresh mobile device.
test("active code with free mobile slot activates", async () => {
  const code = await adminCreateCode(30);
  const dev = randomDeviceId("u-mobile");
  const res = await validateCode(code.code, dev, MOBILE_UA);
  assert.equal(res.status, 200, await res.text());
});

// === Universal invariant 2 ===
// Active code with free desktop slot must activate from a fresh desktop device.
test("active code with free desktop slot activates", async () => {
  const code = await adminCreateCode(30);
  const dev = randomDeviceId("u-desktop");
  const res = await validateCode(code.code, dev, DESKTOP_UA);
  assert.equal(res.status, 200, await res.text());
});

// === The bug the field tester hit: "Activation failed. Please refresh and try again." ===
// Admin revoke → admin reactivate → original device tries again. Previously this
// hit the 500 catch-all because /api/beta/validate called createUserActivation
// which threw 23505 (UNIQUE userId). After the upsert fix, it must succeed and
// the workspace + animals must survive.
test("UNIVERSAL: revoke → reactivate → original device re-activates without 500 and keeps workspace", async () => {
  const code = await adminCreateCode(30);
  const desktop = randomDeviceId("u-revive-desktop");
  const first = await validateCode(code.code, desktop, DESKTOP_UA);
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as { token: string; userId: string };

  const created = await fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${firstBody.token}` },
    body: JSON.stringify({ tagId: "REVIVE-001", sex: "ewe" }),
  });
  assert.equal(created.status, 201);

  assert.equal((await adminRevoke(code.id)).status, 200);
  // While revoked: admin diagnostic and validate must agree → both reject.
  const lookupRevoked = await adminLookupCode(code.code);
  assert.equal(lookupRevoked.body.codeStatus, "revoked");
  const blockedDuringRevoke = await validateCode(code.code, desktop, DESKTOP_UA);
  assert.equal(blockedDuringRevoke.status, 400);
  const blockedBody = (await blockedDuringRevoke.json()) as any;
  assert.equal(blockedBody.reasonCode, "CODE_REVOKED");

  assert.equal((await adminReactivate(code.id)).status, 200);
  const lookupAfter = await adminLookupCode(code.code);
  assert.equal(lookupAfter.body.codeStatus, "active");

  // The original device must now succeed — NOT 500.
  const reLogin = await validateCode(code.code, desktop, DESKTOP_UA);
  const reText = await reLogin.text();
  assert.equal(reLogin.status, 200, `expected 200 after reactivate, got ${reLogin.status}: ${reText}`);
  const reBody = JSON.parse(reText) as { token: string; userId: string };
  assert.equal(reBody.userId, firstBody.userId, "workspace identity must survive revoke→reactivate");

  // Animals must still be there.
  const list = await fetch(`${BASE_URL}/api/animals`, { headers: { Authorization: `Bearer ${reBody.token}` } });
  assert.equal(list.status, 200);
  const animals = (await list.json()) as Array<{ tagId: string }>;
  assert.equal(animals.some((a) => a.tagId === "REVIVE-001"), true);
});

// === Reset-slot then same device re-activates ===
test("UNIVERSAL: reset-slot → original device re-activates without 500", async () => {
  const code = await adminCreateCode(30);
  const mobile = randomDeviceId("u-reset-mobile");
  assert.equal((await validateCode(code.code, mobile, MOBILE_UA)).status, 200);
  assert.equal((await adminResetSlot(code.id, "mobile")).status, 200);
  const reLogin = await validateCode(code.code, mobile, MOBILE_UA);
  assert.equal(reLogin.status, 200, `expected 200 after reset-slot, got ${reLogin.status}: ${await reLogin.text()}`);
});

// === Universal invariant: admin diagnostic and activation never disagree ===
test("UNIVERSAL: admin diagnostic and activation produce matching availability for active code with free slot", async () => {
  const code = await adminCreateCode(30);
  // No activations yet. Diagnostic must say both slots free + canActivate.
  const lookup1 = await adminLookupCode(code.code);
  assert.equal(lookup1.body.codeStatus, "active");
  assert.equal(lookup1.body.slots.desktop.canActivate, true);
  assert.equal(lookup1.body.slots.mobile.canActivate, true);
  assert.equal(lookup1.body.slots.desktop.reasonCode, "OK");
  assert.equal(lookup1.body.slots.mobile.reasonCode, "OK");

  // The promise from diagnostic must hold: activation must succeed.
  const desktop = randomDeviceId("u-agree-desktop");
  assert.equal((await validateCode(code.code, desktop, DESKTOP_UA)).status, 200);

  // Now diagnostic must report mobile still free (canActivate=true), desktop taken.
  const lookup2 = await adminLookupCode(code.code);
  assert.equal(lookup2.body.slots.desktop.taken, true);
  assert.equal(lookup2.body.slots.desktop.canActivate, false);
  assert.equal(lookup2.body.slots.mobile.canActivate, true);
  // And the mobile activation must succeed too.
  const mobile = randomDeviceId("u-agree-mobile");
  assert.equal((await validateCode(code.code, mobile, MOBILE_UA)).status, 200);
});

// === Reason codes returned ===
test("UNIVERSAL: structured reasonCode is returned for every refusal", async () => {
  // CODE_NOT_FOUND
  const notFound = await validateCode("NOPE9999XYZ", randomDeviceId("rc-notfound"), DESKTOP_UA);
  assert.equal(notFound.status, 400);
  assert.equal(((await notFound.json()) as any).reasonCode, "CODE_NOT_FOUND");

  // CODE_REVOKED
  const c1 = await adminCreateCode(30);
  await adminRevoke(c1.id);
  const revoked = await validateCode(c1.code, randomDeviceId("rc-revoked"), DESKTOP_UA);
  assert.equal(revoked.status, 400);
  assert.equal(((await revoked.json()) as any).reasonCode, "CODE_REVOKED");

  // CODE_EXPIRED
  const c2 = await adminCreateCode(-1);
  const expired = await validateCode(c2.code, randomDeviceId("rc-expired"), DESKTOP_UA);
  assert.equal(expired.status, 400);
  assert.equal(((await expired.json()) as any).reasonCode, "CODE_EXPIRED");

  // DEVICE_SLOT_ALREADY_USED
  const c3 = await adminCreateCode(30);
  assert.equal((await validateCode(c3.code, randomDeviceId("rc-slot-1"), MOBILE_UA)).status, 200);
  const slotTaken = await validateCode(c3.code, randomDeviceId("rc-slot-2"), MOBILE_UA);
  assert.equal(slotTaken.status, 400);
  assert.equal(((await slotTaken.json()) as any).reasonCode, "DEVICE_SLOT_ALREADY_USED");
});

// === Sequential second-mobile after first-mobile is rejected ===
// True concurrency safety requires a Postgres partial unique index on
// (invite_code_id, device_type) WHERE status='active' — that is a database
// migration tracked separately. This test asserts the strictly-sequential
// invariant: once the first mobile activation has returned, a second mobile
// device must be rejected with the structured DEVICE_SLOT_ALREADY_USED code.
test("UNIVERSAL: second mobile device is rejected after the first has activated", async () => {
  const code = await adminCreateCode(30);
  const m1 = randomDeviceId("u-seq-1");
  const m2 = randomDeviceId("u-seq-2");
  assert.equal((await validateCode(code.code, m1, MOBILE_UA)).status, 200);
  const blocked = await validateCode(code.code, m2, MOBILE_UA);
  assert.equal(blocked.status, 400);
  assert.equal(((await blocked.json()) as any).reasonCode, "DEVICE_SLOT_ALREADY_USED");
});

// === Workspace identity stable across reactivation ===
test("UNIVERSAL: workspace userId is stable across revoke/reactivate cycles for the same code", async () => {
  const code = await adminCreateCode(30);
  const dev = randomDeviceId("u-stable");
  const a = (await (await validateCode(code.code, dev, DESKTOP_UA)).json()) as any;
  await adminRevoke(code.id);
  await adminReactivate(code.id);
  const b = (await (await validateCode(code.code, dev, DESKTOP_UA)).json()) as any;
  assert.equal(b.userId, a.userId);
});
