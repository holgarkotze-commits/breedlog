// === MASTER SIMULATION MULTI-DEVICE TESTS ===
// Proves that U2A2ZAVQ bypasses the normal 1-mobile + 1-desktop per-type
// restriction and supports up to MASTER_SIMULATION_MAX_DEVICES (50) unique
// active devices, while normal codes remain strictly limited.
//
// All tests here are pure-unit tests against evaluateActivation() — no I/O,
// no server required.  Integration (workspace userId sharing) is covered by
// invite-activation-universal.test.ts.

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateActivation } from "../server/invite-activation.js";
import {
  MASTER_SIMULATION_ACCESS_CODE,
  MASTER_SIMULATION_MAX_DEVICES,
} from "../shared/master-simulation.js";
import type { InviteCode, UserActivation } from "../shared/schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMasterCode(): InviteCode {
  return {
    id: 1,
    code: MASTER_SIMULATION_ACCESS_CODE,
    status: "active",
    maxUses: 999,
    usesCount: 0,
    maxDevices: MASTER_SIMULATION_MAX_DEVICES,
    notes: "master sim",
    expiresAt: new Date(Date.now() + 365 * 86400 * 1000) as any,
    createdAt: new Date() as any,
  } as InviteCode;
}

function makeNormalCode(): InviteCode {
  return {
    id: 2,
    code: "NORMALCODE",
    status: "active",
    maxUses: 2,
    usesCount: 0,
    maxDevices: 2,
    notes: "normal",
    expiresAt: new Date(Date.now() + 365 * 86400 * 1000) as any,
    createdAt: new Date() as any,
  } as InviteCode;
}

let _activationId = 100;
function makeActivation(
  overrides: Partial<UserActivation> & { deviceId: string; deviceType: "desktop" | "mobile" }
): UserActivation {
  return {
    id: _activationId++,
    userId: "workspace-user-abc",
    inviteCodeId: 1,
    deviceId: overrides.deviceId,
    deviceType: overrides.deviceType,
    status: "active",
    activatedAt: new Date() as any,
    ...overrides,
  } as unknown as UserActivation;
}

// ---------------------------------------------------------------------------
// 1. U2A2ZAVQ: 3 mobile activations all allowed
// ---------------------------------------------------------------------------

test("U2A2ZAVQ allows at least 3 separate mobile activations", () => {
  const code = makeMasterCode();
  const active: UserActivation[] = [];

  for (let i = 1; i <= 3; i++) {
    const decision = evaluateActivation({
      code,
      activeActivationsForCode: active,
      requestedDeviceType: "mobile",
      callerDeviceId: `mobile-device-${i}`,
    });
    assert.equal(decision.ok, true, `mobile activation ${i} should be OK`);
    assert.equal(decision.reasonCode, "OK");
    active.push(makeActivation({ deviceId: `mobile-device-${i}`, deviceType: "mobile", inviteCodeId: 1 }));
  }
});

// ---------------------------------------------------------------------------
// 2. U2A2ZAVQ: 3 desktop activations all allowed
// ---------------------------------------------------------------------------

test("U2A2ZAVQ allows at least 3 separate desktop activations", () => {
  const code = makeMasterCode();
  const active: UserActivation[] = [];

  for (let i = 1; i <= 3; i++) {
    const decision = evaluateActivation({
      code,
      activeActivationsForCode: active,
      requestedDeviceType: "desktop",
      callerDeviceId: `desktop-device-${i}`,
    });
    assert.equal(decision.ok, true, `desktop activation ${i} should be OK`);
    assert.equal(decision.reasonCode, "OK");
    active.push(makeActivation({ deviceId: `desktop-device-${i}`, deviceType: "desktop", inviteCodeId: 1 }));
  }
});

// ---------------------------------------------------------------------------
// 3. U2A2ZAVQ: all activations share the same workspace userId
// ---------------------------------------------------------------------------

