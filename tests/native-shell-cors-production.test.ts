import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";

const BASE_URL = "http://127.0.0.1:5012";
const TAURI_ORIGIN = "https://tauri.localhost";
const require = createRequire(import.meta.url);

let server: ChildProcessWithoutNullStreams | null = null;
let logs = "";

function createServerProcess() {
  try {
    const tsxCli = require.resolve("tsx/dist/cli.mjs");
    return spawn(process.execPath, [tsxCli, "server/index.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        USE_IN_MEMORY_STORAGE: "1",
        SESSION_SECRET: "test-secret",
        ADMIN_PIN: "1234",
        PORT: "5012",
      },
      stdio: "pipe",
      windowsHide: true,
    });
  } catch {
    if (process.platform === "win32") {
      return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npx tsx server/index.ts"], {
        env: {
          ...process.env,
          NODE_ENV: "test",
          USE_IN_MEMORY_STORAGE: "1",
          SESSION_SECRET: "test-secret",
          ADMIN_PIN: "1234",
          PORT: "5012",
        },
        stdio: "pipe",
        windowsHide: true,
      });
    }

    return spawn("npx", ["tsx", "server/index.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        USE_IN_MEMORY_STORAGE: "1",
        SESSION_SECRET: "test-secret",
        ADMIN_PIN: "1234",
        PORT: "5012",
      },
      stdio: "pipe",
      windowsHide: true,
    });
  }
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
