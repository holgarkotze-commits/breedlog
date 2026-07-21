import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const BASE_URL = "http://127.0.0.1:5011";
let server: ChildProcessWithoutNullStreams | null = null;
let logs = "";

async function waitForServer(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/version`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready.\n${logs}`);
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-test-user-id": "downgrade-route-user",
    "x-test-device-id": "downgrade-route-device",
  };
}

async function resetData() {
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirmPhrase: "RESET BREEDLOG" }),
  });
}

async function upgradeToPremium() {
  const checkoutRes = await fetch(`${BASE_URL}/api/billing/checkout-session`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ productCode: "premium_monthly" }),
  });
  assert.equal(checkoutRes.status, 201);
  const checkout = await checkoutRes.json() as { sessionId: string };
  const completeRes = await fetch(`${BASE_URL}/api/billing/test/checkout/${checkout.sessionId}/complete`, {
    method: "POST",
    headers: authHeaders(),
  });
  assert.equal(completeRes.status, 200);
}

before(async () => {
  server = spawn(process.execPath, ["--import", "tsx/esm", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      USE_IN_MEMORY_STORAGE: "1",
      SESSION_SECRET: "test-secret",
      ADMIN_PIN: "1234",
      PORT: "5011",
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
    try {
      if (process.platform === "win32") server.kill("SIGTERM");
      else process.kill(-server.pid!, "SIGTERM");
    } catch {
      try { server.kill("SIGTERM"); } catch {}
    }
  }
});

test("free downgrade hides later animals and their related records from ordinary API queries", async () => {
  await resetData();
  await upgradeToPremium();

  const createdIds: number[] = [];
  for (let index = 1; index <= 40; index += 1) {
    const response = await fetch(`${BASE_URL}/api/animals`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ tagId: `API-${String(index).padStart(4, "0")}`, sex: index % 2 === 0 ? "ewe" : "ram", status: "active" }),
    });
    assert.equal(response.status, 201);
    createdIds.push((await response.json()).id);
  }

  const hiddenAnimalId = createdIds[30];
  const visibleAnimalId = createdIds[0];

  let response = await fetch(`${BASE_URL}/api/performance-records`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ animalId: hiddenAnimalId, date: "2026-07-14", type: "weighing", weight: "70.1" }),
  });
  assert.equal(response.status, 201);

  response = await fetch(`${BASE_URL}/api/health-records`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ animalId: hiddenAnimalId, date: "2026-07-14", type: "treatment", treatment: "Hidden treatment" }),
  });
  assert.equal(response.status, 201);

  response = await fetch(`${BASE_URL}/api/breeding-events`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ eweId: hiddenAnimalId, ramId: visibleAnimalId, matingDate: "2026-07-14", matingType: "natural" }),
  });
  assert.equal(response.status, 201);

  response = await fetch(`${BASE_URL}/api/billing/test/simulate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ eventType: "subscription.refunded" }),
  });
  assert.equal(response.status, 200);

  const animalListRes = await fetch(`${BASE_URL}/api/animals`, { headers: authHeaders() });
  const animals = await animalListRes.json() as Array<{ id: number; tagId: string }>;
  assert.equal(animals.length, 30);
  assert.ok(!animals.some((animalRow) => animalRow.id === hiddenAnimalId));

  const hiddenAnimalRes = await fetch(`${BASE_URL}/api/animals/${hiddenAnimalId}`, { headers: authHeaders() });
  assert.equal(hiddenAnimalRes.status, 404);

  const hiddenHealthRes = await fetch(`${BASE_URL}/api/animals/${hiddenAnimalId}/health`, { headers: authHeaders() });
  assert.equal(hiddenHealthRes.status, 404);

  const performanceListRes = await fetch(`${BASE_URL}/api/performance-records`, { headers: authHeaders() });
  const performanceRecords = await performanceListRes.json() as Array<{ animalId: number }>;
  assert.ok(!performanceRecords.some((record) => record.animalId === hiddenAnimalId));

  const healthListRes = await fetch(`${BASE_URL}/api/health-records`, { headers: authHeaders() });
  const healthRecords = await healthListRes.json() as Array<{ animalId: number }>;
  assert.ok(!healthRecords.some((record) => record.animalId === hiddenAnimalId));

  const entitlementsRes = await fetch(`${BASE_URL}/api/entitlements/me`, { headers: authHeaders() });
  const entitlements = await entitlementsRes.json() as { downgradeProjection: { hiddenAnimalIds: number[]; visibleAnimalIds: number[] } };
  assert.equal(entitlements.downgradeProjection.visibleAnimalIds.length, 30);
  assert.equal(entitlements.downgradeProjection.hiddenAnimalIds.length, 10);
});

test("free downgrade also hides animals from evaluations, genetics, and mating-risk routes", async () => {
  await resetData();
  await upgradeToPremium();

  const createdIds: number[] = [];
  for (let index = 1; index <= 32; index += 1) {
    const response = await fetch(`${BASE_URL}/api/animals`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ tagId: `GEN-${String(index).padStart(4, "0")}`, sex: index % 2 === 0 ? "ewe" : "ram", status: "active" }),
    });
    assert.equal(response.status, 201);
    createdIds.push((await response.json()).id);
  }

  const hiddenAnimalId = createdIds[31];
  const visibleRamId = createdIds[0];

  const downgradeRes = await fetch(`${BASE_URL}/api/billing/test/simulate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ eventType: "subscription.refunded" }),
  });
  assert.equal(downgradeRes.status, 200);

  const evalListRes = await fetch(`${BASE_URL}/api/animals/${hiddenAnimalId}/evaluations`, { headers: authHeaders() });
  assert.equal(evalListRes.status, 404, "evaluation list must not expose hidden animals");

  const evalCreateRes = await fetch(`${BASE_URL}/api/evaluations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ animalId: hiddenAnimalId, evaluator: "manual", comments: "hidden animal evaluation" }),
  });
  assert.equal(evalCreateRes.status, 404, "evaluation create must not accept hidden animals");

  const bloodlineListRes = await fetch(`${BASE_URL}/api/genetics/animal/${hiddenAnimalId}/bloodlines`, { headers: authHeaders() });
  assert.equal(bloodlineListRes.status, 404, "animal bloodline list must not expose hidden animals");

  const bloodlineSetRes = await fetch(`${BASE_URL}/api/genetics/animal/${hiddenAnimalId}/bloodlines`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ bloodlineId: 1 }),
  });
  assert.equal(bloodlineSetRes.status, 404, "animal bloodline assignment must not accept hidden animals");

  const matingRiskRes = await fetch(`${BASE_URL}/api/genetics/mating-risk`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ramId: visibleRamId, eweId: hiddenAnimalId }),
  });
  assert.equal(matingRiskRes.status, 404, "mating-risk must not evaluate hidden animals");

  const visibleEvalRes = await fetch(`${BASE_URL}/api/animals/${visibleRamId}/evaluations`, { headers: authHeaders() });
  assert.equal(visibleEvalRes.status, 200, "visible animals keep full evaluation access");
});
