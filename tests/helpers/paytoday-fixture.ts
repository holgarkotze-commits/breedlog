import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { AnnualPayToday, type AnnualPaymentConfig } from "../../server/paytoday-annual";
import { PayTodayAdapter, type VerifiedPayTodayContract } from "../../server/paytoday-adapter";
import type { PaymentTransact } from "../../server/paytoday-types";

// SYNTHETIC signed test contract. Not a claim about PayToday JWT algorithms,
// field names, currency conventions or merchant verification.
const fixtureKey = "synthetic-provider-signing-key-for-tests-only";
function sign(payload: unknown) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return data + "." + createHmac("sha256", fixtureKey).update(data).digest("base64url");
}
export const fixtureContract: VerifiedPayTodayContract = {
  evidenceRef: "TEST-ONLY-SYNTHETIC-CONTRACT",
  version: "test-contract",
  async verifyJwt(token) {
    const [data, sig] = token.split(".");
    assert.equal(sig, createHmac("sha256", fixtureKey).update(data).digest("base64url"));
    return JSON.parse(Buffer.from(data, "base64url").toString());
  },
  context(claims) {
    return claims.fixtureMerchant && claims.fixtureCurrency
      ? { merchant: claims.fixtureMerchant, currency: claims.fixtureCurrency } : undefined;
  },
  finalizedTransaction(claims) {
    // Entirely synthetic field mapping; NOT copied provider/private contract.
    return (claims.intent ?? claims.data?.intent)?.transaction_data?.fixtureFinalized;
  },
  intentNonPayable: claims => claims.fixtureIntentNonPayable === true,
  amountToProvider: minor => minor / 100,
  amountFromProvider: amount => typeof amount === "number" && Number.isSafeInteger(amount * 100) ? amount * 100 : undefined,
  allowedPaymentOrigins: ["https://fixture-payment.invalid"],
};

export const fixtureConfig = (): AnnualPaymentConfig => ({
  enabled: true, merchantAuthorizationRef: "TEST-MERCHANT-APPROVAL",
  priceApprovalRef: "TEST-PRICE-APPROVAL", contractEvidenceRef: fixtureContract.evidenceRef,
  offer: { product: "breedlog_premium_annual", provider: "paytoday", amountMinor: 12300,
    currency: "NAD", version: "TEST-PRICE-NOT-A-PUBLIC-OFFER", merchant: "test-breedlog-merchant",
    environment: "sandbox", contractVersion: "test-contract" },
  encryptionKey: Buffer.alloc(32, 7), returnOrigin: "https://breedlog-fixture.invalid",
});

