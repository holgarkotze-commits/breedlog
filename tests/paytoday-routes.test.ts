import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import { registerRoutes } from "../server/routes";
import { storage, InMemoryStorage } from "../server/storage";
import { registerPayTodayReturns, createAnnualCheckout } from "../server/paytoday-routes";
import { fixture } from "./helpers/paytoday-fixture";

test("real HTTP routes reject unavailable payments, forged callbacks and cross-product webhooks", async t => {
  process.env.BILLING_WEBHOOK_SECRET = "fixture-webhook-secret";
  const app = express();
  app.use(express.json({ verify(req, _res, buffer) { (req as any).rawBody = buffer; } }));
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const headers = (who: string) => ({
    "Content-Type": "application/json", "x-test-user-id": who, "x-test-device-id": who,
  });
  const post = (path: string, body: any, who = "paytoday-route-owner") => fetch(base + path, {
    method: "POST", headers: headers(who), body: JSON.stringify(body),
  });
  try {
    await t.test("no contract: checkout and return are unavailable, no activation", async () => {
      assert.equal((await post("/api/billing/checkout-session", { provider: "paytoday", productCode: "premium_annual" })).status, 503);
      const response = await fetch(base + "/api/billing/paytoday/return?order=BREEDLOG-" + "A".repeat(32) + "&status=success&token=forged",
        { headers: headers("paytoday-route-owner") });
      assert.equal(response.status, 503);
      assert.ok(!JSON.stringify(await response.json()).includes("forged"));
      assert.equal(await storage.getSystemSetting("commercial:entitlement:paytoday-route-owner"), undefined);
    });
    await t.test("generic webhook rejects PayToday and other product/merchant payloads even if signed", async () => {
      for (const [provider, extra] of [
        ["paytoday", {}], ["fmd", {}], ["test-provider", { provider: "paytoday" }],
        ["test-provider", { product: "FMD-KIT" }], ["test-provider", { metadata: { merchant: "fmd" } }],
        ["test-provider", { metadata: { productCode: "fmd_annual" } }],
      ] as const) {
        const body = JSON.stringify({ providerEventId: "forged-event", accountId: "paytoday-route-owner",
          eventType: "subscription.created", planId: "premium", ...extra });
        const response = await fetch(base + "/api/billing/webhook/" + provider, {
          method: "POST", body, headers: { "Content-Type": "application/json",
            "X-BreedLog-Signature": createHmac("sha256", "fixture-webhook-secret").update(body).digest("hex") },
        });
        assert.equal(response.status, 403);
      }
      assert.equal(await storage.getSystemSetting("commercial:entitlement:paytoday-route-owner"), undefined);
    });
    await t.test("test checkout completion cannot operate on another tenant's session", async () => {
      const r = await post("/api/billing/checkout-session", { productCode: "premium_annual" });
      assert.equal(r.status, 201);
      const checkout = await r.json();
      assert.equal((await post("/api/billing/test/checkout/" + checkout.sessionId + "/complete", {}, "paytoday-route-attacker")).status, 404);
      assert.equal(await storage.getSystemSetting("commercial:entitlement:paytoday-route-owner"), undefined);
      assert.equal((await post("/api/billing/test/checkout/" + checkout.sessionId + "/complete", {})).status, 200);
    });
    await t.test("anonymous reconciliation is denied", async () => {
      const r = await fetch(base + "/api/billing/paytoday/reconcile", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      assert.equal(r.status, 401);
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("protected return handler ignores forged browser success and uses only stored intent", async () => {
  const store = new InMemoryStorage(), f = fixture(store.paymentTransaction), order = await f.create();
  f.edit(p => { p.intent.transaction_status = "pending"; });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).deviceAuth = { userId: f.workspace }; next(); });
  registerPayTodayReturns(app, (_req, _res, next) => next(), f.service);
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    let r = await fetch(base + "/api/billing/paytoday/return?order=" + order.orderId + "&status=success&payment_intent_token=FORGED");
    assert.equal(r.status, 200); assert.equal((await r.json()).status, "pending");
    assert.equal(await store.getSystemSetting("commercial:entitlement:" + f.workspace), undefined);
    assert.ok(!f.calls.some(c => c.url.includes("FORGED")));
    assert.equal(r.headers.get("cache-control"), "no-store");
    f.edit(p => { p.intent.transaction_status = "success"; });
    r = await fetch(base + "/api/billing/paytoday/reconcile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: order.orderId, token: "FORGED", amount: 1, status: "failed" }),
    });
    assert.equal(r.status, 200);
    const body = await r.text();
    assert.ok(!body.includes("secret") && !body.includes("token")); assert.equal(JSON.parse(body).status, "paid");
    await assert.rejects(() => createAnnualCheckout(f.service, f.workspace, {
      provider: "paytoday", productCode: "premium_annual", contact: f.contact, amountMinor: 1,
    }));
    await assert.rejects(() => createAnnualCheckout(f.service, f.workspace, {
      provider: "paytoday", productCode: "fmd_kit", contact: f.contact,
    }));
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
