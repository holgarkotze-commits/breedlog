import assert from "node:assert/strict";
import test from "node:test";
import { buildHealthSignal, createLogEvent, redactForLog } from "../server/observability";

test("structured log redaction removes credentials and token-like values", () => {
  const redacted = redactForLog({
    authorization: "Bearer abc.def.ghi",
    nested: {
      apiKey: "1234567890abcdef1234567890abcdef",
      animalTag: "KW-001",
      note: "healthy ewe",
    },
    list: [{ password: "super-secret" }],
  }) as any;
  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.nested.apiKey, "[REDACTED]");
  assert.equal(redacted.nested.animalTag, "KW-001");
  assert.equal(redacted.nested.note, "healthy ewe");
  assert.equal(redacted.list[0].password, "[REDACTED]");
});

test("createLogEvent emits privacy-safe structured event", () => {
  const event = createLogEvent({
    level: "warn",
    event: "billing.webhook.rejected",
    accountId: "acct_123",
    route: "/api/billing/webhook/test",
    metadata: { signature: "1234567890abcdef1234567890abcdef", reason: "invalid signature" },
    timestamp: "2026-07-13T00:00:00.000Z",
  });
  assert.equal(event.timestamp, "2026-07-13T00:00:00.000Z");
  assert.deepEqual(event.metadata, { signature: "[REDACTED]", reason: "invalid signature" });
});

test("health signal reports worst status without hiding blockers", () => {
  assert.equal(buildHealthSignal({ app: "pass", billing: "blocked" }).status, "blocked");
  assert.equal(buildHealthSignal({ app: "pass", backups: "warn" }).status, "warn");
  assert.equal(buildHealthSignal({ app: "pass", database: "fail", billing: "blocked" }).status, "fail");
});
