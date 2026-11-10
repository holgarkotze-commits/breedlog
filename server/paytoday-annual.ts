import crypto from "node:crypto";
import type { AnnualOffer, PaymentOrder, PaymentTransact, PaymentTransaction } from "./paytoday-types";
import { PaymentRejected, PaymentUnavailable } from "./paytoday-types";
import { installedPayTodayContract } from "./paytoday-adapter";
import type { Contact, PayTodayProvider } from "./paytoday-adapter";
import { BREEDLOG_PRICING_VERSION } from "@shared/commercial";

export interface AnnualPaymentConfig {
  enabled: boolean;
  merchantAuthorizationRef: string;
  priceApprovalRef: string;
  contractEvidenceRef: string;
  offer: AnnualOffer;
  encryptionKey: Buffer;
  returnOrigin: string;
}

export function assertAnnualConfig(config: AnnualPaymentConfig | undefined): asserts config is AnnualPaymentConfig {
  if (!config?.enabled || !config.merchantAuthorizationRef || !config.priceApprovalRef || !config.contractEvidenceRef ||
      config.offer.product !== "breedlog_premium_annual" || config.offer.provider !== "paytoday" ||
      !Number.isSafeInteger(config.offer.amountMinor) || config.offer.amountMinor <= 0 ||
      config.offer.currency !== "NAD" || !config.offer.version || !config.offer.merchant ||
      !config.offer.contractVersion || !["sandbox", "production"].includes(config.offer.environment) ||
      config.encryptionKey.length !== 32) throw new PaymentUnavailable();
  try {
    const u = new URL(config.returnOrigin);
    if (u.protocol !== "https:" || u.origin !== config.returnOrigin) throw new Error();
  } catch { throw new PaymentUnavailable(); }
}

// No env flag alone may promote the observed FMD protocol into a verified
// authorization contract. This lane stays unavailable until a reviewed provider
// contract AND merchant/price approval/configuration are installed.
export function runtimeAnnualConfig(): AnnualPaymentConfig | undefined {
  if (process.env.BREEDLOG_PAYTODAY_ENABLED !== "1" || !installedPayTodayContract()) return undefined;
  return undefined;
}

function seal(token: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}
function open(value: string, key: Buffer): string {
  try {
    const bytes = Buffer.from(value, "base64url");
    const cipher = crypto.createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8");
  } catch { throw new PaymentRejected(); }
}
const entitlementKey = (workspace: string) => `commercial:entitlement:${workspace}`;
const subscriptionKey = (workspace: string) => `commercial:subscription:${workspace}`;

function checkedOrder(order: PaymentOrder | undefined, workspace: string, config: AnnualPaymentConfig): PaymentOrder {
  if (!order || order.workspace !== workspace || !/^BREEDLOG-[A-F0-9]{32}$/.test(order.id) ||
      (["product", "provider", "currency", "merchant", "environment", "contractVersion"] as const)
        .some(key => order.offer[key] !== config.offer[key]) ||
      !Number.isSafeInteger(order.offer.amountMinor) || order.offer.amountMinor <= 0 ||
      typeof order.offer.version !== "string" || !order.offer.version) throw new PaymentRejected();
  return order;
}

function annualEnd(start: Date): Date {
  const end = new Date(start);
  const month = start.getUTCMonth();
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  // A leap-day purchase expires on Feb 28, not March 1.
  if (end.getUTCMonth() !== month) end.setUTCDate(0);
  return end;
}

// Only explicit timezone-bearing, millisecond-or-second ISO evidence is accepted.
// Invalid calendar dates, local/ambiguous dates and future times fail closed.
function finalizedTime(value: unknown): Date {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new PaymentRejected();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")) {
    throw new PaymentRejected();
  }
  return date;
}

export class AnnualPayToday {
  private config: AnnualPaymentConfig;
  constructor(config: AnnualPaymentConfig | undefined, private transact: PaymentTransact, private provider: PayTodayProvider,
    private now: () => Date = () => new Date()) {
    assertAnnualConfig(config);
    this.config = structuredClone(config);
    // structuredClone(Buffer) yields Uint8Array; crypto accepts Buffer explicitly.
    this.config.encryptionKey = Buffer.from(config.encryptionKey);
  }

