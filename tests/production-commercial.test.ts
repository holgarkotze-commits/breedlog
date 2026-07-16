import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { BREEDLOG_PLANS, BREEDLOG_PRICING_VERSION } from "../shared/commercial";
import {
  BILLING_CATALOG,
  EntitlementDeniedError,
  applyBillingEvent,
  assertCanCreateAnimal,
  cancelBillingSubscription,
  completeTestCheckoutSession,
  createBillingPortalSession,
  createCheckoutSession,
  getBillingSubscriptionState,
  getEntitlementState,
  listBillingAuditEntries,
  projectDowngradedAnimalVisibility,
  reserveUsage,
  simulateBillingProviderEvent,
  verifyBillingSignature,
} from "../server/commercial";
import { storage } from "../server/storage";

function animal(index: number) {
  return {
    tagId: `BL-${String(index).padStart(4, "0")}`,
    name: `Animal ${index}`,
    sex: index % 2 === 0 ? "ewe" : "ram",
    status: "active",
  };
}

test("locked commercial catalogue exposes exactly Free and Premium plans", () => {
  assert.deepEqual(Object.keys(BREEDLOG_PLANS).sort(), ["free", "premium"]);
  assert.equal(BREEDLOG_PLANS.free.limits.activeAnimals, 30);
  assert.equal(BREEDLOG_PLANS.free.limits.individualPdfExportsPerMonth, 5);
  assert.equal(BREEDLOG_PLANS.free.limits.aiActionsPerMonth, 10);
  assert.equal(BREEDLOG_PLANS.free.limits.activeDevices, 1);
  assert.equal(BREEDLOG_PLANS.free.limits.retainedWeeklyAutomaticBackups, 4);
  assert.equal(BREEDLOG_PLANS.premium.priceNadMonthly, 149);
  assert.equal(BREEDLOG_PLANS.premium.priceNadYearly, 1520);
  assert.equal(BREEDLOG_PLANS.premium.limits.activeAnimals, "unlimited");
  assert.equal(BREEDLOG_PLANS.premium.limits.activeDevices, 3);
  assert.equal(BREEDLOG_PLANS.premium.limits.individualPdfExportsPerMonth, 1000);
  assert.equal(BREEDLOG_PLANS.premium.limits.batchPdfExportsPerMonth, 50);
});

test("Free accounts are server-limited to 30 active animals", async () => {
  const userId = "commercial-free-limit";
  await storage.clearAllData(userId);
  for (let i = 1; i <= 30; i++) {
    await assertCanCreateAnimal(storage, userId);
    await storage.createAnimal(userId, animal(i));
  }
  await assert.rejects(() => assertCanCreateAnimal(storage, userId), (error) => {
    assert.equal(error instanceof EntitlementDeniedError, true);
    assert.equal((error as EntitlementDeniedError).code, "ACTIVE_ANIMAL_LIMIT_REACHED");
    return true;
  });
});

test("Premium billing events unlock unlimited active animals and are idempotent", async () => {
  const userId = "commercial-premium-idempotent";
  await storage.clearAllData(userId);
  const event = {
    provider: "test",
    providerEventId: "evt-premium-1",
    accountId: userId,
    eventType: "subscription.created" as const,
    planId: "premium" as const,
    subscriptionId: "sub_1",
    customerId: "cus_1",
  };
  assert.equal((await applyBillingEvent(storage, event)).idempotent, false);
  assert.equal((await applyBillingEvent(storage, event)).idempotent, true);
  const entitlement = await getEntitlementState(storage, userId);
  assert.equal(entitlement.planId, "premium");
  assert.equal(entitlement.pricingVersion, BREEDLOG_PRICING_VERSION);

  for (let i = 1; i <= 35; i++) {
    await assertCanCreateAnimal(storage, userId);
    await storage.createAnimal(userId, animal(i));
  }
  assert.equal((await storage.getAnimals(userId, { status: "active" })).length, 35);
});

test("downgrade keeps first 30 originally added animals visible without deleting later animals", async () => {
  const userId = "commercial-downgrade-projection";
  await storage.clearAllData(userId);
  await applyBillingEvent(storage, {
    provider: "test",
    providerEventId: "evt-premium-downgrade",
    accountId: userId,
    eventType: "subscription.created",
    planId: "premium",
  });
  for (let i = 1; i <= 34; i++) {
    await storage.createAnimal(userId, animal(i));
  }
  const projection = projectDowngradedAnimalVisibility(await storage.getAnimals(userId, {}));
  assert.equal(projection.visible.length, 30);
  assert.equal(projection.hidden.length, 4);
  assert.deepEqual(projection.hidden.map((row) => row.tagId), ["BL-0031", "BL-0032", "BL-0033", "BL-0034"]);
});

test("Free monthly usage quotas are enforced by the backend usage ledger", async () => {
  const userId = "commercial-usage-quotas";
  await storage.clearAllData(userId);
  for (let i = 0; i < 5; i++) {
    await reserveUsage(storage, userId, "individualPdfExports", new Date("2026-07-13T00:00:00Z"));
  }
  await assert.rejects(
    () => reserveUsage(storage, userId, "individualPdfExports", new Date("2026-07-13T00:00:00Z")),
    /individualPdfExports monthly quota/,
  );
  await reserveUsage(storage, userId, "manualBackups", new Date("2026-07-13T00:00:00Z"));
  await assert.rejects(
    () => reserveUsage(storage, userId, "manualBackups", new Date("2026-07-15T00:00:00Z")),
    /rolling seven-day window/,
  );
  await reserveUsage(storage, userId, "manualBackups", new Date("2026-07-21T00:00:00Z"));
});

