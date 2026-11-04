import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";

test("SQL-backed farmer accounts persist with isolated sessions and one-time recovery", async t => {
  // Never silently opt into a developer/farmer database. This runs only in the
  // existing disposable PostgreSQL CI service after its schema has been pushed.
  if (process.env.CI !== "true" || process.env.BREEDLOG_ISOLATED_SQL_CERT !== "1") {
    t.skip("Requires the explicitly authorized disposable CI database.");
    return;
  }
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.USE_IN_MEMORY_STORAGE, "0");
  const { pool } = await import("../../server/db");
  const database = await pool.query("SELECT current_database() AS name");
  assert.equal(database.rows[0].name, "breedlog_test", "Refusing to mutate a non-certification database");
  const { registerRoutes } = await import("../../server/routes");
  const { storage, DatabaseStorage } = await import("../../server/storage");
  assert.ok(storage instanceof DatabaseStorage);
  const nonce = randomUUID();
  const password = "SQL-isolated-test-password";
  let server: ReturnType<typeof createServer>;
  let base = "";
  const start = async () => {
    const app = express();
    app.use(express.json());
    server = createServer(app);
    await registerRoutes(server, app);
    app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ message: "Certification request failed" }));
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  };
  const stop = async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  };
  const request = async (path: string, body?: any, cookie = "") => {
    const res = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json(), cookie: res.headers.get("set-cookie")?.split(";")[0] || cookie };
  };
  await start();
  try {
    const a = await request("/api/auth/register", { email: `sql-a-${nonce}@example.test`, password, acceptedTerms: true });
    const b = await request("/api/auth/register", { email: `sql-b-${nonce}@example.test`, password, acceptedTerms: true });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    assert.notEqual(a.body.profile.workspaceUserId, b.body.profile.workspaceUserId);
    assert.deepEqual((await request("/api/animals", undefined, a.cookie)).body, []);
    const record = await request("/api/animals", { tagId: `SQL-${nonce}`, sex: "ewe" }, a.cookie);
    assert.equal(record.status, 201);
    assert.equal((await request(`/api/animals/${record.body.id}`, undefined, b.cookie)).status, 404);
    assert.deepEqual((await request("/api/animals", undefined, b.cookie)).body, []);
    const rows = await pool.query("SELECT user_id FROM animals WHERE id=$1", [record.body.id]);
    assert.equal(rows.rows[0].user_id, a.body.profile.workspaceUserId);

    // Rebuild the HTTP app and session middleware; only SQL retains the records
    // and session. This is not a claim about real hosting restart acceptance.
    await stop();
    await start();
    assert.equal((await request("/api/auth/me", undefined, a.cookie)).body.authenticated, true);
    assert.equal((await request("/api/animals", undefined, a.cookie)).body.length, 1);
    const reset = { token: a.body.recoveryCode, newPassword: "SQL-recovered-test-password" };
    const attempts = await Promise.all([
      request("/api/auth/recovery/confirm", reset), request("/api/auth/recovery/confirm", reset),
    ]);
    assert.deepEqual(attempts.map(result => result.status).sort(), [200, 400]);
    assert.equal((await request("/api/animals", undefined, a.cookie)).status, 401);
    assert.equal((await request("/api/animals", undefined, b.cookie)).status, 200);
  } finally {
    await stop();
    await pool.end();
    // The entire CI service is disposable; no cleanup queries target real data.
  }
});
