import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { IStorage } from "../../server/storage";
import type { PaymentOrder, PaymentTransact } from "../../server/paytoday-types";
import { fixture } from "./paytoday-fixture";
import { applyBillingEvent, cancelBillingSubscription, completeTestCheckoutSession,
  createCheckoutSession, simulateBillingProviderEvent, EntitlementDeniedError } from "../../server/commercial";

const operations = ["simulate-refunded", "simulate-renewed", "simulate-cancelled", "apply-cancelled", "checkout-complete", "cancel-immediate", "cancel-at-term"] as const;
type Operation = typeof operations[number];
const key = (w: string, kind: string) => `commercial:${kind}:${w}`;
async function prepare(s: IStorage, w: string) {
  await s.setSystemSetting(key(w, "subscription"), JSON.stringify({ accountId: w,
    provider: "test-provider", subscriptionId: "synthetic-prior", customerId: "", productCode: "premium_monthly",
    planId: "premium", billingPeriod: "monthly", status: "expired", currentPeriodStart: "2000-01-01T00:00:00Z",
    currentPeriodEnd: "2000-02-01T00:00:00Z", cancelAtPeriodEnd: false, addOns: [], updatedAt: "2000-01-01T00:00:00Z" }));
  const generated = await createCheckoutSession(s, w, "premium_annual");
  // Existing SQL settings keys are varchar(64); use a valid bounded synthetic
  // session ID so this transaction test does not hit the unrelated legacy
  // simulator's oversized evt_checkout_<generated-id> idempotency key.
  const sessionId = "chk_" + randomUUID().slice(0, 8);
  await s.setSystemSetting("commercial:checkout:" + sessionId, JSON.stringify({ ...generated, sessionId }));
  return sessionId;
}
function invoke(op: Operation, s: IStorage, w: string, session: string) {
  if (op === "simulate-refunded") return simulateBillingProviderEvent(s, w, { eventType: "subscription.refunded", providerEventId: "f1-refund" });
  if (op === "simulate-renewed") return simulateBillingProviderEvent(s, w, { eventType: "subscription.renewed", providerEventId: "f1-renew" });
  if (op === "simulate-cancelled") return simulateBillingProviderEvent(s, w, { eventType: "subscription.cancelled", providerEventId: "f1-cancel" });
  if (op === "apply-cancelled") return applyBillingEvent(s, { provider: "test-provider", providerEventId: "synthetic-f1",
    accountId: w, eventType: "subscription.cancelled", planId: "free" });
  if (op === "checkout-complete") return completeTestCheckoutSession(s, session);
  return cancelBillingSubscription(s, w, { atPeriodEnd: op === "cancel-at-term" });
}
async function settings(s: IStorage, w: string) {
  return (await s.listSystemSettings("commercial:")).filter(r => r.key.endsWith(w) || r.value.includes(w))
    .sort((a, b) => a.key.localeCompare(b.key));
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

export async function simulatorAtomicity(t: { test(name: string, fn: () => Promise<void>): Promise<unknown> },
  s: IStorage, realTransact: PaymentTransact = s.paymentTransaction,
  ledger?: (workspace: string) => Promise<unknown>) {
  const base = s.paymentTransaction;
  for (const op of operations) {
    await t.test(`F1 ${op} waits for real settlement and rejects without mutation`, async () => {
      const written = deferred(), release = deferred(), attempted = deferred();
      let paid!: { entitlement: string | undefined; subscription: string | undefined; order: PaymentOrder | undefined };
      const f = fixture(async (w, run) => realTransact(w, tx => run({ ...tx,
        async setSetting(k, value) {
          await tx.setSetting(k, value);
          if (k === key(w, "subscription") && JSON.parse(value).provider === "paytoday") {
            paid = { entitlement: await tx.getSetting(key(w, "entitlement")),
              subscription: await tx.getSetting(key(w, "subscription")), order: await tx.getOrder(JSON.parse(value).paymentOrderId) };
            written.resolve(); await release.promise;
          }
        },
      })));
      const session = await prepare(s, f.workspace), order = await f.create(), initial = await settings(s, f.workspace);
      let acquired = false, transactions = 0;
      const settled = f.service.reconcile(f.workspace, order.orderId).then(value => ({ value }), error => ({ error }));
      try {
        await written.promise;
        s.paymentTransaction = (w, run) => {
          transactions++; attempted.resolve();
          return base(w, tx => { acquired = true; return run(tx); });
        };
        const simulation = invoke(op, s, f.workspace, session).then(() => "resolved", error =>
          error instanceof EntitlementDeniedError ? "denied" : "error");
        await Promise.race([attempted.promise, simulation]);
        assert.equal(acquired, false, "simulator cannot enter while settlement holds the lock");
        release.resolve();
        assert.ok("value" in await settled);
        assert.equal(await simulation, "denied");
        assert.equal(transactions, 1, "nested event application must reuse the outer transaction");
        assert.equal(await s.getSystemSetting(key(f.workspace, "entitlement")), paid.entitlement);
        assert.equal(await s.getSystemSetting(key(f.workspace, "subscription")), paid.subscription);
        assert.deepEqual(await base(f.workspace, tx => tx.getOrder(order.orderId)), paid.order);
        const unaffected = (await settings(s, f.workspace)).filter(r => ![key(f.workspace, "entitlement"), key(f.workspace, "subscription")].includes(r.key));
        assert.deepEqual(unaffected, initial.filter(r => r.key !== key(f.workspace, "subscription")), "checkout, event and audit records stay unchanged");
        const financial = await ledger?.(f.workspace);
        await assert.rejects(() => invoke(op, s, f.workspace, session), EntitlementDeniedError);
        if (ledger) assert.deepEqual(await ledger(f.workspace), financial);
      } finally { release.resolve(); await settled; s.paymentTransaction = base; }
    });
  }
  for (const status of ["pending", "refunded"] as const) {
    await t.test(`authoritative ${status} order protects a workspace without paid setting markers`, async () => {
      const f = fixture(realTransact), session = await prepare(s, f.workspace), order = await f.create();
      if (status === "refunded") { f.edit(p => { p.intent.transaction_status = "refunded"; }); await f.service.reconcile(f.workspace, order.orderId); }
      const before = await settings(s, f.workspace), saved = await base(f.workspace, tx => tx.getOrder(order.orderId)), financial = await ledger?.(f.workspace);
      for (const op of operations) await assert.rejects(() => invoke(op, s, f.workspace, session), EntitlementDeniedError);
      assert.deepEqual(await settings(s, f.workspace), before);
      assert.deepEqual(await base(f.workspace, tx => tx.getOrder(order.orderId)), saved);
      if (ledger) assert.deepEqual(await ledger(f.workspace), financial);
    });
  }
  for (const op of operations) {
    await t.test(`ordinary ${op} rolls back all writes on audit/event persistence failure`, async () => {
      const w = "rollback-" + randomUUID().slice(0, 12), session = await prepare(s, w), before = await settings(s, w);
      let transactions = 0, injected = false;
      s.paymentTransaction = (workspace, run) => {
        transactions++;
        return base(workspace, tx => run({ ...tx, async setSetting(k, value) {
          await tx.setSetting(k, value);
          if (k.startsWith("commercial:audit:") || k.startsWith("commercial:billing-event:")) { injected = true; throw new Error("synthetic failure"); }
        } }));
      };
      try { await assert.rejects(() => invoke(op, s, w, session)); assert.equal(injected, true); assert.equal(transactions, 1); assert.deepEqual(await settings(s, w), before); }
      finally { s.paymentTransaction = base; }
    });
  }
  await t.test("ordinary checkout and parallel event replay commit without nested locks", async () => {
    const w = "ordinary-" + randomUUID().slice(0, 12), session = await prepare(s, w);
    assert.equal((await completeTestCheckoutSession(s, session)).session.status, "completed");
    const event = { provider: "test-provider", providerEventId: "rep-" + w.slice(-12), accountId: w,
      eventType: "subscription.renewed" as const, planId: "premium" as const, paidUntil: "2031-01-01T00:00:00Z", billingPeriod: "annual" as const };
    const results = await Promise.all(Array.from({ length: 6 }, () => applyBillingEvent(s, event)));
    assert.equal(results.filter(r => !r.idempotent).length, 1); assert.equal(results.filter(r => r.idempotent).length, 5);
    await simulateBillingProviderEvent(s, w, { eventType: "subscription.refunded", providerEventId: "ref-" + w.slice(-12) });
    assert.equal(JSON.parse((await s.getSystemSetting(key(w, "entitlement")))!).status, "refunded");
  });
}