  async create(workspace: string, contact: Contact) {
    const now = this.now();
    const order: PaymentOrder = {
      id: "BREEDLOG-" + crypto.randomBytes(16).toString("hex").toUpperCase(), workspace,
      offer: this.config.offer, createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(), state: { status: "creating" },
    };
    await this.transact(workspace, async tx => {
      if (await tx.getSetting(`commercial:master_workspace:${workspace}`) === "1") throw new PaymentRejected();
      const current = JSON.parse(await tx.getSetting(entitlementKey(workspace)) ?? "null");
      // No overlapping periods or implicit automatic renewal.
      if (current?.planId === "premium" && (!current.paidUntil || current.paidUntil > now.toISOString())) throw new PaymentRejected();
      await tx.insertOrder(order);
    });
    // Intentionally no automatic retry of createIntent (provider-side
    // idempotency is undocumented). The committed reservation survives a crash
    // or uncertain response and blocks another create. Never expire it on a
    // clock/browser deadline. Reconciliation of a saved intent IS retry-safe.
    try {
      const created = await this.provider.create(order.id, order.offer, contact,
        `${this.config.returnOrigin}/api/billing/paytoday/return?order=${order.id}`);
      if (!created.token || !created.url) throw new PaymentRejected();
      await this.transact(workspace, async tx => {
        const saved = checkedOrder(await tx.getOrder(order.id), workspace, this.config);
        await tx.updateOrderState(saved.id, { status: "pending", intentCipher: seal(created.token, this.config.encryptionKey) });
      });
      return { orderId: order.id, checkoutUrl: created.url, status: "pending" as const };
    } catch { throw new PaymentRejected(); }
  }

  async reconcile(workspace: string, id: string) {
    const order = await this.transact(workspace, async tx => checkedOrder(await tx.getOrder(id), workspace, this.config));
    if (!order.state.intentCipher) throw new PaymentRejected();
    // Token is loaded ONLY from this order, never a browser/callback payload.
    let payment: Awaited<ReturnType<PayTodayProvider["lookup"]>>;
    try { payment = await this.provider.lookup(open(order.state.intentCipher, this.config.encryptionKey)); }
    catch { throw new PaymentRejected(); }
    return this.transact(workspace, async tx => {
      const saved = checkedOrder(await tx.getOrder(id), workspace, this.config);
      const state = saved.state;
      if (payment.invoice !== saved.id || payment.amountMinor !== saved.offer.amountMinor ||
          payment.currency !== saved.offer.currency || payment.merchant !== saved.offer.merchant ||
          typeof payment.paymentToken !== "string" || !payment.paymentToken || payment.paymentToken.length > 4096) {
        // Do not permanently consume a possibly malformed response: safe retry
        // against the same stored intent remains possible, but nothing is granted.
        throw new PaymentRejected();
      }
      const now = this.now();
      // Pending/failed intent state alone is not evidence of a completed payment.
      // Do not expire a pending order merely because its confirmation arrived late.
      const needsTransaction = payment.status === "success" || state.status === "paid" ||
        ["refunded", "reversed"].includes(payment.status);
      if (!needsTransaction) {
        const closed = payment.intentNonPayable === true &&
          ["failed", "cancelled", "canceled"].includes(payment.status);
        if (["rejected", "revoked"].includes(state.status)) {
          if (state.status === "rejected" && closed) {
            await tx.updateOrderState(id, { ...state, checkoutResolved: true });
          }
          return { orderId: id, status: state.status };
        }
        if (payment.status === "pending") return { orderId: id, status: "pending" };
        await tx.updateOrderState(id, { ...state, status: "rejected",
          checkoutResolved: closed ? true : undefined });
        return { orderId: id, status: "rejected" };
      }
      const transaction = payment.transaction;
      if (!transaction || transaction.status !== "success" ||
          typeof transaction.reference !== "string" || !transaction.reference ||
          transaction.reference !== transaction.reference.trim() || transaction.reference.length > 256 ||
          transaction.invoice !== saved.id || transaction.amountMinor !== saved.offer.amountMinor ||
          transaction.currency !== saved.offer.currency || transaction.merchant !== saved.offer.merchant) throw new PaymentRejected();
      const finalized = finalizedTime(transaction.finalizedAt);
      if (finalized.getTime() < new Date(saved.createdAt).getTime() ||
          finalized.getTime() >= new Date(saved.expiresAt).getTime() ||
          finalized.getTime() > now.getTime()) throw new PaymentRejected();
      // Financial identity is the verified finalized transaction reference.
      // Intent identifiers/payment_token are never used as transaction identity.
      const paymentHash = crypto.createHash("sha256").update("paytoday\0" + transaction.reference).digest("hex");
      if (state.paymentHash && (state.bindingVersion !== "transaction-v1" ||
          state.paymentHash !== paymentHash || state.finalizedAt !== finalized.toISOString())) throw new PaymentRejected();
      await tx.bindProviderTransaction(paymentHash, { provider: "paytoday", orderId: id,
        product: saved.offer.product, workspace, finalizedAt: finalized.toISOString() });
      if (["refunded", "reversed"].includes(payment.status)) {
        if (state.status === "paid") {
          const current = JSON.parse(await tx.getSetting(entitlementKey(workspace)) ?? "null");
          if (current?.paymentOrderId === id) {
            await tx.setSetting(entitlementKey(workspace), JSON.stringify({
              ...current, planId: "free", status: "refunded", updatedAt: this.now().toISOString(),
            }));
            const sub = JSON.parse(await tx.getSetting(subscriptionKey(workspace)) ?? "null");
            if (sub?.paymentOrderId === id) await tx.setSetting(subscriptionKey(workspace), JSON.stringify({ ...sub, status: "refunded" }));
          }
        }
        await tx.updateOrderState(id, { ...state, status: "revoked", paymentHash,
          bindingVersion: "transaction-v1", finalizedAt: finalized.toISOString() });
        return { orderId: id, status: "revoked" };
      }
      if (["rejected", "revoked"].includes(state.status)) return { orderId: id, status: state.status };
      if (state.status === "paid") return { orderId: id,
        status: state.periodEnd && state.periodEnd <= this.now().toISOString() ? "expired" : "paid", periodEnd: state.periodEnd };
      if (payment.status !== "success") {
        await tx.updateOrderState(id, { ...state, status: "rejected" });
        return { orderId: id, status: "rejected" };
      }
      await this.activate(tx, saved, paymentHash, finalized, now);
      const end = annualEnd(finalized).toISOString();
      return { orderId: id, status: end <= now.toISOString() ? "expired" : "paid", periodEnd: end };
    });
  }

