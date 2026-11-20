import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { annualLifecycle } from "../helpers/paytoday-lifecycle";
import { fixture } from "../helpers/paytoday-fixture";

test("isolated PostgreSQL annual checkout reservation and immutable price lifecycle", async t => {
  if (process.env.CI !== "true" || process.env.BREEDLOG_ISOLATED_SQL_CERT !== "1") {
    t.skip("Requires explicit isolated breedlog_test SQL certification.");
    return;
  }
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.USE_IN_MEMORY_STORAGE, "0");
  const { pool } = await import("../../server/db");
  const { sqlPaymentTransact } = await import("../../server/paytoday-store");
  try {
    assert.equal((await pool.query("SELECT current_database() AS name")).rows[0].name, "breedlog_test");
    await pool.query(readFileSync("migrations/0001_paytoday_annual_candidate.sql", "utf8"));
    await annualLifecycle(t, sqlPaymentTransact(pool), () => sqlPaymentTransact(pool));
    await t.test("database unique index prevents bypassing the workspace reservation", async () => {
      const f = fixture(sqlPaymentTransact(pool)), order = await f.create();
      const saved = (await pool.query("SELECT snapshot,state FROM breedlog_payment_orders WHERE id=$1", [order.orderId])).rows[0];
      const id = "BREEDLOG-" + randomBytes(16).toString("hex").toUpperCase();
      await assert.rejects(() => pool.query(
        "INSERT INTO breedlog_payment_orders(id,workspace,snapshot,state) VALUES($1,$2,$3,$4)",
        [id, f.workspace, { ...saved.snapshot, id }, saved.state],
      ), (err: any) => err.code === "23505" && err.constraint === "breedlog_one_unresolved_annual_checkout");
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM breedlog_payment_orders WHERE workspace=$1", [f.workspace])).rows[0].count, 1);
    });
  } finally { await pool.end(); }
});
