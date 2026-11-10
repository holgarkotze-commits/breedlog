import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStorage } from "../server/storage";
import { AnnualPayToday, assertAnnualConfig, runtimeAnnualConfig } from "../server/paytoday-annual";
import { fixture, fixtureConfig, annualConformance } from "./helpers/paytoday-fixture";
import { installedPayTodayContract } from "../server/paytoday-adapter";
import { applyBillingEvent, getEntitlementState, getBillingSubscriptionState, cancelBillingSubscription,
  createCheckoutSession, completeTestCheckoutSession } from "../server/commercial";
import { BREEDLOG_PLANS } from "../shared/commercial";

test("annual candidate memory transaction conformance", async t => {
  const storage = new InMemoryStorage();
  await annualConformance(t, storage.paymentTransaction);
});

test("gates default off, no verified contract installed, flags alone cannot enable", () => {
  assert.equal(runtimeAnnualConfig(), undefined);
  const old = process.env.BREEDLOG_PAYTODAY_ENABLED;
  try {
    process.env.BREEDLOG_PAYTODAY_ENABLED = "1";
    assert.equal(installedPayTodayContract(), undefined);
    assert.equal(runtimeAnnualConfig(), undefined);
  } finally {
    if (old === undefined) delete process.env.BREEDLOG_PAYTODAY_ENABLED;
    else process.env.BREEDLOG_PAYTODAY_ENABLED = old;
  }
  assert.throws(() => assertAnnualConfig(undefined));
  for (const key of ["merchantAuthorizationRef", "priceApprovalRef", "contractEvidenceRef"] as const) {
    const config = fixtureConfig(); config[key] = "";
    assert.throws(() => assertAnnualConfig(config));
  }
  for (const patch of [{ currency: "ZAR" }, { amountMinor: 0 }, { amountMinor: 12.5 },
    { product: "fmd" }, { provider: "other" }, { version: "" }, { merchant: "" }, { contractVersion: "" }]) {
    const config = fixtureConfig(); Object.assign(config.offer, patch);
    assert.throws(() => assertAnnualConfig(config));
  }
  const config = fixtureConfig(); config.enabled = false;
  assert.throws(() => new AnnualPayToday(config, new InMemoryStorage().paymentTransaction, {} as any));
  assert.equal(BREEDLOG_PLANS.premium.priceNadYearly, 1520, "existing public pricing unchanged");
});

test("expired annual entitlement downgrades without deleting livestock or extending access", async () => {
  const storage = new InMemoryStorage(), f = fixture(storage.paymentTransaction);
  await storage.createAnimal(f.workspace, { tagId: "fixture-herd-preserved", sex: "ewe", status: "active" } as any);
  const existingHerd = await storage.getAnimals(f.workspace, {});
  const o = await f.create();
  await f.service.reconcile(f.workspace, o.orderId);
  const key = "commercial:entitlement:" + f.workspace;
  const ent = JSON.parse((await storage.getSystemSetting(key))!);
  await storage.setSystemSetting(key, JSON.stringify({ ...ent, paidUntil: "2000-01-01T00:00:00Z" }));
  assert.equal((await getEntitlementState(storage, f.workspace)).planId, "free");
  assert.deepEqual(await storage.getAnimals(f.workspace, {}), existingHerd);
  const sk = "commercial:subscription:" + f.workspace;
  const sub = JSON.parse((await storage.getSystemSetting(sk))!);
  await storage.setSystemSetting(sk, JSON.stringify({ ...sub, currentPeriodEnd: "2000-01-01T00:00:00Z" }));
  assert.equal((await getBillingSubscriptionState(storage, f.workspace))!.status, "expired");
  await assert.rejects(() => cancelBillingSubscription(storage, f.workspace));
  await assert.rejects(() => applyBillingEvent(storage, {
    accountId: f.workspace, provider: "test-provider", providerEventId: "fake-regrant",
    eventType: "subscription.created", planId: "premium",
  }));
  await assert.rejects(() => applyBillingEvent(storage, {
    accountId: "another", provider: "paytoday", providerEventId: "fake-provider",
    eventType: "subscription.created", planId: "premium",
  }));
  const checkout = await createCheckoutSession(storage, f.workspace, "premium_annual");
  await assert.rejects(() => completeTestCheckoutSession(storage, checkout.sessionId));
  assert.equal((await getBillingSubscriptionState(storage, f.workspace))!.provider, "paytoday");
});
