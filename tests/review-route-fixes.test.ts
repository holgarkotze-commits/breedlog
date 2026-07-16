import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { createHmac } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const BASE_URL = "http://127.0.0.1:5013";
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

function testHeaders(userId: string, deviceId: string) {
  return {
    "Content-Type": "application/json",
    "x-test-user-id": userId,
    "x-test-device-id": deviceId,
  };
}

function bearerHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function registerDevice(deviceId: string, deviceName: string) {
  const response = await fetch(`${BASE_URL}/api/device/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, deviceName }),
  });
  assert.equal(response.status, 200);
  return await response.json() as { token: string; userId: string; deviceId: string };
}

before(async () => {
  server = spawn(process.execPath, ["--import", "tsx/esm", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      USE_IN_MEMORY_STORAGE: "1",
      SESSION_SECRET: "test-secret",
      BILLING_WEBHOOK_SECRET: "webhook-secret",
      ADMIN_PIN: "1234",
      PORT: "5013",
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

test("billing webhook verification uses the captured raw request body", async () => {
  const rawBody = JSON.stringify({
    providerEventId: "evt-raw-body-1",
    accountId: "webhook-raw-body-account",
    eventType: "subscription.created",
    planId: "premium",
  }, null, 2);
  const signature = createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");

  let response = await fetch(`${BASE_URL}/api/billing/webhook/test-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BreedLog-Signature": signature,
    },
    body: rawBody,
  });
  assert.equal(response.status, 202);

  response = await fetch(`${BASE_URL}/api/billing/webhook/test-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BreedLog-Signature": signature,
    },
    body: rawBody,
  });
  assert.equal(response.status, 200);
});

test("individual PDF quota is inferred and enforced even when quotaClass is omitted", async () => {
  const userId = "export-quota-user";
  const deviceId = "export-quota-device";
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ confirmPhrase: "RESET BREEDLOG" }),
  });

  const animalResponse = await fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ tagId: "EXP-0001", sex: "ewe", status: "active" }),
  });
  assert.equal(animalResponse.status, 201);
  const animal = await animalResponse.json() as { id: number };

  for (let index = 0; index < 5; index += 1) {
    const response = await fetch(`${BASE_URL}/api/exported-documents`, {
      method: "POST",
      headers: testHeaders(userId, deviceId),
      body: JSON.stringify({
        name: `animal-${index}.pdf`,
        documentType: "individual",
        subfolder: "individual",
        animalId: animal.id,
        metadata: {
          exportType: "pdf",
          animalCount: 1,
          status: "success",
        },
      }),
    });
    assert.equal(response.status, 201);
  }

  const blocked = await fetch(`${BASE_URL}/api/exported-documents`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({
      name: "animal-6.pdf",
      documentType: "individual",
      subfolder: "individual",
      animalId: animal.id,
      metadata: {
        exportType: "pdf",
        animalCount: 1,
        status: "success",
      },
    }),
  });
  assert.equal(blocked.status, 403);
});

test("CSV import enforces the active animal limit for Free accounts", async () => {
  const userId = "csv-cap-user";
  const deviceId = "csv-cap-device";
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ confirmPhrase: "RESET BREEDLOG" }),
  });

  const csvRows = ["tagId,sex,status"];
  for (let index = 1; index <= 31; index += 1) {
    csvRows.push(`CSV-${String(index).padStart(4, "0")},ewe,active`);
  }

  const response = await fetch(`${BASE_URL}/api/import/csv`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ csvData: csvRows.join("\n") }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as { created: number; failed: number; errors: string[] };
  assert.equal(body.created, 30);
  assert.equal(body.failed, 1);
  assert.match(body.errors[0], /Free accounts are limited to 30 active animals/);

  const animals = await fetch(`${BASE_URL}/api/animals`, {
    headers: testHeaders(userId, deviceId),
  });
  assert.equal(animals.status, 200);
  assert.equal((await animals.json() as Array<unknown>).length, 30);
});

test("reactivating an inactive animal cannot bypass the Free active-animal cap", async () => {
  const userId = "reactivation-cap-user";
  const deviceId = "reactivation-cap-device";
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ confirmPhrase: "RESET BREEDLOG" }),
  });

  let response = await fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ tagId: "REACT-0000", sex: "ewe", status: "inactive" }),
  });
  assert.equal(response.status, 201);
  const inactiveAnimal = await response.json() as { id: number };

  for (let index = 1; index <= 30; index += 1) {
    response = await fetch(`${BASE_URL}/api/animals`, {
      method: "POST",
      headers: testHeaders(userId, deviceId),
      body: JSON.stringify({
        tagId: `REACT-${String(index).padStart(4, "0")}`,
        sex: "ewe",
        status: "active",
      }),
    });
    assert.equal(response.status, 201);
  }

  response = await fetch(`${BASE_URL}/api/animals/${inactiveAnimal.id}`, {
    method: "PUT",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ status: "active" }),
  });
  assert.equal(response.status, 403);
  const body = await response.json() as { code: string; message: string };
  assert.equal(body.code, "ACTIVE_ANIMAL_LIMIT_REACHED");

  const animals = await fetch(`${BASE_URL}/api/animals`, {
    headers: testHeaders(userId, deviceId),
  });
  assert.equal(animals.status, 200);
  const rows = await animals.json() as Array<{ status?: string }>;
  assert.equal(rows.filter((animal) => (animal.status ?? "active") === "active").length, 30);
});

test("revoked managed-device tokens can no longer authenticate protected requests", async () => {
  const email = "revoked-managed-device@example.com";
  const password = "VerySecurePass9";
  const primaryDeviceId = "managed-device-primary-1234567890123456";
  const secondaryDeviceId = "managed-device-second-1234567890123456";

  const primary = await registerDevice(primaryDeviceId, "Primary Device");
  let response = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: bearerHeaders(primary.token),
    body: JSON.stringify({
      email,
      password,
      deviceName: "Primary Device",
      platform: "windows",
    }),
  });
  assert.equal(response.status, 201);
  const registerBody = await response.json() as { profile: { accountId: string; workspaceUserId: string } };
  const accountId = registerBody.profile.workspaceUserId;

  const rawBody = JSON.stringify({
    providerEventId: "evt-managed-device-premium",
    accountId,
    eventType: "subscription.created",
    planId: "premium",
  });
  const signature = createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");
  response = await fetch(`${BASE_URL}/api/billing/webhook/test-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BreedLog-Signature": signature,
    },
    body: rawBody,
  });
  assert.equal(response.status, 202);

  const secondary = await registerDevice(secondaryDeviceId, "Secondary Device");
  response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: bearerHeaders(secondary.token),
    body: JSON.stringify({
      email,
      password,
      deviceName: "Secondary Device",
      platform: "android",
    }),
  });
  assert.equal(response.status, 200);

  response = await fetch(`${BASE_URL}/api/auth/devices/revoke`, {
    method: "POST",
    headers: bearerHeaders(primary.token),
    body: JSON.stringify({ deviceId: secondaryDeviceId }),
  });
  assert.equal(response.status, 200);

  response = await fetch(`${BASE_URL}/api/animals`, {
    headers: bearerHeaders(secondary.token),
  });
  assert.equal(response.status, 401);

  response = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: bearerHeaders(secondary.token),
  });
  assert.equal(response.status, 401);

  response = await fetch(`${BASE_URL}/api/auth/devices/revoke`, {
    method: "POST",
    headers: bearerHeaders(secondary.token),
    body: JSON.stringify({ deviceId: primaryDeviceId }),
  });
  assert.equal(response.status, 401);
});

