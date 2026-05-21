import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateActivation } from "../server/invite-activation.ts";
import { MASTER_SIMULATION_ACCESS_CODE, MASTER_SIMULATION_BATCH_MARKER } from "../shared/master-simulation.ts";

test("master simulation constants are centralized", () => {
  assert.equal(MASTER_SIMULATION_ACCESS_CODE, "U2A2ZAVQ");
  assert.equal(MASTER_SIMULATION_BATCH_MARKER, "KWANTAM_SIMULATION_2022_TO_2026_V1");
});

test("master code allows multi-device while normal code remains slot-limited", () => {
  const baseCode: any = { id: 1, code: MASTER_SIMULATION_ACCESS_CODE, status: "active", expiresAt: "2099-01-01" };
  const many = Array.from({ length: 6 }, (_, i) => ({ deviceId: `d-${i}`, deviceType: i % 2 ? "mobile" : "desktop", status: "active" }));
  const okMaster = evaluateActivation({ code: baseCode, activeActivationsForCode: many as any, requestedDeviceType: "mobile", callerDeviceId: "new-device" });
  assert.equal(okMaster.ok, true);

  const normalCode: any = { ...baseCode, code: "ABCD1234" };
  const blocked = evaluateActivation({ code: normalCode, activeActivationsForCode: [{ deviceId: "m1", deviceType: "mobile", status: "active" }] as any, requestedDeviceType: "mobile", callerDeviceId: "m2" });
  assert.equal(blocked.ok, false);
});

test("routes gate simulation seed to master code and include full dataset record types", () => {
  const src = fs.readFileSync("server/routes.ts", "utf8");
  assert.match(src, /if \(!isMasterSimulationCode\(code\)\) return;/);
  assert.match(src, /MASTER_SIMULATION_BATCH_MARKER/);
  assert.match(src, /createAnimal\(/);
  assert.match(src, /createMatingGroup\(/);
  assert.match(src, /createBreedingEvent\(/);
  assert.match(src, /createHealthRecord\(/);
  assert.match(src, /createFlockHealthEvent\(/);
  assert.match(src, /createFlockHealthTreatments\(/);
});

test("master code bypasses 2-device final safety, normal code remains enforced", () => {
  const src = fs.readFileSync("server/routes.ts", "utf8");
  assert.match(src, /!isMasterSimulationCode\(inviteCode!\.code\) && activeOtherDevices >= 2/);
});

test("reset/reseed script is explicit, dry-run-first, and locked to master code", () => {
  const src = fs.readFileSync("scripts/reset-master-simulation-workspace.ts", "utf8");
  assert.match(src, /MASTER_SIMULATION_ACCESS_CODE/);
  assert.match(src, /--confirm-master-simulation-reset/);
  assert.match(src, /if \(!apply\) return console\.log/);
  assert.match(src, /resolvedWorkspaceUserId/);
  assert.match(src, /targetAccessCode/);
});

test("tablet readiness checks include key screens and breakpoints", () => {
  const animals = fs.readFileSync("client/src/pages/Animals.tsx", "utf8");
  const lambs = fs.readFileSync("client/src/pages/Lambs.tsx", "utf8");
  const detail = fs.readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");
  const assistant = fs.readFileSync("client/src/components/BreedLogAssistantPanel.tsx", "utf8");
  const dashboard = fs.readFileSync("client/src/pages/Dashboard.tsx", "utf8");
  assert.match(animals, /md:|lg:/);
  assert.match(lambs, /md:|lg:/);
  assert.match(detail, /md:|lg:/);
  assert.match(assistant, /md:|100dvh/);
  assert.match(dashboard, /BottomNavigation|Header|md:/);
});