export function fixture(transact: PaymentTransact, override?: AnnualPaymentConfig) {
  const config = override ?? fixtureConfig();
  const calls: { url: string; init?: RequestInit }[] = [];
  const intents = new Map<string, Record<string, any>>();
  let failure = false, corruptJwt = false;
  let lastInvoice = "";
  const network: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (failure) throw new Error("provider-secret-intent-token-must-not-leak");
    assert.ok(url.startsWith("https://admin.today-ww.net/"));
    let payload: any;
    if (url.endsWith("/web/configuration/intent/")) {
      const body = JSON.parse(init!.body as string);
      assert.deepEqual(body, { v: "12.12.2024", handle: config.offer.merchant, key: "fixture-shop-secret" });
      payload = { data: { status: "success", authorization: { access_token: "fixture-access-secret" } } };
    } else if (url.endsWith("/web/create/payment/intent/")) {
      const body = JSON.parse(init!.body as string);
      assert.equal((init!.headers as any).Authorization, "Bearer fixture-access-secret");
      assert.ok(body.invoice_number.startsWith("BREEDLOG-"));
      assert.equal(body.amount, 123);
      assert.equal(body.return_url, config.returnOrigin + "/api/billing/paytoday/return?order=" + body.invoice_number);
      lastInvoice = body.invoice_number;
      const token = "intent-secret-" + randomUUID();
      intents.set(token, {
        intent: { transaction_status: "success", invoice_number: lastInvoice, amount: 123, payment_token: "intent-id-" + randomUUID(),
          transaction_data: { fixtureFinalized: {
            reference: "transaction-secret-" + randomUUID(), status: "success", finalizedAt: now.toISOString(),
            invoice: lastInvoice, amountMinor: 12300, merchant: config.offer.merchant, currency: config.offer.currency,
          } } },
        fixtureMerchant: config.offer.merchant, fixtureCurrency: config.offer.currency,
      });
      payload = { data: { payment_url: "https://fixture-payment.invalid/pay/" + lastInvoice, payment_intent_token: token } };
    } else {
      assert.equal(init!.method, "GET");
      const token = decodeURIComponent(url.split("/web/payment/lookup/")[1].slice(0, -1));
      payload = intents.get(token);
      assert.ok(payload, "lookup must use a token stored by create");
    }
    return new Response(JSON.stringify({ token: corruptJwt ? "forged.payload" : sign(payload) }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const adapter = new PayTodayAdapter("sandbox", { handle: config.offer.merchant, key: "fixture-shop-secret" }, fixtureContract, network);
  let now = new Date("2030-01-01T12:00:00Z");
  const restart = (tx: PaymentTransact = transact, approvedConfig = config, recovery = false) => new AnnualPayToday(approvedConfig, tx, recovery ? {
    create: adapter.create.bind(adapter), lookup: adapter.lookup.bind(adapter),
    // Synthetic invoice recovery only; not a claim about any provider endpoint.
    async recoverIntent(invoice, offer) {
      assert.equal(offer.merchant, config.offer.merchant);
      const matches = [...intents].filter(([, p]) => p.intent.invoice_number === invoice);
      assert.equal(matches.length, 1);
      return { token: matches[0][0] };
    },
  } : adapter, () => now);
  const service = restart();
  const workspace = "test-" + randomUUID().slice(0, 12);
  const contact = { firstName: "Fixture", lastName: "Only", email: "fixture@example.invalid", phone: "000" };
  const create = () => service.create(workspace, contact);
  const edit = (fn: (payload: any) => void) => {
    const entry = [...intents.values()].find(p => (p.intent ?? p.data?.intent)?.invoice_number === lastInvoice);
    assert.ok(entry);
    fn(entry);
  };
  return {
    config, calls, intents, service, workspace, contact, create, edit, restart,
    lastInvoice: () => lastInvoice,
    setNow: (date: string) => { now = new Date(date); },
    fail: (value: boolean) => { failure = value; },
    forge: () => { corruptJwt = true; },
  };
}

export async function annualConformance(
  t: { test: (name: string, fn: () => Promise<void>) => Promise<unknown> },
  transact: PaymentTransact,
  freshTransact: () => PaymentTransact = () => transact,
) {
  const setting = (w: string, prefix: string) => transact(w, tx => tx.getSetting(prefix + w));
  await t.test("success atomically binds annual payment, workspace, subscription and fixed period", async () => {
    const f = fixture(transact), o = await f.create();
    assert.deepEqual(Object.keys(o).sort(), ["checkoutUrl", "orderId", "status"]);
    const result = await f.service.reconcile(f.workspace, o.orderId);
    assert.equal(result.status, "paid");
    assert.equal(result.periodEnd, "2031-01-01T12:00:00.000Z");
    const ent = JSON.parse((await setting(f.workspace, "commercial:entitlement:"))!);
    const sub = JSON.parse((await setting(f.workspace, "commercial:subscription:"))!);
    assert.equal(ent.planId, "premium"); assert.equal(ent.paymentOrderId, o.orderId);
    assert.equal(sub.paymentOrderId, o.orderId); assert.equal(sub.autoRenew, false);
    const saved = await transact(f.workspace, tx => tx.getOrder(o.orderId));
    assert.equal(saved!.state.status, "paid");
    assert.ok(saved!.state.paymentHash); assert.equal(saved!.state.periodEnd, ent.paidUntil);
    const json = JSON.stringify(saved);
    assert.ok(!json.includes("intent-secret-") && !json.includes("transaction-secret-") && !json.includes("fixture-access-secret"));
    assert.ok(!JSON.stringify(result).includes("token"));
  });
  for (const status of ["pending", "failed", "cancelled", "canceled", "refunded", "reversed", "unknown", "SUCCESS", " success"]) {
    await t.test(`${status} cannot grant annual access`, async () => {
      const f = fixture(transact), o = await f.create();
      f.edit(p => { p.intent.transaction_status = status; });
      const r = await f.service.reconcile(f.workspace, o.orderId);
      assert.notEqual(r.status, "paid");
      assert.equal(await setting(f.workspace, "commercial:entitlement:"), undefined);
      if (["refunded", "reversed"].includes(status)) {
        f.edit(p => { p.intent.transaction_status = "success"; });
        assert.notEqual((await f.service.reconcile(f.workspace, o.orderId)).status, "paid");
      } else {
        f.edit(p => { p.intent.transaction_status = "success"; });
        assert.equal((await f.service.reconcile(f.workspace, o.orderId)).status, "paid");
      }
    });
  }
  const mismatches: [string, (p: any) => void][] = [
    ["missing invoice", p => { delete p.intent.invoice_number; }],
    ["FMD invoice", p => { p.intent.invoice_number = "FMD-WRONG-PRODUCT"; }],
    ["wrong invoice", p => { p.intent.invoice_number = "BREEDLOG-" + "A".repeat(32); }],
    ["missing amount", p => { delete p.intent.amount; }],
    ["wrong amount", p => { p.intent.amount = 122; }],
    ["string amount unsupported", p => { p.intent.amount = "123"; }],
    ["missing currency", p => { delete p.fixtureCurrency; }],
    ["wrong currency", p => { p.fixtureCurrency = "ZAR"; }],
    ["missing merchant", p => { delete p.fixtureMerchant; }],
    ["FMD merchant", p => { p.fixtureMerchant = "fmd-fixture-merchant"; }],
    ["missing payment binding", p => { delete p.intent.payment_token; }],
    ["missing finalized transaction", p => { delete p.intent.transaction_data; }],
    ["missing transaction reference", p => { delete p.intent.transaction_data.fixtureFinalized.reference; }],
    ["blank transaction reference", p => { p.intent.transaction_data.fixtureFinalized.reference = " "; }],
    ["missing transaction timestamp", p => { delete p.intent.transaction_data.fixtureFinalized.finalizedAt; }],
    ["future transaction timestamp", p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01T12:01:00Z"; }],
    ["transaction before order", p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01T11:59:59Z"; }],
    ["invalid calendar timestamp", p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-02-30T12:00:00Z"; }],
    ["ambiguous timestamp", p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01 12:00:00"; }],
    ["unconfirmed transaction status", p => { p.intent.transaction_data.fixtureFinalized.status = "pending"; }],
    ["mismatched finalized invoice", p => { p.intent.transaction_data.fixtureFinalized.invoice = "FMD-fixture"; }],
    ["mismatched finalized amount", p => { p.intent.transaction_data.fixtureFinalized.amountMinor = 1; }],
    ["mismatched finalized merchant", p => { p.intent.transaction_data.fixtureFinalized.merchant = "other-fixture"; }],
    ["mismatched finalized currency", p => { p.intent.transaction_data.fixtureFinalized.currency = "ZAR"; }],
  ];
  for (const [label, change] of mismatches) await t.test(`${label} fails closed`, async () => {
    const f = fixture(transact), o = await f.create();
    f.edit(change);
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId));
    assert.equal(await setting(f.workspace, "commercial:entitlement:"), undefined);
  });
  await t.test("both observed intent envelope locations are supported after verification", async () => {
    const f = fixture(transact), o = await f.create();
    f.edit(p => { p.data = { intent: p.intent }; delete p.intent; });
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).status, "paid");
  });
  await t.test("cross-workspace lookup fails before provider network", async () => {
    const f = fixture(transact), o = await f.create(), count = f.calls.length;
    await assert.rejects(() => f.service.reconcile("other-workspace", o.orderId));
    assert.equal(f.calls.length, count);
  });
  await t.test("concurrent duplicate/restart replay never extends the original annual period", async () => {
    const f = fixture(transact), o = await f.create();
    const results = await Promise.all(Array.from({ length: 12 }, () => f.service.reconcile(f.workspace, o.orderId)));
    assert.ok(results.every(r => r.status === "paid" && r.periodEnd === results[0].periodEnd));
    f.setNow("2030-02-01T12:00:00Z");
    assert.equal((await f.restart(freshTransact()).reconcile(f.workspace, o.orderId)).periodEnd, results[0].periodEnd);
    await assert.rejects(f.create); // no overlapping paid periods
    f.setNow("2032-01-01T12:00:00Z");
    const replay = await f.restart().reconcile(f.workspace, o.orderId);
    assert.equal(replay.status, "expired"); assert.equal(replay.periodEnd, results[0].periodEnd);
  });
  await t.test("same financial transaction with distinct intent identifiers cannot bind to a second order or tenant", async () => {
    const a = fixture(transact), b = fixture(transact), oa = await a.create(), ob = await b.create();
    let reference = "";
    a.edit(p => { reference = p.intent.transaction_data.fixtureFinalized.reference; });
    b.edit(p => { p.intent.transaction_data.fixtureFinalized.reference = reference; });
    await a.service.reconcile(a.workspace, oa.orderId);
    await assert.rejects(() => b.service.reconcile(b.workspace, ob.orderId));
    assert.equal(await setting(b.workspace, "commercial:entitlement:"), undefined);
  });
  await t.test("fault after writes rolls everything back; stored intent can retry without double grant", async () => {
    const f = fixture(transact), o = await f.create();
    let fail = true;
    const fault: PaymentTransact = (w, run) => transact(w, async tx => {
      const result = await run(tx);
      const saved = await tx.getOrder(o.orderId);
      if (fail && saved?.state.status === "paid") { fail = false; throw Error("injected commit fault"); }
      return result;
    });
    await assert.rejects(() => f.restart(fault).reconcile(f.workspace, o.orderId));
    assert.equal(await setting(f.workspace, "commercial:entitlement:"), undefined);
    assert.equal(await setting(f.workspace, "commercial:subscription:"), undefined);
    assert.equal((await transact(f.workspace, tx => tx.getOrder(o.orderId)))!.state.status, "pending");
    assert.equal((await f.restart(freshTransact()).reconcile(f.workspace, o.orderId)).status, "paid");
  });
  await t.test("provider exception and forged JWT are redacted and grant nothing", async () => {
    const f = fixture(transact), o = await f.create();
    f.fail(true);
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId), err =>
      err instanceof Error && !err.message.includes("secret"));
    f.fail(false); f.forge();
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId));
    assert.equal(await setting(f.workspace, "commercial:entitlement:"), undefined);
  });
  await t.test("payment actually finalized at the intent window boundary cannot activate", async () => {
    const f = fixture(transact), o = await f.create();
    f.setNow("2030-01-01T12:30:00Z");
    f.edit(p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01T12:30:00Z"; });
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId));
    assert.equal(await setting(f.workspace, "commercial:entitlement:"), undefined);
  });
  await t.test("late query rejects a payment actually finalized after the permitted window", async () => {
    const f = fixture(transact), o = await f.create();
    f.setNow("2030-01-04T12:00:00Z");
    f.edit(p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01T12:31:00Z"; });
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId));
    assert.equal(await setting(f.workspace, "commercial:entitlement:"), undefined);
  });
  for (const arrival of ["2030-01-01T20:00:00Z", "2030-01-04T12:00:00Z"]) {
    await t.test(`timely payment confirmed at ${arrival} keeps payment-time annual period`, async () => {
      const f = fixture(transact), o = await f.create();
      f.edit(p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01T12:05:00Z"; });
      f.setNow(arrival);
      const result = await f.service.reconcile(f.workspace, o.orderId);
      assert.equal(result.status, "paid"); assert.equal(result.periodEnd, "2031-01-01T12:05:00.000Z");
      const ent = JSON.parse((await setting(f.workspace, "commercial:entitlement:"))!);
      assert.equal(ent.effectiveAt, "2030-01-01T12:05:00.000Z");
      f.setNow("2030-02-01T12:00:00Z");
      assert.equal((await f.restart(freshTransact()).reconcile(f.workspace, o.orderId)).periodEnd, result.periodEnd);
    });
  }
  await t.test("late pending query does not prevent a later confirmed timely payment", async () => {
    const f = fixture(transact), o = await f.create();
    f.setNow("2030-01-05T12:00:00Z");
    f.edit(p => { p.intent.transaction_status = "pending"; delete p.intent.transaction_data; });
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).status, "pending");
    f.edit(p => { p.intent.transaction_status = "success"; p.intent.transaction_data = { fixtureFinalized: {
      reference: "transaction-secret-" + randomUUID(), status: "success", finalizedAt: "2030-01-01T12:15:00Z",
      invoice: o.orderId, amountMinor: 12300, merchant: f.config.offer.merchant, currency: "NAD",
    } }; });
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).periodEnd, "2031-01-01T12:15:00.000Z");
  });
  await t.test("confirmation after the annual period records expiry, not a fresh year", async () => {
    const f = fixture(transact), o = await f.create();
    f.setNow("2032-01-01T12:00:00Z");
    const result = await f.service.reconcile(f.workspace, o.orderId);
    assert.equal(result.status, "expired"); assert.equal(result.periodEnd, "2031-01-01T12:00:00.000Z");
    assert.equal(JSON.parse((await setting(f.workspace, "commercial:entitlement:"))!).planId, "free");
  });
  await t.test("intent identifiers are not financial uniqueness keys", async () => {
    const a = fixture(transact), b = fixture(transact), oa = await a.create(), ob = await b.create();
    a.edit(p => { p.intent.payment_token = "shared-intent-fixture"; });
    b.edit(p => { p.intent.payment_token = "shared-intent-fixture"; });
    assert.equal((await a.service.reconcile(a.workspace, oa.orderId)).status, "paid");
    assert.equal((await b.service.reconcile(b.workspace, ob.orderId)).status, "paid");
  });
  await t.test("provider transaction reserved by another product cannot activate annual access", async () => {
    const f = fixture(transact), o = await f.create();
    let reference = ""; f.edit(p => { reference = p.intent.transaction_data.fixtureFinalized.reference; });
    const hash = createHash("sha256").update("paytoday\0" + reference).digest("hex");
    await transact(f.workspace, tx => tx.bindProviderTransaction(hash, { provider: "paytoday", orderId: "OTHER-PRODUCT-FIXTURE",
      product: "other-test-product", workspace: f.workspace, finalizedAt: "2030-01-01T12:00:00.000Z" }));
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId));
    assert.equal(await setting(f.workspace, "commercial:entitlement:"), undefined);
  });
  await t.test("concurrent cross-order transaction replay grants at most one workspace", async () => {
    const a = fixture(transact), b = fixture(transact), oa = await a.create(), ob = await b.create();
    let reference = ""; a.edit(p => { reference = p.intent.transaction_data.fixtureFinalized.reference; });
    b.edit(p => { p.intent.transaction_data.fixtureFinalized.reference = reference; });
    const results = await Promise.allSettled([
      a.service.reconcile(a.workspace, oa.orderId), b.service.reconcile(b.workspace, ob.orderId),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled" && r.value.status === "paid").length, 1);
    assert.equal(results.filter(r => r.status === "rejected").length, 1);
    const granted = await Promise.all([a.workspace, b.workspace].map(w => setting(w, "commercial:entitlement:")));
    assert.equal(granted.filter(Boolean).length, 1);
  });
  await t.test("paid replay with changed finalized time or financial reference fails closed", async () => {
    const f = fixture(transact), o = await f.create();
    await f.service.reconcile(f.workspace, o.orderId);
    f.setNow("2030-01-02T12:00:00Z");
    f.edit(p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01T12:01:00Z"; });
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId));
    f.edit(p => { p.intent.transaction_data.fixtureFinalized.finalizedAt = "2030-01-01T12:00:00Z";
      p.intent.transaction_data.fixtureFinalized.reference = "different-financial-reference"; });
    await assert.rejects(() => f.service.reconcile(f.workspace, o.orderId));
    assert.equal(JSON.parse((await setting(f.workspace, "commercial:entitlement:"))!).paidUntil, "2031-01-01T12:00:00.000Z");
  });
  await t.test("verified refund revokes only its original period and cannot reactivate", async () => {
    const f = fixture(transact), o = await f.create();
    await f.service.reconcile(f.workspace, o.orderId);
    f.edit(p => { p.intent.transaction_status = "refunded"; });
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).status, "revoked");
    assert.equal(JSON.parse((await setting(f.workspace, "commercial:entitlement:"))!).planId, "free");
    f.edit(p => { p.intent.transaction_status = "success"; });
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).status, "revoked");
  });
  await t.test("internal test workspace is never modified by annual billing", async () => {
    const f = fixture(transact);
    await transact(f.workspace, tx => tx.setSetting("commercial:master_workspace:" + f.workspace, "1"));
    await assert.rejects(f.create);
    assert.equal(f.calls.length, 0);
  });
  await t.test("fresh customer-authorized purchase after expiry gets one new year; old refund cannot revoke it", async () => {
    const f = fixture(transact), first = await f.create();
    await f.service.reconcile(f.workspace, first.orderId);
    f.setNow("2031-02-01T12:00:00Z");
    const second = await f.create();
    const result = await f.service.reconcile(f.workspace, second.orderId);
    assert.equal(result.periodEnd, "2032-02-01T12:00:00.000Z");
    const old = [...f.intents.values()].find(p => p.intent.invoice_number === first.orderId)!;
    old.intent.transaction_status = "refunded";
    await f.service.reconcile(f.workspace, first.orderId);
    const ent = JSON.parse((await setting(f.workspace, "commercial:entitlement:"))!);
    assert.equal(ent.paymentOrderId, second.orderId); assert.equal(ent.planId, "premium");
  });
  await t.test("leap-day annual access ends February 28 without an extra day", async () => {
    const f = fixture(transact);
    f.setNow("2032-02-29T12:00:00Z");
    const o = await f.create();
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).periodEnd, "2033-02-28T12:00:00.000Z");
  });
  await t.test("pending payment can later reconcile as success with the same stored intent", async () => {
    const f = fixture(transact), o = await f.create();
    f.edit(p => { p.intent.transaction_status = "pending"; });
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).status, "pending");
    f.edit(p => { p.intent.transaction_status = "success"; });
    assert.equal((await f.service.reconcile(f.workspace, o.orderId)).status, "paid");
  });
  await t.test("lost acknowledgement after commit is safe to retry without extending access", async () => {
    const f = fixture(transact), o = await f.create();
    let lost = false;
    const lostAck: PaymentTransact = async (w, run) => {
      const result = await transact(w, run);
      const saved = await transact(w, tx => tx.getOrder(o.orderId));
      if (!lost && saved?.state.status === "paid") { lost = true; throw Error("synthetic lost acknowledgement"); }
      return result;
    };
    await assert.rejects(() => f.restart(lostAck).reconcile(f.workspace, o.orderId));
    f.setNow("2030-01-02T12:00:00Z");
    const retried = await f.restart(freshTransact()).reconcile(f.workspace, o.orderId);
    assert.equal(retried.status, "paid"); assert.equal(retried.periodEnd, "2031-01-01T12:00:00.000Z");
  });
}