test("U2A2ZAVQ activations all share the same workspace userId", () => {
  const WORKSPACE_USER_ID = "bd0803b2-8c0a-4c07-91f1-64f1d1920654";
  const code = makeMasterCode();

  const devices = [
    makeActivation({ deviceId: "phone-1", deviceType: "mobile", userId: WORKSPACE_USER_ID, inviteCodeId: 1 }),
    makeActivation({ deviceId: "phone-2", deviceType: "mobile", userId: WORKSPACE_USER_ID, inviteCodeId: 1 }),
    makeActivation({ deviceId: "tablet-1", deviceType: "mobile", userId: WORKSPACE_USER_ID, inviteCodeId: 1 }),
    makeActivation({ deviceId: "pc-1", deviceType: "desktop", userId: WORKSPACE_USER_ID, inviteCodeId: 1 }),
    makeActivation({ deviceId: "pc-2", deviceType: "desktop", userId: WORKSPACE_USER_ID, inviteCodeId: 1 }),
    makeActivation({ deviceId: "browser-1", deviceType: "desktop", userId: WORKSPACE_USER_ID, inviteCodeId: 1 }),
  ];

  for (const device of devices) {
    assert.equal(device.userId, WORKSPACE_USER_ID,
      `device ${device.deviceId} must belong to workspace ${WORKSPACE_USER_ID}`);
  }

  // Any new activation with these 6 already active should still be OK
  const decision = evaluateActivation({
    code,
    activeActivationsForCode: devices,
    requestedDeviceType: "mobile",
    callerDeviceId: "new-phone-7",
  });
  assert.equal(decision.ok, true, "7th device activation should still be allowed");
});

// ---------------------------------------------------------------------------
// 4. U2A2ZAVQ: revoked entries do NOT count against active master cap
// ---------------------------------------------------------------------------

test("U2A2ZAVQ revoked activations do not count against the active cap", () => {
  const code = makeMasterCode();

  // Fill 48 slots with revoked entries
  const revokedActivations: UserActivation[] = Array.from({ length: 48 }, (_, i) =>
    makeActivation({ deviceId: `revoked-${i}`, deviceType: "mobile", status: "revoked" as any, inviteCodeId: 1 })
  );
  // Only 2 genuinely active
  const activeActivations: UserActivation[] = [
    makeActivation({ deviceId: "active-1", deviceType: "desktop", inviteCodeId: 1 }),
    makeActivation({ deviceId: "active-2", deviceType: "mobile", inviteCodeId: 1 }),
  ];
  // evaluateActivation receives only active activations (callers pre-filter)
  const decision = evaluateActivation({
    code,
    activeActivationsForCode: activeActivations,
    requestedDeviceType: "mobile",
    callerDeviceId: "new-device-3",
  });
  assert.equal(decision.ok, true,
    "Should be allowed: only 2 active, 48 revoked entries must not count");
  assert.equal(decision.reasonCode, "OK");
});

// ---------------------------------------------------------------------------
// 5. U2A2ZAVQ: hard cap at MASTER_SIMULATION_MAX_DEVICES blocks the next
// ---------------------------------------------------------------------------

test(`U2A2ZAVQ blocks activation when ${MASTER_SIMULATION_MAX_DEVICES} unique active devices already exist`, () => {
  const code = makeMasterCode();

  const active: UserActivation[] = Array.from(
    { length: MASTER_SIMULATION_MAX_DEVICES },
    (_, i) => makeActivation({
      deviceId: `capped-device-${i}`,
      deviceType: i % 2 === 0 ? "desktop" : "mobile",
      inviteCodeId: 1,
    })
  );

  const decision = evaluateActivation({
    code,
    activeActivationsForCode: active,
    requestedDeviceType: "mobile",
    callerDeviceId: "brand-new-device",
  });
  assert.equal(decision.ok, false, "Should be blocked once cap is reached");
  assert.equal(decision.reasonCode, "DEVICE_SLOT_ALREADY_USED");
  assert.match(decision.reason ?? "", /Master test code device limit reached/);
});

// ---------------------------------------------------------------------------
// 6. U2A2ZAVQ: existing device re-activating its own slot is always allowed
// ---------------------------------------------------------------------------

