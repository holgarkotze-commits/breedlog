import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStorage } from "../server/storage";
import { fixture } from "./helpers/paytoday-fixture";
import { simulatorAtomicity } from "./helpers/paytoday-simulator-concurrency";

test("F1 simulator transaction atomicity in memory", { timeout: 20000 }, async t => {
  await simulatorAtomicity(t, new InMemoryStorage());
});
import { applyBillingEvent, cancelBillingSubscription, completeTestCheckoutSession,
  createCheckoutSession, simulateBillingProviderEvent, EntitlementDeniedError } from "../server/commercial";

const events = ["subscription.created", "subscription.renewed", "subscription.cancelled", "subscription.grace_period",
  "subscription.payment_failed", "subscription.refunded", "subscription.reversed", "subscription.expired"] as const;

for (const protection of ["both", "subscription", "entitlement"] as const) {
  for (const operation of [...events.map(eventType => ({ name: `simulate ${eventType}`, run: (s: InMemoryStorage, w: string) =>
    simulateBillingProviderEvent(s, w, { eventType, now: new Date("2030-02-01T12:00:00Z") }) })),
    ...events.map(eventType => ({ name: `apply ${eventType}`, run: (s: InMemoryStorage, w: string) =>
      applyBillingEvent(s, { provider: "test-provider", providerEventId: "rejected-event", accountId: w, eventType, planId: "premium" }) })),
    ...[true, false].map(atPeriodEnd => ({ name: `cancel atPeriodEnd=${atPeriodEnd}`, run: (s: InMemoryStorage, w: string) =>
      cancelBillingSubscription(s, w, { atPeriodEnd }) })),
  ]) {
    test(`${operation.name} rejects protected ${protection} without any setting/audit writes`, async () => {
      const s = new InMemoryStorage(), f = fixture(s.paymentTransaction), order = await f.create();
      await f.service.reconcile(f.workspace, order.orderId);
      if (protection === "subscription") {
        const key = "commercial:entitlement:" + f.workspace;
        const ent = JSON.parse((await s.getSystemSetting(key))!);
        delete ent.paymentOrderId;
        await s.setSystemSetting(key, JSON.stringify(ent));
      } else if (protection === "entitlement") {
        const key = "commercial:subscription:" + f.workspace;
        const sub = JSON.parse((await s.getSystemSetting(key))!);
        await s.setSystemSetting(key, JSON.stringify({ ...sub, provider: "test-provider" }));
      }
      const before = await s.listSystemSettings("");
      const writes: string[] = [];
      const set = s.setSystemSetting.bind(s);
      s.setSystemSetting = async (...args) => { writes.push(args[0]); await set(...args); };
      await assert.rejects(() => operation.run(s, f.workspace), EntitlementDeniedError);
      assert.deepEqual(writes, [], "a rejected simulation must never persist provisional subscription/audit changes");
      assert.deepEqual(await s.listSystemSettings(""), before);
    });
  }
  test(`checkout completion rejects protected ${protection} without writes`, async () => {
    const s = new InMemoryStorage(), f = fixture(s.paymentTransaction);
    const checkout = await createCheckoutSession(s, f.workspace, "premium_annual");
    const order = await f.create();
    await f.service.reconcile(f.workspace, order.orderId);
    if (protection === "subscription") {
      const key = "commercial:entitlement:" + f.workspace;
      const ent = JSON.parse((await s.getSystemSetting(key))!); delete ent.paymentOrderId;
      await s.setSystemSetting(key, JSON.stringify(ent));
    } else if (protection === "entitlement") {
      const key = "commercial:subscription:" + f.workspace;
      const sub = JSON.parse((await s.getSystemSetting(key))!);
      await s.setSystemSetting(key, JSON.stringify({ ...sub, provider: "test-provider" }));
    }
    const before = await s.listSystemSettings("");
    const writes: string[] = [];
    const set = s.setSystemSetting.bind(s);
    s.setSystemSetting = async (...args) => { writes.push(args[0]); await set(...args); };
    await assert.rejects(() => completeTestCheckoutSession(s, checkout.sessionId), EntitlementDeniedError);
    assert.deepEqual(writes, []);
    assert.deepEqual(await s.listSystemSettings(""), before);
  });
}

test("direct PayToday event rejection performs no writes in an empty workspace", async () => {
  const s = new InMemoryStorage();
  for (const provider of ["paytoday", "PayToday", "PAYTODAY"]) {
    const before = await s.listSystemSettings("");
    await assert.rejects(() => applyBillingEvent(s, { accountId: "empty", provider, providerEventId: "blocked",
      eventType: "subscription.created", planId: "premium" }), EntitlementDeniedError);
    assert.deepEqual(await s.listSystemSettings(""), before);
  }
});