  private async activate(tx: PaymentTransaction, order: PaymentOrder, paymentHash: string, finalized: Date, now: Date) {
    if (await tx.getSetting(`commercial:master_workspace:${order.workspace}`) === "1") throw new PaymentRejected();
    const existing = JSON.parse(await tx.getSetting(entitlementKey(order.workspace)) ?? "null");
    if (existing && ((existing.planId === "premium" && !existing.paidUntil) ||
        (existing.paidUntil && existing.paidUntil > finalized.toISOString()))) throw new PaymentRejected();
    const start = finalized.toISOString(), end = annualEnd(finalized).toISOString();
    const active = end > now.toISOString();
    await tx.updateOrderState(order.id, { ...order.state, status: "paid", paymentHash,
      bindingVersion: "transaction-v1", finalizedAt: start, periodStart: start, periodEnd: end });
    await tx.setSetting(entitlementKey(order.workspace), JSON.stringify({
      accountId: order.workspace, planId: active ? "premium" : "free", status: active ? "active" : "expired", source: "billing_event",
      pricingVersion: BREEDLOG_PRICING_VERSION, offerVersion: order.offer.version,
      subscriptionId: order.id, effectiveAt: start, updatedAt: now.toISOString(), paidUntil: end,
      paymentOrderId: order.id,
    }));
    await tx.setSetting(subscriptionKey(order.workspace), JSON.stringify({
      accountId: order.workspace, provider: "paytoday", subscriptionId: order.id,
      customerId: "", productCode: "premium_annual", planId: "premium", billingPeriod: "annual",
      status: active ? "active" : "expired", currentPeriodStart: start, currentPeriodEnd: end, cancelAtPeriodEnd: true,
      autoRenew: false, addOns: [], updatedAt: now.toISOString(), paymentOrderId: order.id,
    }));
  }
}
