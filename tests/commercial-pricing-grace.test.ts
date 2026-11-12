import test from "node:test";
import assert from "node:assert/strict";
import { localizedPricing, defaultBillingCurrency, effectivePaidAccess, BREEDLOG_PLANS, BREEDLOG_PRICING_VERSION } from "../shared/commercial";
import { assertAnnualConfig } from "../server/paytoday-annual";
import { fixtureConfig } from "./helpers/paytoday-fixture";
import { InMemoryStorage } from "../server/storage";
import { getEntitlementState, projectDowngradedAnimalVisibility } from "../server/commercial";

test("approved NAD/ZAR minor-unit prices, savings and explicit non-chargeable international localization", () => {
  assert.deepEqual(Object.keys(BREEDLOG_PLANS), ["free", "premium"]);
  for (const country of ["NA", "ZA"]) {
    const p = localizedPricing(country);
    assert.equal(p.monthlyMinor, 7999); assert.equal(p.annualMinor, 79900);
    assert.equal(p.savingsMinor, 16088); assert.equal(p.annualSavingsPercent, 16.8); assert.equal(p.checkoutEnabled, false);
  }
  for (const [country, currency] of [["US", "USD"], ["GB", "GBP"], ["DE", "EUR"]]) {
    const p = localizedPricing(country); assert.equal(p.currency, currency); assert.equal(p.priceApproved, false);
    assert.equal(p.monthlyMinor, null); assert.equal(p.annualMinor, null); assert.equal(p.savingsMinor, null);
  }
  assert.equal(defaultBillingCurrency(undefined, "en-ZA"), "ZAR");
  assert.equal(defaultBillingCurrency(undefined, "en-ZA;q=0.9,en-US;q=0.8"), "ZAR");
  assert.equal(defaultBillingCurrency(undefined, "bg-BG"), "EUR");
  assert.equal(defaultBillingCurrency("NA", "en-US"), "NAD");
  assert.equal(localizedPricing("US", "en-US", "ZAR").currency, "ZAR");
  for (const currency of ["NAD", "ZAR"]) for (const interval of ["monthly", "annual"]) {
    const c = fixtureConfig(); c.offer = { ...c.offer, environment: "production", currency,
      product: interval === "monthly" ? "breedlog_premium_monthly" : "breedlog_premium_annual",
      amountMinor: interval === "monthly" ? 7999 : 79900, version: BREEDLOG_PRICING_VERSION };
    assert.doesNotThrow(() => assertAnnualConfig(c));
    c.offer = { ...c.offer, amountMinor: 1 }; assert.throws(() => assertAnnualConfig(c));
    c.offer = { ...c.offer, currency: "USD" }; assert.throws(() => assertAnnualConfig(c));
  }
});

test("server-authoritative grace ends exactly at 72h, preserves all records and restores visibility", async () => {
  const store = new InMemoryStorage(), workspace = "grace-preserved-farm";
  const state = { accountId: workspace, planId: "premium" as const, status: "active" as const, source: "billing_event",
    pricingVersion: BREEDLOG_PRICING_VERSION, billingPeriod: "monthly", paidUntil: "2030-02-01T12:00:00.000Z", paymentOrderId: "original" };
  await store.setSystemSetting(`commercial:entitlement:${workspace}`, JSON.stringify(state));
  for (let i = 0; i < 35; i++) await store.createAnimal(workspace, { tagId: `GRACE-${i}`, sex: "ewe", status: i === 34 ? "culled" : "active" } as any);
  assert.equal((await getEntitlementState(store, workspace, new Date("2030-02-04T11:59:59.999Z"))).planId, "premium");
  assert.equal((await getEntitlementState(store, workspace, new Date("2030-02-04T12:00:00.000Z"))).planId, "free");
  const animals = await store.getAnimals(workspace, {}), projection = projectDowngradedAnimalVisibility(animals);
  assert.equal(animals.length, 35); assert.equal(projection.visible.length, 30); assert.equal(projection.hidden.length, 5);
  assert.ok(projection.hidden.some(a => a.status === "culled"), "archiving a hidden animal cannot expose it");
  await store.setSystemSetting(`commercial:entitlement:${workspace}`, JSON.stringify({ ...state, paidUntil: "2030-03-01T12:00:00Z", paymentOrderId: "verified-renewal" }));
  assert.equal((await getEntitlementState(store, workspace, new Date("2030-02-05T00:00:00Z"))).planId, "premium");
  assert.deepEqual(await store.getAnimals(workspace, {}), animals);
  for (const status of ["refunded", "cancelled"]) assert.equal(effectivePaidAccess({ ...state, planId: "free" as const, status }, new Date("2030-02-02")).planId, "free");
});

test("renewal notice is visible across app screens for grace and expired access", async () => {
  const React = await import("react"), { renderToStaticMarkup } = await import("react-dom/server");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const { PaymentGraceNotice } = await import("../client/src/components/PaymentGraceNotice");
  const { Router } = await import("wouter");
  const now = Date.now();
  for (const [age, active] of [[3600000, true], [73 * 3600000, false]] as const) {
    const client = new QueryClient();
    const due = now - age;
    client.setQueryData(["/api/entitlements/me"], { entitlement: { planId: "premium", status: "active", billingPeriod: "monthly", paidUntil: new Date(due).toISOString() } });
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Router, { ssrPath: "/settings" }, React.createElement(PaymentGraceNotice, { isAuthenticated: true }))));
    assert.match(markup, /role="status"/); assert.match(markup, /All records are preserved/); assert.match(markup, /href="\/settings"/);
    assert.ok(markup.includes(new Date(due + 72 * 3600000).toISOString()));
    assert.match(markup, active ? /Premium remains active/ : /now on Free/);
    client.clear();
  }
});
