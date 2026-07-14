import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const BASE_URL = "http://127.0.0.1:5012";
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
    "x-test-user-id": "deletion-route-user",
    "x-test-device-id": "deletion-route-device",
  };
}

async function resetData() {
  await fetch(`${BASE_URL}/api/reset-all-data`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ confirmPhrase: "RESET BREEDLOG" }),
  });
}

before(async () => {
  server = spawn(process.execPath, ["--import", "tsx/esm", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      USE_IN_MEMORY_STORAGE: "1",
      SESSION_SECRET: "test-secret",
      ADMIN_PIN: "1234",
      PORT: "5012",
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

test("pending account deletion suspends ordinary access until cancellation", async () => {
  await resetData();

  let response = await fetch(`${BASE_URL}/api/animals`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ tagId: "DEL-ROUTE-001", sex: "ewe", status: "active" }),
  });
  assert.equal(response.status, 201);

  response = await fetch(`${BASE_URL}/api/account/deletion`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ typedConfirmation: "DELETE MY BREEDLOG ACCOUNT" }),
  });
  assert.equal(response.status, 202);

  const blockedAnimals = await fetch(`${BASE_URL}/api/animals`, { headers: authHeaders() });
  assert.equal(blockedAnimals.status, 423);

  const deletionState = await fetch(`${BASE_URL}/api/account/deletion`, { headers: authHeaders() });
  assert.equal(deletionState.status, 200);
  assert.equal((await deletionState.json()).status, "pending");

  const cancelled = await fetch(`${BASE_URL}/api/account/deletion/cancel`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  assert.equal(cancelled.status, 200);

  const animalsAfterCancel = await fetch(`${BASE_URL}/api/animals`, { headers: authHeaders() });
  assert.equal(animalsAfterCancel.status, 200);
  assert.equal((await animalsAfterCancel.json()).length, 1);
});
