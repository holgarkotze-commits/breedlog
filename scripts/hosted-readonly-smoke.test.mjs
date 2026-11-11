import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Deterministic no-write controls for scripts/hosted-readonly-smoke.mjs.
// All requests are directed to a disposable loopback HTTP server.
const script = join(dirname(fileURLToPath(import.meta.url)), "hosted-readonly-smoke.mjs");
const valid = { version: "1.0.2", buildDate: "2026-11-11", dataSchemaVersion: 1, androidVersionCode: 1, serverTime: "2026-11-11T12:00:00Z" };
const html = "<!doctype html><html><body>SPA shell</body></html>";

async function run(overrides = {}) {
  const server = createServer((req, res) => {
    const routes = {
      "/": [200, { "Content-Type": "text/html" }, html],
      "/auth/register": [200, { "Content-Type": "text/html" }, html],
      "/api/version": [200, { "Content-Type": "application/json" }, JSON.stringify(valid)],
      "/api/animals": [401, { "Content-Type": "application/json" }, "{}"],
      ...overrides,
    };
    const [status, headers, body] = routes[req.url] || [404, {}, ""];
    res.writeHead(status, headers);
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script], { env: { ...process.env, BREEDLOG_URL: url } });
      let output = "";
      child.stdout.on("data", d => output += d);
      child.stderr.on("data", d => output += d);
      child.on("error", reject);
      child.on("close", code => resolve({ code, output }));
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("valid reachability/API contract passes without signup", async () => {
  const r = await run();
  assert.equal(r.code, 0, r.output);
  assert.match(r.output, /0 failed checks/);
});
test("redirect to login is rejected", async () => {
  const r = await run({ "/auth/register": [302, { Location: "/auth/login" }, ""] });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /FAIL registration shell/);
});
test("invalid truthy JSON boolean is rejected", async () => {
  const r = await run({ "/api/version": [200, { "Content-Type": "application/json" }, "true"] });
  assert.equal(r.code, 1, r.output);
});
test("missing required version field is rejected", async () => {
  const r = await run({ "/api/version": [200, { "Content-Type": "application/json" }, JSON.stringify({ version: "1" })] });
  assert.equal(r.code, 1, r.output);
});
test("version HTML fallback is rejected", async () => {
  const r = await run({ "/api/version": [200, { "Content-Type": "text/html" }, html] });
  assert.equal(r.code, 1, r.output);
});
test("animals endpoint exposed with 200 is rejected", async () => {
  const r = await run({ "/api/animals": [200, { "Content-Type": "application/json" }, "[]"] });
  assert.equal(r.code, 1, r.output);
});
test("animals HTML error fallback is rejected", async () => {
  const r = await run({ "/api/animals": [401, { "Content-Type": "text/html" }, html] });
  assert.equal(r.code, 1, r.output);
});
test("registration unrelated non-HTML response is rejected", async () => {
  const r = await run({ "/auth/register": [200, { "Content-Type": "application/json" }, "{}"] });
  assert.equal(r.code, 1, r.output);
});

test("version endpoint redirect is rejected instead of followed", async () => {
  const r = await run({ "/api/version": [302, { Location: "/auth/login" }, ""] });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /FAIL version contract/);
});
test("anonymous animals 403 is accepted as denied", async () => {
  const r = await run({ "/api/animals": [403, { "Content-Type": "application/json" }, '{"message":"forbidden"}'] });
  assert.equal(r.code, 0, r.output);
});
test("unexpected animals redirect is rejected", async () => {
  const r = await run({ "/api/animals": [302, { Location: "/auth/login" }, ""] });
  assert.equal(r.code, 1, r.output);
});

test("401 carrying private animal records fails closed", async () => {
  const r = await run({ "/api/animals": [401, { "Content-Type": "application/json" }, JSON.stringify({ animals: [{ id: 7, name: "private" }] })] });
  assert.equal(r.code, 1, r.output);
  assert.match(r.output, /FAIL anonymous animals denied/);
});
test("403 with nested animal records fails closed", async () => {
  const r = await run({ "/api/animals": [403, { "Content-Type": "application/json" }, JSON.stringify({ data: [{ id: 7 }] })] });
  assert.equal(r.code, 1, r.output);
});
test("malformed denial JSON fails closed", async () => {
  const r = await run({ "/api/animals": [401, { "Content-Type": "application/json" }, "{broken"] });
  assert.equal(r.code, 1, r.output);
});
