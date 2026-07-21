// === SECURITY & STABILITY HARDENING TESTS ===
// Covers the fixes from the repo security review:
//   * Replit-template AI routes (/api/conversations*, /api/generate-image,
//     voice-stream) are no longer registered — they were unauthenticated and
//     leaked a global conversation list across users.
//   * The authenticated BreedLog AI surface (/api/ai/chat) rejects
//     unauthenticated callers.
//   * Production boot fails fast when SESSION_SECRET is missing (no
//     predictable fallback secret in production).
//   * Token/PIN comparisons are constant-time (unit-tested helpers).
//   * Concurrent server startups do not race in the startup migrations
//     (advisory-lock regression test — exercises real Postgres in CI).
//   * The simple CSV import endpoint survives bad rows instead of 500ing
//     mid-import after partial writes.

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { getSessionSecret, safeCompare, isAdminPinHeaderValid } from "../server/device-auth";

const PORT = 5041;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let server: ChildProcessWithoutNullStreams | null = null;
let logs = "";

function spawnServer(port: number, envOverrides: Record<string, string | undefined> = {}): ChildProcessWithoutNullStreams {
  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_ENV: "test",
    USE_IN_MEMORY_STORAGE: "1",
    PORT: String(port),
    ADMIN_PIN: "1234",
    SESSION_SECRET: "test-secret-security-hardening",
    ...envOverrides,
  };
  for (const key of Object.keys(env)) {
    if (env[key] === undefined) delete env[key];
  }
  return spawn(process.execPath, ["--import", "tsx/esm", "server/index.ts"], {
    env: env as NodeJS.ProcessEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForServer(baseUrl: string, capture: () => string, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms. Logs:\n${capture()}`);
}

async function registerDevice(deviceId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/device/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId }),
  });
  if (!res.ok) throw new Error(`Device register failed ${res.status}: ${await res.text()}`);
  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error("No token in register response");
  return data.token;
}

before(async () => {
  server = spawnServer(PORT);
  server.stdout?.on("data", (d) => { logs += d.toString(); });
  server.stderr?.on("data", (d) => { logs += d.toString(); });
  await waitForServer(BASE_URL, () => logs);
});

after(() => {
  server?.kill();
});

// ── 1. Replit-template AI routes are gone ────────────────────────────────────

test("template AI routes are not registered: all /api/conversations* and /api/generate-image return 404", async () => {
  const probes: Array<[string, string]> = [
    ["GET", "/api/conversations"],
    ["POST", "/api/conversations"],
    ["GET", "/api/conversations/1"],
    ["DELETE", "/api/conversations/1"],
    ["POST", "/api/conversations/1/messages"],
    ["POST", "/api/conversations/1/voice-stream"],
    ["POST", "/api/generate-image"],
  ];
  for (const [method, path] of probes) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify({ prompt: "x", title: "x", content: "x" }),
    });
    assert.equal(res.status, 404, `${method} ${path} should be 404 (route removed), got ${res.status}`);
  }
});

test("authenticated AI surface still rejects anonymous callers: POST /api/ai/chat returns 401", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "How many ewes do I have?" }),
  });
  assert.equal(res.status, 401, `Expected 401 for unauthenticated /api/ai/chat, got ${res.status}`);
});

// ── 2. Secret handling ───────────────────────────────────────────────────────

test("getSessionSecret: throws in production when SESSION_SECRET is missing", () => {
  assert.throws(
    () => getSessionSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    /SESSION_SECRET must be set in production/,
  );
  assert.throws(
    () => getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "" } as NodeJS.ProcessEnv),
    /SESSION_SECRET must be set in production/,
  );
});

test("getSessionSecret: returns configured secret in production and fallback in dev/test", () => {
  assert.equal(
    getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "real-secret" } as NodeJS.ProcessEnv),
    "real-secret",
  );
  assert.equal(
    getSessionSecret({ NODE_ENV: "test" } as NodeJS.ProcessEnv),
    "breedlog-dev-session-secret",
  );
});

test("production server boot fails fast without SESSION_SECRET", async () => {
  const child = spawnServer(5042, {
    NODE_ENV: "production",
    SESSION_SECRET: undefined,
    DATABASE_URL: undefined,
    USE_IN_MEMORY_STORAGE: "1",
  });
  let childLogs = "";
  child.stdout?.on("data", (d) => { childLogs += d.toString(); });
  child.stderr?.on("data", (d) => { childLogs += d.toString(); });

  const exitCode: number | null = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, 20000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  assert.notEqual(exitCode, 0, `Production boot without SESSION_SECRET must not succeed. Logs:\n${childLogs}`);
  assert.match(childLogs, /SESSION_SECRET must be set in production/, `Expected fail-fast message. Logs:\n${childLogs}`);
});

test("safeCompare: equal strings match, others do not", () => {
  assert.equal(safeCompare("abc123", "abc123"), true);
  assert.equal(safeCompare("abc123", "abc124"), false);
  assert.equal(safeCompare("abc123", "abc1234"), false);
  assert.equal(safeCompare("", ""), true);
});

test("isAdminPinHeaderValid: matches only the configured PIN, never an unconfigured one", () => {
  const original = process.env.ADMIN_PIN;
  try {
    process.env.ADMIN_PIN = "9876";
    assert.equal(isAdminPinHeaderValid("AdminPin 9876"), true);
    assert.equal(isAdminPinHeaderValid("AdminPin 0000"), false);
    assert.equal(isAdminPinHeaderValid("Bearer 9876"), false);
    assert.equal(isAdminPinHeaderValid(undefined), false);

    delete process.env.ADMIN_PIN;
    assert.equal(isAdminPinHeaderValid("AdminPin undefined"), false);
    assert.equal(isAdminPinHeaderValid("AdminPin "), false);
  } finally {
    if (original === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = original;
  }
});

// ── 3. Concurrent startup does not race in migrations ───────────────────────
// In CI, DATABASE_URL points at real Postgres, so both spawned servers run the
// startup migrations concurrently — regression test for the
// pg_type_typname_nsp_index 23505 race fixed with an advisory lock.

test("two servers booting concurrently against the same database both become ready", async () => {
  let logsA = "";
  let logsB = "";
  const a = spawnServer(5043);
  const b = spawnServer(5044);
  a.stdout?.on("data", (d) => { logsA += d.toString(); });
  a.stderr?.on("data", (d) => { logsA += d.toString(); });
  b.stdout?.on("data", (d) => { logsB += d.toString(); });
  b.stderr?.on("data", (d) => { logsB += d.toString(); });
  try {
    await Promise.all([
      waitForServer("http://127.0.0.1:5043", () => logsA),
      waitForServer("http://127.0.0.1:5044", () => logsB),
    ]);
  } finally {
    a.kill();
    b.kill();
  }
});

// ── 4. Simple CSV import survives bad rows ───────────────────────────────────

test("POST /api/settings/import: duplicate and invalid rows do not abort the import", async () => {
  const token = await registerDevice(`import-${randomUUID()}`);
  const csvData = [
    "tagId,sex",
    "SEC100,ewe",
    "SEC100,ewe", // duplicate tag — must be counted, not 500
    ",ewe",       // missing tag — must be reported, not crash
    "SEC101,ram",
  ].join("\n");

  const res = await fetch(`${BASE_URL}/api/settings/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ table: "animals", csvData }),
  });
  const body = await res.json() as { count: number; duplicates: number; failed: number; errors: string[] };
  assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
  assert.equal(body.count, 2, `Expected 2 created (SEC100 + SEC101), got ${body.count}`);
  assert.equal(body.duplicates, 1, `Expected 1 duplicate, got ${body.duplicates}`);
  assert.equal(body.failed, 1, `Expected 1 failed row (missing tagId), got ${body.failed}`);
});