test("hidden-animal EID scans do not leak matched animal identifiers into scan events", async () => {
  const userId = "eid-hidden-user";
  const deviceId = "eid-hidden-device";
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({ confirmPhrase: "RESET BREEDLOG" }),
  });

  let rawBody = JSON.stringify({
    providerEventId: "evt-hidden-eid-premium",
    accountId: userId,
    eventType: "subscription.created",
    planId: "premium",
  });
  let signature = createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");
  let response = await fetch(`${BASE_URL}/api/billing/webhook/test-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BreedLog-Signature": signature,
    },
    body: rawBody,
  });
  assert.equal(response.status, 202);

  for (let index = 1; index <= 31; index += 1) {
    response = await fetch(`${BASE_URL}/api/animals`, {
      method: "POST",
      headers: testHeaders(userId, deviceId),
      body: JSON.stringify({
        tagId: `EID-${String(index).padStart(4, "0")}`,
        electronicId: `9820000000000${String(index).padStart(3, "0")}`,
        sex: "ewe",
        status: "active",
      }),
    });
    assert.equal(response.status, 201);
  }

  rawBody = JSON.stringify({
    providerEventId: "evt-hidden-eid-cancel",
    accountId: userId,
    eventType: "subscription.cancelled",
    planId: "premium",
  });
  signature = createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");
  response = await fetch(`${BASE_URL}/api/billing/webhook/test-provider`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BreedLog-Signature": signature,
    },
    body: rawBody,
  });
  assert.equal(response.status, 202);

  response = await fetch(`${BASE_URL}/api/eid/scan`, {
    method: "POST",
    headers: testHeaders(userId, deviceId),
    body: JSON.stringify({
      electronicIdRaw: "9820000000000031",
      readerSource: "test-reader",
    }),
  });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    matched: boolean;
    animal: unknown;
    scanEvent: { animalId: number | null; matched: boolean; matchMethod: string | null };
  };
  assert.equal(body.matched, false);
  assert.equal(body.animal, null);
  assert.equal(body.scanEvent.animalId, null);
  assert.equal(body.scanEvent.matched, false);
  assert.equal(body.scanEvent.matchMethod, null);
});
