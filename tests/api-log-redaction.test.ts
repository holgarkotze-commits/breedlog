import assert from "node:assert/strict";
import test from "node:test";
import { formatApiLogBody, redactForLog } from "../server/observability";

// Regression coverage for the API request logger: response bodies mirrored
// into server logs must never carry credential material and must stay
// bounded to a single readable line.

test("device registration tokens are redacted from API log bodies", () => {
  const body = {
    success: true,
    userId: "user-1234",
    deviceId: "0123456789abcdef0123456789abcdef",
    token: "0123456789abcdef0123456789abcdef:m9zzz:deadbeefdeadbeef",
  };
  const line = formatApiLogBody(body, 10_000);
  assert.ok(!line.includes("deadbeefdeadbeef"), "token signature must not appear in the log line");
  assert.ok(line.includes('"token":"[REDACTED]"'), "token field must be replaced with [REDACTED]");
});

test("nested credential fields are redacted recursively", () => {
  const body = {
    verification: { token: "email_verification_abc123def456", expiresAt: "2026-08-01T00:00:00Z" },
    profile: { email: "user@example.com" },
  };
  const line = formatApiLogBody(body, 10_000);
  assert.ok(!line.includes("email_verification_abc123def456"));
  assert.ok(line.includes("[REDACTED]"));
});

test("large payloads (e.g. encrypted backups) are truncated to one bounded line", () => {
  const body = {
    fileName: "breedlog-backup.breedlogbackup",
    backup: { ciphertext: "A".repeat(500_000) },
  };
  const line = formatApiLogBody(body);
  assert.ok(line.length <= 160, `log body must be truncated (got ${line.length} chars)`);
});

test("ordinary response bodies pass through readable and unredacted", () => {
  const line = formatApiLogBody({ matched: false, status: "unassigned" }, 10_000);
  assert.equal(line, '{"matched":false,"status":"unassigned"}');
});

test("unserializable bodies do not break the request logger", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.equal(typeof formatApiLogBody(cyclic), "string");
});

test("redactForLog masks secret-named keys regardless of value shape", () => {
  const result = redactForLog({ sessionSecret: 12345, apiKey: ["a"], note: "plain" }) as Record<string, unknown>;
  assert.equal(result.sessionSecret, "[REDACTED]");
  assert.equal(result.apiKey, "[REDACTED]");
  assert.equal(result.note, "plain");
});
