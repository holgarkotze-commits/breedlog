import test from "node:test";
import assert from "node:assert/strict";
import { localizedPricing, defaultBillingCurrency, effectivePaidAccess, BREEDLOG_PLANS, BREEDLOG_PRICING_VERSION } from "../shared/commercial";
import { assertAnnualConfig } from "../server/paytoday-annual";
import { fixtureConfig } from "./helpers/paytoday-fixture";
import { InMemoryStorage } from "../server/storage";
import { getEntitlementState, projectDowngradedAnimalVisibility, assertCanCreateAnimal, createCheckoutSession } from "../server/commercial";

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
    pricingVersion: BREEDLOG_PRICING_VERSION, billingPeriod: "monthly", paidUntil: "2030-02-01T12:00:00.000Z", paymentOrderId: "original", renewalFailure: { verified: true as const, paidPeriodId: "original",
      dueAt: "2030-02-01T12:00:00.000Z", observedAt: "2030-02-01T12:00:00.000Z", renewalOrderId: "failed-renewal" } };
  const boundary = new Date("2030-02-01T12:00:00.000Z");
  for (const paidUntil of [undefined, "", "not-a-date", "2030-02-31T12:00:00Z", "2029-12-01T00:00:00Z"]) {
    assert.equal(effectivePaidAccess({ ...state, paidUntil }, boundary).planId, "free");
  }
  assert.equal(effectivePaidAccess({ ...state, renewalFailure: undefined }, boundary).planId, "free");
  assert.equal(effectivePaidAccess({ ...state, status: "grace_period", renewalFailure: undefined }, boundary).graceUntil, undefined);
  for (const patch of [{ dueAt: "2030-01-01T12:00:00Z" }, { paidPeriodId: "old-period" }, { observedAt: "2031-01-01T12:00:00Z" }, { verified: false }]) {
    assert.equal(effectivePaidAccess({ ...state, renewalFailure: { ...state.renewalFailure, ...patch } as any }, boundary).planId, "free");
  }
  assert.equal(effectivePaidAccess({ ...state, source: "internal_test", paidUntil: undefined }, boundary).planId, "premium");
  await store.setSystemSetting(`commercial:entitlement:${workspace}`, JSON.stringify(state));
  for (let i = 0; i < 35; i++) await store.createAnimal(workspace, { tagId: `GRACE-${i}`, sex: "ewe", status: i === 34 ? "culled" : "active" } as any);
  assert.equal((await getEntitlementState(store, workspace, new Date("2030-02-04T11:59:59.999Z"))).planId, "premium");
  assert.equal((await getEntitlementState(store, workspace, new Date("2030-02-04T12:00:00.000Z"))).planId, "free");
  const animals = await store.getAnimals(workspace, {}), projection = projectDowngradedAnimalVisibility(animals);
  assert.equal(animals.length, 35); assert.equal(projection.visible.length, 31); assert.equal(projection.hidden.length, 4);
  assert.ok(projection.visible.some(a => a.status === "culled"), "culled history remains visible");
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
  const deadline = "2030-02-04T12:00:00.000Z";
  const cases = [
    { planId: "premium", status: "active", paidUntil: "2000-01-01T00:00:00Z", expected: null },
    { planId: "premium", status: "active", graceUntil: deadline, expected: null },
    { planId: "premium", status: "grace_period", expected: null },
    { planId: "premium", status: "grace_period", graceUntil: "invalid", expected: null },
    { planId: "premium", status: "grace_period", graceUntil: "2030-02-31T00:00:00Z", expected: null },
    { planId: "premium", status: "grace_period", graceUntil: deadline, expected: /Premium remains active/ },
    { planId: "free", status: "expired", graceUntil: deadline, expected: /now on Free/ },
  ];
  for (const { expected, ...entitlement } of cases) {
    const client = new QueryClient(); client.setQueryData(["/api/entitlements/me"], { entitlement });
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Router, { ssrPath: "/settings" }, React.createElement(PaymentGraceNotice, { isAuthenticated: true }))));
    if (expected) {
      assert.match(markup, expected); assert.match(markup, /All records are preserved/); assert.ok(markup.includes(deadline));
    } else assert.equal(markup, "");
    client.clear();
  }
});

test("Free registration reuses slots freed by culled animals", async () => {
  const store = new InMemoryStorage(), id = "free-original-slots";
  for (let i = 0; i < 30; i++) {
    await assertCanCreateAnimal(store, id);
    await store.createAnimal(id, { tagId: `SLOT-${i}`, sex: "ewe", status: i < 2 ? "culled" : "active" } as any);
  }
  for (let i = 30; i < 32; i++) {
    await assertCanCreateAnimal(store, id);
    await store.createAnimal(id, { tagId: `SLOT-${i}`, sex: "ewe", status: "active" });
  }
  await assert.rejects(() => assertCanCreateAnimal(store, id), /30 active animals/);
  assert.equal(projectDowngradedAnimalVisibility(await store.getAnimals(id, {})).visible.length, 32);
});

test("unapproved PDF add-on sale is unavailable outside explicit simulator mode", async () => {
  const old = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    await assert.rejects(() => createCheckoutSession(new InMemoryStorage(), "addon-disabled", "addon_pdf_250"),
      (error: any) => error.code === "ADDON_SALES_UNAVAILABLE" && error.status === 503);
  } finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
});
