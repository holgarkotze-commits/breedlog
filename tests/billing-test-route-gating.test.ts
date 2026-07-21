import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const BASE_URL = "http://127.0.0.1:5014";
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

before(async () => {
  server = spawn(process.execPath, ["--import", "tsx/esm", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      USE_IN_MEMORY_STORAGE: "1",
      SESSION_SECRET: "dev-test-secret",
      ADMIN_PIN: "1234",
      PORT: "5014",
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

test("test billing routes are not exposed outside test mode", async () => {
  const simulate = await fetch(`${BASE_URL}/api/billing/test/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: "subscription.created" }),
  });
  assert.equal(simulate.status, 404);

  const complete = await fetch(`${BASE_URL}/api/billing/test/checkout/fake-session/complete`, {
    method: "POST",
  });
  assert.equal(complete.status, 404);
});

test("billing test-route gating can never be enabled in production", async () => {
  const { areBillingTestRoutesEnabled } = await import("../server/commercial");
  assert.equal(areBillingTestRoutesEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv), true);
  assert.equal(areBillingTestRoutesEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
  assert.equal(areBillingTestRoutesEnabled({ NODE_ENV: "development", BILLING_TEST_ROUTES: "1" } as NodeJS.ProcessEnv), true);
  // The critical case: an operator flag must not open the self-upgrade route in production.
  assert.equal(areBillingTestRoutesEnabled({ NODE_ENV: "production", BILLING_TEST_ROUTES: "1" } as NodeJS.ProcessEnv), false);
  assert.equal(areBillingTestRoutesEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
});

test("device status diagnostics do not disclose environment or database details", async () => {
  const response = await fetch(`${BASE_URL}/api/device/status`);
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.ok(!("dbHost" in body), "dbHost must not be exposed on the unauthenticated status endpoint");
  assert.ok(!("env" in body), "env must not be exposed on the unauthenticated status endpoint");
});
