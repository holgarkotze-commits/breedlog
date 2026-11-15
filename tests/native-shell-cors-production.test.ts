import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";

const BASE_URL = "http://127.0.0.1:5012";
const TAURI_ORIGIN = "https://tauri.localhost";
const PRODUCTION_ORIGIN = "https://breedlog.stitchworx.net";
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

let server: ChildProcessWithoutNullStreams | null = null;
let logs = "";

function createServerProcess() {
  return spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      USE_IN_MEMORY_STORAGE: "1",
      SESSION_SECRET: "test-secret",
      ADMIN_PIN: "1234",
      PORT: "5012",
    },
    cwd: REPO_ROOT,
    stdio: "pipe",
    windowsHide: true,
  });
}

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready. Logs:\n${logs}`);
}

before(async () => {
  server = createServerProcess();

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
    try {
      server.kill("SIGTERM");
      await Promise.race([
        once(server, "exit"),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      if (server.exitCode === null && server.signalCode === null) {
        server.kill("SIGKILL");
        await Promise.race([
          once(server, "exit"),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      }
    } catch {
      try { server.kill("SIGKILL"); } catch { /* process already exited */ }
    }
  }
});

test("native shell preflight receives the trusted CORS contract", async () => {
  const response = await fetch(`${BASE_URL}/api/beta/validate`, {
    method: "OPTIONS",
    headers: {
      Origin: TAURI_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), TAURI_ORIGIN);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /Content-Type/i);
});

test("actual Android default origin receives credentialed CORS", async () => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "OPTIONS", headers: { Origin: "https://localhost", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://localhost");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("secure native account sessions work while web and untrusted-origin CSRF protection remains", async () => {
  for (const origin of ["https://localhost", TAURI_ORIGIN]) {
    const headers = { "Content-Type": "application/json", Origin: origin, "Sec-Fetch-Site": "cross-site", "X-Forwarded-Proto": "https" };
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST", headers,
      body: JSON.stringify({ email: `native-${crypto.randomUUID()}@example.test`, password: "Native-session-test-password", acceptedTerms: true }),
    });
    assert.equal(response.status, 201, origin);
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=None/);
    const session = cookie.split(";")[0];
    const created = await fetch(`${BASE_URL}/api/animals`, {
      method: "POST", headers: { ...headers, Cookie: session }, body: JSON.stringify({ tagId: `NATIVE-${origin}`, sex: "ewe" }),
    });
    assert.equal(created.status, 201);
    const before = await (await fetch(`${BASE_URL}/api/animals`, { headers: { ...headers, Cookie: session } })).json();
    assert.equal(before.length, 1);
    for (const badOrigin of ["https://evil.example", "https://localhost.evil.example", "null"]) {
      const denied = await fetch(`${BASE_URL}/api/animals`, {
        method: "POST", headers: { ...headers, Cookie: session, Origin: badOrigin }, body: JSON.stringify({ tagId: "FORGED", sex: "ewe" }),
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
    }
    const form = await fetch(`${BASE_URL}/api/animals`, { method: "POST", headers: { ...headers, Cookie: session, "Content-Type": "text/plain" }, body: "forged" });
    assert.equal(form.status, 415);
    const after = await (await fetch(`${BASE_URL}/api/animals`, { headers: { ...headers, Cookie: session } })).json();
    assert.deepEqual(after, before);
  }
});

test("production app preflight receives the trusted credentialed CORS contract", async () => {
  const response = await fetch(`${BASE_URL}/api/version`, {
    method: "OPTIONS",
    headers: {
      Origin: PRODUCTION_ORIGIN,
      "Access-Control-Request-Method": "GET",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), PRODUCTION_ORIGIN);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("native shell write preflight allows the idempotency header used by create flows", async () => {
  const response = await fetch(`${BASE_URL}/api/animals`, {
    method: "OPTIONS",
    headers: {
      Origin: TAURI_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type,x-idempotency-key",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), TAURI_ORIGIN);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /Authorization/i);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /Content-Type/i);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /X-Idempotency-Key/i);
});

test("native shell auth bootstrap preflight allows the device token header used on restart", async () => {
  const response = await fetch(`${BASE_URL}/api/device/info`, {
    method: "OPTIONS",
    headers: {
      Origin: TAURI_ORIGIN,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "x-device-token",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), TAURI_ORIGIN);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /X-Device-Token/i);
});

test("native shell version preflight allows cache-control for startup cache busting", async () => {
  const response = await fetch(`${BASE_URL}/api/version`, {
    method: "OPTIONS",
    headers: {
      Origin: TAURI_ORIGIN,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "cache-control",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), TAURI_ORIGIN);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /Cache-Control/i);
});

test("native shell validate responses preserve the trusted CORS origin", async () => {
  const createCode = await fetch(`${BASE_URL}/api/admin/invite-codes`, {
    method: "POST",
    headers: {
      Authorization: "AdminPin 1234",
      "Content-Type": "application/json",
      Origin: TAURI_ORIGIN,
    },
    body: JSON.stringify({ notes: "native-cors", expiryDays: 30, maxUses: 2 }),
  });
  assert.equal(createCode.status, 201);
  const created = await createCode.json() as { code?: string };
  const inviteCode = String(created.code ?? "");
  assert.ok(inviteCode.length >= 6);

  const response = await fetch(`${BASE_URL}/api/beta/validate`, {
    method: "POST",
    headers: {
      Origin: TAURI_ORIGIN,
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    body: JSON.stringify({ code: inviteCode, deviceId: "native-cors-desktop" }),
  });

  assert.equal(response.status, 400);
  assert.equal(response.headers.get("access-control-allow-origin"), TAURI_ORIGIN);
  const payload = await response.json() as { message?: string };
  assert.match(payload.message ?? "", /device id/i);
});
