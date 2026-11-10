import assert from "node:assert/strict";
import type { PaymentTransact } from "../../server/paytoday-types";
import { fixture } from "./paytoday-fixture";

export async function annualLifecycle(
  t: { test: (name: string, fn: () => Promise<void>) => Promise<unknown> },
  transact: PaymentTransact,
  fresh: () => PaymentTransact = () => transact,
) {
  const creates = (f: ReturnType<typeof fixture>) => f.calls.filter(c => c.url.endsWith("/web/create/payment/intent/")).length;
  await t.test("eight simultaneous checkout starts reserve one order before one provider create", async () => {
    const f = fixture(transact);
    const results = await Promise.allSettled(Array.from({ length: 8 }, () =>
      f.restart(fresh()).create(f.workspace, f.contact)));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(results.filter(r => r.status === "rejected").length, 7);
    assert.equal(creates(f), 1);
    const calls = f.calls.length;
    await assert.rejects(() => f.create());
    assert.equal(f.calls.length, calls);
  });
  for (const status of ["pending", "unknown", "failed", "cancelled"]) {
    await t.test(`${status} outcome retains reservation after deadline and restart`, async () => {
      const f = fixture(transact), order = await f.create();
      f.edit(p => { p.intent.transaction_status = status; });
      f.setNow("2030-01-05T12:00:00Z");
      await f.service.reconcile(f.workspace, order.orderId);
      const calls = f.calls.length;
      await assert.rejects(() => f.restart(fresh()).create(f.workspace, f.contact));
      assert.equal(f.calls.length, calls);
      assert.equal(creates(f), 1);
    });
  }
  await t.test("legacy arrival-expired state does not release an unknown checkout", async () => {
    const f = fixture(transact), order = await f.create();
    await transact(f.workspace, async tx => {
      const saved = (await tx.getOrder(order.orderId))!;
      await tx.updateOrderState(saved.id, { ...saved.state, status: "expired" });
    });
    f.setNow("2030-01-05T12:00:00Z");
    const calls = f.calls.length;
    await assert.rejects(() => f.restart(fresh()).create(f.workspace, f.contact));
    assert.equal(f.calls.length, calls);
  });
  await t.test("reservation transaction rollback permits exactly one safe retry", async () => {
    const f = fixture(transact);
    const rollback: PaymentTransact = (w, run) => transact(w, async tx => {
      await run(tx); throw Error("synthetic reservation rollback");
    });
    await assert.rejects(() => f.restart(rollback).create(f.workspace, f.contact));
    assert.equal(f.calls.length, 0);
    await f.create();
    assert.equal(creates(f), 1);
  });
  await t.test("lost reservation acknowledgement blocks a retry without a provider request", async () => {
    const f = fixture(transact);
    const lostAck: PaymentTransact = async (w, run) => {
      await transact(w, run);
      throw new Error("synthetic lost reservation acknowledgement");
    };
    await assert.rejects(() => f.restart(lostAck).create(f.workspace, f.contact));
    assert.equal(f.calls.length, 0);
    await assert.rejects(() => f.restart(fresh()).create(f.workspace, f.contact));
    assert.equal(f.calls.length, 0);
  });
  await t.test("uncertain provider error cannot create a second payable intent", async () => {
    const f = fixture(transact);
    f.fail(true);
    await assert.rejects(() => f.create());
    const calls = f.calls.length;
    f.fail(false);
    await assert.rejects(() => f.restart(fresh()).create(f.workspace, f.contact));
    assert.equal(f.calls.length, calls);
  });
  for (const afterCommit of [false, true]) {
    await t.test(`intent save ${afterCommit ? "lost acknowledgement" : "rollback"} preserves reservation`, async () => {
      const f = fixture(transact);
      let phase = 0;
      const fault: PaymentTransact = async (w, run) => {
        const current = ++phase;
        const result = await transact(w, async tx => {
          const value = await run(tx);
          if (current === 2 && !afterCommit) throw Error("synthetic intent-save rollback");
          return value;
        });
        if (current === 2 && afterCommit) throw Error("synthetic intent-save lost acknowledgement");
        return result;
      };
      await assert.rejects(() => f.restart(fault).create(f.workspace, f.contact));
      assert.equal(creates(f), 1);
      const calls = f.calls.length;
      await assert.rejects(() => f.restart(fresh()).create(f.workspace, f.contact));
      assert.equal(f.calls.length, calls);
      if (afterCommit) {
        assert.equal((await f.restart(fresh()).reconcile(f.workspace, f.lastInvoice())).status, "paid");
      }
    });
  }
  for (const status of ["failed", "cancelled"]) {
    await t.test(`verified definitive ${status} outcome permits a fresh authorized checkout`, async () => {
      const f = fixture(transact), order = await f.create();
      f.edit(p => { p.intent.transaction_status = status; p.fixtureIntentNonPayable = true; });
      await f.service.reconcile(f.workspace, order.orderId);
      const next = await f.create();
      assert.notEqual(next.orderId, order.orderId);
      assert.equal(creates(f), 2);
    });
  }
  await t.test("unknown outcome releases only after subsequent verified non-payable evidence", async () => {
    const f = fixture(transact), order = await f.create();
    f.edit(p => { p.intent.transaction_status = "unknown"; });
    await f.service.reconcile(f.workspace, order.orderId);
    await assert.rejects(() => f.create());
    f.edit(p => { p.intent.transaction_status = "failed"; p.fixtureIntentNonPayable = true; });
    await f.service.reconcile(f.workspace, order.orderId);
    await f.create();
    assert.equal(creates(f), 2);
  });
  await t.test("old approved price reconciles after catalogue amount/version change without mutation", async () => {
    const f = fixture(transact), order = await f.create();
    const original = (await transact(f.workspace, tx => tx.getOrder(order.orderId)))!;
    const config = structuredClone(f.config);
    config.encryptionKey = f.config.encryptionKey;
    config.offer.amountMinor = 99900;
    config.offer.version = "fixture-new-approved-price";
    config.priceApprovalRef = "fixture-new-price-approval";
    const current = f.restart(fresh(), config);
    const calls = f.calls.length;
    await assert.rejects(() => current.create(f.workspace, f.contact));
    assert.equal(f.calls.length, calls, "new catalogue cannot bypass the existing reservation");
    assert.equal((await current.reconcile(f.workspace, order.orderId)).status, "paid");
    const saved = (await transact(f.workspace, tx => tx.getOrder(order.orderId)))!;
    assert.deepEqual(saved.offer, original.offer);
    saved.offer = config.offer;
    assert.deepEqual((await transact(f.workspace, tx => tx.getOrder(order.orderId)))!.offer, original.offer);
  });
  await t.test("current catalogue amount cannot substitute for the stored approved amount", async () => {
    const f = fixture(transact), order = await f.create();
    const config = structuredClone(f.config); config.encryptionKey = f.config.encryptionKey;
    config.offer.amountMinor = 99900; config.offer.version = "fixture-new-price";
    f.edit(p => { p.intent.amount = 999; p.intent.transaction_data.fixtureFinalized.amountMinor = 99900; });
    await assert.rejects(() => f.restart(fresh(), config).reconcile(f.workspace, order.orderId));
    assert.equal(await transact(f.workspace, tx => tx.getSetting("commercial:entitlement:" + f.workspace)), undefined);
  });
  for (const patch of [{ product: "fmd" }, { provider: "other" }, { merchant: "other-fixture" },
    { environment: "production" }, { currency: "ZAR" }, { contractVersion: "other-verified-contract" }]) {
    await t.test(`${Object.keys(patch)[0]} changes still reject before provider lookup`, async () => {
      const f = fixture(transact), order = await f.create(), calls = f.calls.length;
      const config = structuredClone(f.config); config.encryptionKey = f.config.encryptionKey;
      Object.assign(config.offer, patch);
      await assert.rejects(async () => f.restart(fresh(), config).reconcile(f.workspace, order.orderId));
      assert.equal(f.calls.length, calls);
    });
  }
}
