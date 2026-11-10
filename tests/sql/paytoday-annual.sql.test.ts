import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { annualConformance, fixture } from "../helpers/paytoday-fixture";

test("isolated PostgreSQL annual payment persistence, concurrency and atomic fault retry", async t => {
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
    // Exercise the actual prepared migration ONLY on a disposable test database.
    await pool.query(readFileSync("migrations/0001_paytoday_annual_candidate.sql", "utf8"));
    await annualConformance(t, sqlPaymentTransact(pool), () => sqlPaymentTransact(pool));
    await t.test("database enforces immutable server-priced snapshot", async () => {
      const f = fixture(sqlPaymentTransact(pool)), order = await f.create();
      await assert.rejects(() => pool.query(
        "UPDATE breedlog_payment_orders SET snapshot=jsonb_set(snapshot,'{offer,amountMinor}','1') WHERE id=$1",
        [order.orderId],
      ));
      assert.equal((await sqlPaymentTransact(pool)(f.workspace, tx => tx.getOrder(order.orderId)))!.offer.amountMinor, 12300);
    });
    await t.test("new Node process reconciles persisted encrypted intent and duplicate replay", async () => {
      const f = fixture(sqlPaymentTransact(pool)), order = await f.create();
      const packet = { workspace: f.workspace, id: order.orderId, payment: [...f.intents.values()][0].intent.payment_token };
      const source = `
        import { pool } from './server/db.ts';
        import { sqlPaymentTransact } from './server/paytoday-store.ts';
        import { AnnualPayToday } from './server/paytoday-annual.ts';
        import { fixtureConfig } from './tests/helpers/paytoday-fixture.ts';
        let input=''; for await (const chunk of process.stdin) input+=chunk;
        const p=JSON.parse(input);
        const provider={create:async()=>{throw Error('no new intent allowed')},lookup:async token=>{
          if(!token.startsWith('intent-secret-')) throw Error('stored token required');
          return {status:'success',invoice:p.id,amountMinor:12300,merchant:'test-breedlog-merchant',currency:'NAD',paymentToken:p.payment};
        }};
        try {
          const service=new AnnualPayToday(fixtureConfig(),sqlPaymentTransact(pool),provider,()=>new Date('2030-01-01T12:00:00Z'));
          const a=await service.reconcile(p.workspace,p.id),b=await service.reconcile(p.workspace,p.id);
          if(a.status!=='paid'||b.periodEnd!==a.periodEnd) throw Error('restart reconciliation failed');
          console.log('PASS: persisted intent reconciled once across process boundary');
        } finally { await pool.end(); }
      `;
      const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], {
        env: process.env, stdio: ["pipe", "pipe", "pipe"],
      });
      child.stdin.end(JSON.stringify(packet));
      let stdout = "", stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk; });
      child.stderr.on("data", chunk => { stderr += chunk; });
      const result = await new Promise<number | null>(resolve => child.on("close", resolve));
      assert.equal(result, 0, "isolated restart proof must exit cleanly");
      assert.ok(stdout.includes("PASS: persisted intent"));
      assert.ok(!stdout.includes("secret") && !stderr.includes(packet.payment));
    });
  } finally { await pool.end(); }
});
