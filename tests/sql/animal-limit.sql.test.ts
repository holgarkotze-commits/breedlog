import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";

test("PostgreSQL animal limits serialize all registration and reactivation paths", async t => {
  if (process.env.CI !== "true" || process.env.BREEDLOG_ISOLATED_SQL_CERT !== "1") {
    t.skip("Requires the explicitly authorized disposable CI database.");
    return;
  }
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.USE_IN_MEMORY_STORAGE, "0");
  const { pool } = await import("../../server/db");
  assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "breedlog_test",
    "Refusing to mutate any non-certification database");
  const { storage, DatabaseStorage } = await import("../../server/storage");
  const { assertCanCreateAnimal, setEntitlementState } = await import("../../server/commercial");
  const { BREEDLOG_PRICING_VERSION } = await import("../../shared/commercial");
  const { registerRoutes } = await import("../../server/routes");
  assert.ok(storage instanceof DatabaseStorage);
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
    res.status(500).json({ message: "Isolated certification request failed" }));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const nonce = randomUUID();
  const account = async (suffix: string) =>
    (await storage.upsertUser({ deviceId: `animal-limit-${nonce}-${suffix}` })).id;
  const request = async (user: string, path: string, body: unknown, method = "POST", idempotencyKey?: string) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json", "x-test-user-id": user, "x-test-device-id": `device-${user}`,
        ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const storedCount = async (user: string, active = false) => Number((await pool.query(
    "SELECT count(*) AS count FROM animals WHERE user_id=$1 AND ($2::boolean=false OR status='active')", [user, active],
  )).rows[0].count);
  const seed = async (user: string, count: number) => {
    for (let i = 0; i < count; i++) await storage.createAnimal(user, { tagId: `SEED-${i}`, sex: "ewe", status: "active" });
  };
  try {
    await t.test("40 parallel Free POST creates store exactly 30; all other requests return the limit code", async () => {
      const user = await account("free");
      const results = await Promise.all(Array.from({ length: 40 }, (_, i) =>
        request(user, "/api/animals", { tagId: `FREE-${i}`, sex: "ewe", status: "active" })));
      assert.equal(results.filter(r => r.status === 201).length, 30);
      const refused = results.filter(r => r.status !== 201);
      assert.equal(refused.length, 10);
      for (const result of refused) {
        assert.equal(result.status, 403);
        assert.equal(result.body.code, "ACTIVE_ANIMAL_LIMIT_REACHED");
      }
      assert.equal(await storedCount(user), 30);
    });

    await t.test("Premium still permits all 40 parallel creates", async () => {
      const user = await account("premium"), now = new Date().toISOString();
      await setEntitlementState(storage, {
        accountId: user, planId: "premium", status: "active", source: "manual_admin",
        pricingVersion: BREEDLOG_PRICING_VERSION, effectiveAt: now, updatedAt: now, paidUntil: "2099-01-01T00:00:00Z",
      });
      const results = await Promise.all(Array.from({ length: 40 }, (_, i) =>
        request(user, "/api/animals", { tagId: `PREMIUM-${i}`, sex: "ewe" })));
      assert.ok(results.every(r => r.status === 201));
      assert.equal(await storedCount(user), 40);
    });

    await t.test("both CSV import routes and copied animal creates share the same final slot", async () => {
      const user = await account("mixed");
      await seed(user, 29);
      const original = (await storage.getAnimals(user))[0];
      // A copied/clone payload is an ordinary create; there is no separate clone endpoint.
      const { id: _id, userId: _userId, ...copy } = original;
      const results = await Promise.all([
        request(user, "/api/animals", { ...copy, tagId: "CLONED" }),
        request(user, "/api/import/csv", { csvData: "tagId,sex,status\nCSV,ewe,active" }),
        request(user, "/api/settings/import", { table: "animals", csvData: "tagId,sex,status\nSETTINGS,ewe,active" }),
      ]);
      assert.ok(results.every(r => r.status === 200 || r.status === 201 || r.status === 403), JSON.stringify(results));
      assert.equal((results[0].status === 201 ? 1 : 0) + results[1].body.created + results[2].body.count, 1);
      assert.equal(await storedCount(user), 30);
    });

    await t.test("concurrent inactive registrations still count towards the unchanged original-registration limit", async () => {
      const user = await account("inactive");
      await seed(user, 29);
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
        request(user, "/api/animals", { tagId: `CULLED-${i}`, sex: "ewe", status: "culled" })));
      assert.equal(results.filter(r => r.status === 201).length, 1);
      assert.ok(results.filter(r => r.status !== 201).every(r => r.status === 403 && r.body.code === "ACTIVE_ANIMAL_LIMIT_REACHED"));
      assert.equal(await storedCount(user), 30);
    });

    await t.test("reactivation re-reads status under the account lock and cannot exceed 30 active", async () => {
      const user = await account("reactivate");
      const inactive = [];
      for (let i = 0; i < 2; i++) inactive.push(await storage.createAnimal(user, { tagId: `INACTIVE-${i}`, sex: "ewe", status: "culled" }));
      await seed(user, 29);
      const results = await Promise.all(inactive.map(a => request(user, `/api/animals/${a.id}`, { status: "active" }, "PUT")));
      assert.equal(results.filter(r => r.status === 200).length, 1);
      const refused = results.find(r => r.status !== 200)!;
      assert.equal(refused.status, 403);
      assert.equal(refused.body.code, "ACTIVE_ANIMAL_LIMIT_REACHED");
      assert.equal(await storedCount(user, true), 30);
      assert.equal(await storedCount(user), 31, "existing inactive records are preserved");
      const active = inactive[results.findIndex(r => r.status === 200)];
      assert.equal((await request(user, `/api/animals/${active.id}`, { status: "active" }, "PUT")).status, 200);
    });

    await t.test("parallel idempotent replay creates only one row, even after the farm is full", async () => {
      const user = await account("replay");
      const payload = { tagId: "REPLAY", sex: "ewe", clientId: `client-${nonce}` };
      const results = await Promise.all(Array.from({ length: 40 }, () => request(user, "/api/animals", payload, "POST", payload.clientId)));
      assert.equal(results.filter(r => r.status === 201).length, 1);
      assert.equal(results.filter(r => r.status === 200).length, 39);
      assert.equal(new Set(results.map(r => r.body.id)).size, 1);
      await seed(user, 29);
      assert.equal((await request(user, "/api/animals", payload, "POST", payload.clientId)).status, 200);
      assert.equal(await storedCount(user), 30);
    });

    await t.test("failed transaction rolls back its insert and releases the advisory lock", async () => {
      const user = await account("rollback");
      await assert.rejects(storage.withAnimalWriteLock(user, async locked => {
        await assertCanCreateAnimal(locked, user);
        await locked.createAnimal(user, { tagId: "ROLLBACK", sex: "ewe" });
        throw new Error("Injected failure before commit");
      }), /Injected failure/);
      assert.equal(await storedCount(user), 0);
      assert.equal((await request(user, "/api/animals", { tagId: "AFTER-ROLLBACK", sex: "ewe" })).status, 201);
      assert.equal(await storedCount(user), 1);
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
    // This entire local/CI database is disposable, never a farmer database.
  }
});
