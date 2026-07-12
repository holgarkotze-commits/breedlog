import assert from "node:assert/strict";
import test from "node:test";
import { BREEDLOG_PLANS, BREEDLOG_PRICING_VERSION } from "../shared/commercial";
import {
  EntitlementDeniedError,
  applyBillingEvent,
  assertCanCreateAnimal,
  getEntitlementState,
  projectDowngradedAnimalVisibility,
  reserveUsage,
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