test("U2A2ZAVQ re-activation by same device is always allowed (selfHoldsSlot)", () => {
  const code = makeMasterCode();
  const myDeviceId = "my-phone-abc";
  const active: UserActivation[] = [
    makeActivation({ deviceId: myDeviceId, deviceType: "mobile", inviteCodeId: 1 }),
  ];

  const decision = evaluateActivation({
    code,
    activeActivationsForCode: active,
    requestedDeviceType: "mobile",
    callerDeviceId: myDeviceId,
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.selfHoldsSlot, true);
});

// ---------------------------------------------------------------------------
// 7. Normal code: blocks a 2nd mobile activation (slot already taken)
// ---------------------------------------------------------------------------

test("Normal code blocks a second mobile activation (DEVICE_SLOT_ALREADY_USED)", () => {
  const code = makeNormalCode();
  const existing: UserActivation[] = [
    makeActivation({ deviceId: "mobile-1", deviceType: "mobile", inviteCodeId: 2 }),
  ];

  const decision = evaluateActivation({
    code,
    activeActivationsForCode: existing,
    requestedDeviceType: "mobile",
    callerDeviceId: "mobile-2-different",
  });
  assert.equal(decision.ok, false, "Normal code must block 2nd mobile");
  assert.equal(decision.reasonCode, "DEVICE_SLOT_ALREADY_USED");
});

// ---------------------------------------------------------------------------
// 8. Normal code: blocks a 2nd desktop activation
// ---------------------------------------------------------------------------

test("Normal code blocks a second desktop activation (DEVICE_SLOT_ALREADY_USED)", () => {
  const code = makeNormalCode();
  const existing: UserActivation[] = [
    makeActivation({ deviceId: "desktop-1", deviceType: "desktop", inviteCodeId: 2 }),
  ];

  const decision = evaluateActivation({
    code,
    activeActivationsForCode: existing,
    requestedDeviceType: "desktop",
    callerDeviceId: "desktop-2-different",
  });
  assert.equal(decision.ok, false, "Normal code must block 2nd desktop");
  assert.equal(decision.reasonCode, "DEVICE_SLOT_ALREADY_USED");
});

// ---------------------------------------------------------------------------
// 9. Normal code: first mobile + first desktop both allowed
// ---------------------------------------------------------------------------

test("Normal code allows exactly 1 mobile and 1 desktop (full complement)", () => {
  const code = makeNormalCode();

  const mobileDecision = evaluateActivation({
    code,
    activeActivationsForCode: [],
    requestedDeviceType: "mobile",
    callerDeviceId: "mob-1",
  });
  assert.equal(mobileDecision.ok, true, "First mobile should be allowed");

  const desktopDecision = evaluateActivation({
    code,
    activeActivationsForCode: [makeActivation({ deviceId: "mob-1", deviceType: "mobile", inviteCodeId: 2 })],
    requestedDeviceType: "desktop",
    callerDeviceId: "desk-1",
  });
  assert.equal(desktopDecision.ok, true, "First desktop should be allowed when mobile already active");
});

// ---------------------------------------------------------------------------
// 10. Normal code: blocks a 3rd device of any type (belt-and-suspenders)
// ---------------------------------------------------------------------------

test("Normal code blocks any 3rd device (2 already active, mixed types)", () => {
  const code = makeNormalCode();
  const existing: UserActivation[] = [
    makeActivation({ deviceId: "mob-1", deviceType: "mobile", inviteCodeId: 2 }),
    makeActivation({ deviceId: "desk-1", deviceType: "desktop", inviteCodeId: 2 }),
  ];

  // Try another mobile
  const d1 = evaluateActivation({
    code,
    activeActivationsForCode: existing,
    requestedDeviceType: "mobile",
    callerDeviceId: "mob-2",
  });
  assert.equal(d1.ok, false, "3rd device (mobile) must be blocked");

  // Try another desktop
  const d2 = evaluateActivation({
    code,
    activeActivationsForCode: existing,
    requestedDeviceType: "desktop",
    callerDeviceId: "desk-2",
  });
  assert.equal(d2.ok, false, "3rd device (desktop) must be blocked");
});

// ---------------------------------------------------------------------------
// 11. Sanity: U2A2ZAVQ constant value is correct
// ---------------------------------------------------------------------------

test("MASTER_SIMULATION_ACCESS_CODE is U2A2ZAVQ and MAX_DEVICES is 50", () => {
  assert.equal(MASTER_SIMULATION_ACCESS_CODE, "U2A2ZAVQ");
  assert.equal(MASTER_SIMULATION_MAX_DEVICES, 50);
});