test("deterministic billing checkout, portal, cancellation, and provider events reconcile entitlement state", async () => {
  const userId = "commercial-deterministic-billing";
  await storage.clearAllData(userId);

  assert.equal(BILLING_CATALOG.premium_monthly.amountNad, 149);
  assert.equal(BILLING_CATALOG.premium_annual.amountNad, 1520);

  const checkout = await createCheckoutSession(storage, userId, "premium_monthly", {
    returnUrl: "https://app.breedlog.test/return",
    cancelUrl: "https://app.breedlog.test/cancel",
  });
  assert.equal(checkout.status, "pending");
  assert.match(checkout.checkoutUrl, /billing\.test\.breedlog\.local\/checkout\//);

  const portal = await createBillingPortalSession(storage, userId);
  assert.match(portal.url, /billing\.test\.breedlog\.local\/portal\//);

  const completed = await completeTestCheckoutSession(storage, checkout.sessionId, {
    now: new Date("2026-07-13T00:00:00Z"),
  });
  assert.equal(completed.session.status, "completed");
  assert.equal(completed.subscription.planId, "premium");
  assert.equal((await getEntitlementState(storage, userId)).planId, "premium");

  const cancelAtPeriodEnd = await cancelBillingSubscription(storage, userId, { atPeriodEnd: true });
  assert.equal(cancelAtPeriodEnd.cancelAtPeriodEnd, true);
  assert.equal((await getEntitlementState(storage, userId)).status, "active");

  let simulated = await simulateBillingProviderEvent(storage, userId, {
    eventType: "subscription.grace_period",
    now: new Date("2026-08-13T00:00:00Z"),
  });
  assert.equal(simulated.entitlement.status, "grace_period");

  simulated = await simulateBillingProviderEvent(storage, userId, {
    eventType: "subscription.payment_failed",
    now: new Date("2026-08-14T00:00:00Z"),
  });
  assert.equal(simulated.entitlement.status, "payment_failed");

  simulated = await simulateBillingProviderEvent(storage, userId, {
    eventType: "subscription.renewed",
    now: new Date("2026-08-15T00:00:00Z"),
  });
  assert.equal(simulated.entitlement.status, "active");
  assert.equal((await getBillingSubscriptionState(storage, userId))?.status, "active");

  simulated = await simulateBillingProviderEvent(storage, userId, {
    eventType: "subscription.refunded",
    now: new Date("2026-08-16T00:00:00Z"),
  });
  assert.equal(simulated.entitlement.planId, "free");
  assert.equal(simulated.entitlement.status, "refunded");

  const audit = await listBillingAuditEntries(storage, userId);
  assert.ok(audit.some((entry) => entry.eventType === "checkout.session_created"));
  assert.ok(audit.some((entry) => entry.eventType === "checkout.completed"));
  assert.ok(audit.some((entry) => entry.eventType === "subscription.refunded"));
});

test("annual billing, webhook signatures, and quota add-ons remain deterministic", async () => {
  const userId = "commercial-annual-addon";
  await storage.clearAllData(userId);

  const annualCheckout = await createCheckoutSession(storage, userId, "premium_annual", {
    returnUrl: "https://app.breedlog.test/return",
    cancelUrl: "https://app.breedlog.test/cancel",
  });
  const annualCompleted = await completeTestCheckoutSession(storage, annualCheckout.sessionId, {
    now: new Date("2026-07-13T00:00:00Z"),
  });
  assert.equal(annualCompleted.subscription.billingPeriod, "annual");
  assert.equal(annualCompleted.subscription.currentPeriodEnd, "2027-07-13T00:00:00.000Z");

  const addonCheckout = await createCheckoutSession(storage, userId, "addon_pdf_250");
  const addonCompleted = await completeTestCheckoutSession(storage, addonCheckout.sessionId, {
    now: new Date("2026-07-13T01:00:00Z"),
  });
  assert.equal(addonCompleted.subscription.addOns.includes("addon_pdf_250"), true);

  for (let i = 0; i < 1250; i += 1) {
    await reserveUsage(storage, userId, "individualPdfExports", new Date("2026-07-13T00:00:00Z"));
  }
  await assert.rejects(
    () => reserveUsage(storage, userId, "individualPdfExports", new Date("2026-07-13T00:00:00Z")),
    /individualPdfExports monthly quota/,
  );

  const body = JSON.stringify({
    provider: "test-provider",
    providerEventId: "evt-reversal-1",
    accountId: userId,
    eventType: "subscription.reversed",
    planId: "premium",
  });
  const secret = "webhook-secret";
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyBillingSignature(body, signature, secret), true);
  assert.equal(verifyBillingSignature(body, "bad-signature", secret), false);

  const reversed = await simulateBillingProviderEvent(storage, userId, {
    eventType: "subscription.reversed",
    now: new Date("2026-08-13T00:00:00Z"),
  });
  assert.equal(reversed.entitlement.planId, "free");
  assert.equal(reversed.entitlement.status, "refunded");
});

test("immediate cancellation downgrades Premium entitlements back to Free limits", async () => {
  const userId = "commercial-immediate-cancel";
  await storage.clearAllData(userId);

  const checkout = await createCheckoutSession(storage, userId, "premium_monthly");
  await completeTestCheckoutSession(storage, checkout.sessionId, {
    now: new Date("2026-07-13T00:00:00Z"),
  });
  assert.equal((await getEntitlementState(storage, userId)).planId, "premium");

  const cancelled = await cancelBillingSubscription(storage, userId, { atPeriodEnd: false });
  assert.equal(cancelled.cancelAtPeriodEnd, false);

  const entitlement = await getEntitlementState(storage, userId);
  assert.equal(entitlement.planId, "free");
  assert.equal(entitlement.status, "cancelled");
});
