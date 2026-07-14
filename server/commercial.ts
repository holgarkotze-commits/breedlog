import crypto from "crypto";
import { z } from "zod";
import type { IStorage } from "./storage";
import {
  BREEDLOG_PLANS,
  BREEDLOG_PRICING_VERSION,
  getBreedLogPlan,
  monthWindowKey,
  type BreedLogPlanId,
} from "@shared/commercial";

const ENTITLEMENT_PREFIX = "commercial:entitlement:";
const USAGE_PREFIX = "commercial:usage:";
const BILLING_EVENT_PREFIX = "commercial:billing-event:";
const BILLING_SUBSCRIPTION_PREFIX = "commercial:subscription:";
const BILLING_CHECKOUT_PREFIX = "commercial:checkout:";
const BILLING_PORTAL_PREFIX = "commercial:portal:";
const BILLING_AUDIT_PREFIX = "commercial:audit:";

export class EntitlementDeniedError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 403,
  ) {
    super(message);
    this.name = "EntitlementDeniedError";
  }
}

export const billingEventSchema = z.object({
  provider: z.string().min(1).max(40),
  providerEventId: z.string().min(1).max(120),
  accountId: z.string().min(1).max(160),
  eventType: z.enum([
    "subscription.created",
    "subscription.renewed",
    "subscription.cancelled",
    "subscription.grace_period",
    "subscription.payment_failed",
    "subscription.refunded",
    "subscription.reversed",
    "subscription.expired",
  ]),
  planId: z.enum(["free", "premium"]).optional(),
  effectiveAt: z.string().datetime().optional(),
  subscriptionId: z.string().max(160).optional(),
  customerId: z.string().max(160).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type BillingEvent = z.infer<typeof billingEventSchema>;

export type EntitlementState = {
  accountId: string;
  planId: BreedLogPlanId;
  status: "active" | "grace_period" | "cancelled" | "payment_failed" | "refunded" | "expired";
  source: "default_free" | "billing_event" | "manual_admin";
  pricingVersion: string;
  subscriptionId?: string;
  customerId?: string;
  effectiveAt: string;
  updatedAt: string;
};

export type UsageState = {
  accountId: string;
  month: string;
  aiActions: number;
  individualPdfExports: number;
  batchPdfExports: number;
  manualBackups: string[];
};

export type DowngradeProjection<T extends { id: number; createdAt?: Date | string | null; status?: string | null }> = {
  visible: T[];
  hidden: T[];
  rule: "first_30_originally_added";
};

export type BillingProductCode = "premium_monthly" | "premium_annual" | "addon_pdf_250";

export type BillingCatalogEntry = {
  productCode: BillingProductCode;
  planId: BreedLogPlanId;
  billingPeriod: "monthly" | "annual" | "addon";
  amountNad: number;
  currency: "NAD";
  addOnUnits?: { individualPdfExports: number };
};

export type BillingCheckoutSession = {
  sessionId: string;
  accountId: string;
  provider: string;
  productCode: BillingProductCode;
  status: "pending" | "completed" | "expired";
  checkoutUrl: string;
  returnUrl?: string;
  cancelUrl?: string;
  createdAt: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
};

export type BillingPortalSession = {
  sessionId: string;
  accountId: string;
  provider: string;
  url: string;
  createdAt: string;
};

export type BillingSubscriptionState = {
  accountId: string;
  provider: string;
  subscriptionId: string;
  customerId: string;
  productCode: BillingProductCode;
  planId: BreedLogPlanId;
  billingPeriod: "monthly" | "annual";
  status: "pending" | "active" | "grace_period" | "payment_failed" | "cancelled" | "refunded" | "expired";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  addOns: string[];
  updatedAt: string;
};

export type BillingAuditEntry = {
  auditId: string;
  accountId: string;
  eventType: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export const BILLING_CATALOG: Record<BillingProductCode, BillingCatalogEntry> = {
  premium_monthly: {
    productCode: "premium_monthly",
    planId: "premium",
    billingPeriod: "monthly",
    amountNad: 149,
    currency: "NAD",
  },
  premium_annual: {
    productCode: "premium_annual",
    planId: "premium",
    billingPeriod: "annual",
    amountNad: 1520,
    currency: "NAD",
  },
  addon_pdf_250: {
    productCode: "addon_pdf_250",
    planId: "premium",
    billingPeriod: "addon",
    amountNad: 75,
    currency: "NAD",
    addOnUnits: { individualPdfExports: 250 },
  },
};

function settingKeyForEntitlement(accountId: string): string {
  return `${ENTITLEMENT_PREFIX}${accountId}`;
}

function settingKeyForUsage(accountId: string, month: string): string {
  return `${USAGE_PREFIX}${accountId}:${month}`;
}

function settingKeyForBillingEvent(provider: string, providerEventId: string): string {
  return `${BILLING_EVENT_PREFIX}${provider}:${providerEventId}`;
}

function settingKeyForSubscription(accountId: string): string {
  return `${BILLING_SUBSCRIPTION_PREFIX}${accountId}`;
}

function settingKeyForCheckoutSession(sessionId: string): string {
  return `${BILLING_CHECKOUT_PREFIX}${sessionId}`;
}

function settingKeyForPortalSession(sessionId: string): string {
  return `${BILLING_PORTAL_PREFIX}${sessionId}`;
}

function settingKeyForBillingAudit(auditId: string): string {
  return `${BILLING_AUDIT_PREFIX}${auditId}`;
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

function periodEnd(start: Date, billingPeriod: "monthly" | "annual"): Date {
  const next = new Date(start);
  if (billingPeriod === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

async function createBillingAuditEntry(storage: IStorage, accountId: string, eventType: string, payload: Record<string, unknown>) {
  const auditId = `bill_${crypto.randomUUID().slice(0, 12)}`;
  const entry: BillingAuditEntry = {
    auditId,
    accountId,
    eventType,
    createdAt: new Date().toISOString(),
    payload,
  };
  await storage.setSystemSetting(settingKeyForBillingAudit(auditId), JSON.stringify(entry), "Billing audit entry");
  return entry;
}

export async function getEntitlementState(storage: IStorage, accountId: string): Promise<EntitlementState> {
  const raw = await storage.getSystemSetting(settingKeyForEntitlement(accountId));
  if (raw) return JSON.parse(raw) as EntitlementState;
  const now = new Date().toISOString();
  return {
    accountId,
    planId: "free",
    status: "active",
    source: "default_free",
    pricingVersion: BREEDLOG_PRICING_VERSION,
    effectiveAt: now,
    updatedAt: now,
  };
}

export async function setEntitlementState(storage: IStorage, state: EntitlementState): Promise<EntitlementState> {
  const normalized: EntitlementState = {
    ...state,
    pricingVersion: BREEDLOG_PRICING_VERSION,
    updatedAt: new Date().toISOString(),
  };
  await storage.setSystemSetting(
    settingKeyForEntitlement(state.accountId),
    JSON.stringify(normalized),
    "Server-authoritative BreedLog entitlement state",
  );
  return normalized;
}

export async function getUsageState(storage: IStorage, accountId: string, now = new Date()): Promise<UsageState> {
  const month = monthWindowKey(now);
  return parseJson(await storage.getSystemSetting(settingKeyForUsage(accountId, month)), {
    accountId,
    month,
    aiActions: 0,
    individualPdfExports: 0,
    batchPdfExports: 0,
    manualBackups: [],
  });
}

export async function saveUsageState(storage: IStorage, usage: UsageState): Promise<void> {
  await storage.setSystemSetting(
    settingKeyForUsage(usage.accountId, usage.month),
    JSON.stringify(usage),
    "Server-authoritative BreedLog monthly usage counters",
  );
}

export async function listBillingAuditEntries(storage: IStorage, accountId: string): Promise<BillingAuditEntry[]> {
  const rows = await storage.listSystemSettings(BILLING_AUDIT_PREFIX);
  return rows
    .map((row) => JSON.parse(row.value) as BillingAuditEntry)
    .filter((entry) => entry.accountId === accountId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getBillingSubscriptionState(storage: IStorage, accountId: string): Promise<BillingSubscriptionState | null> {
  const raw = await storage.getSystemSetting(settingKeyForSubscription(accountId));
  return raw ? JSON.parse(raw) as BillingSubscriptionState : null;
}

export async function saveBillingSubscriptionState(storage: IStorage, subscription: BillingSubscriptionState): Promise<void> {
  await storage.setSystemSetting(
    settingKeyForSubscription(subscription.accountId),
    JSON.stringify(subscription),
    "Deterministic billing subscription state",
  );
}

export async function createCheckoutSession(
  storage: IStorage,
  accountId: string,
  productCode: BillingProductCode,
  options: { provider?: string; returnUrl?: string; cancelUrl?: string; metadata?: Record<string, unknown> } = {},
): Promise<BillingCheckoutSession> {
  const catalog = BILLING_CATALOG[productCode];
  if (!catalog) {
    throw new EntitlementDeniedError("UNKNOWN_PRODUCT", `Unknown billing product: ${productCode}`, 400);
  }
  const sessionId = `chk_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const session: BillingCheckoutSession = {
    sessionId,
    accountId,
    provider: options.provider ?? "test-provider",
    productCode,
    status: "pending",
    checkoutUrl: `https://billing.test.breedlog.local/checkout/${sessionId}`,
    returnUrl: options.returnUrl,
    cancelUrl: options.cancelUrl,
    createdAt: new Date().toISOString(),
    metadata: options.metadata,
  };
  await storage.setSystemSetting(settingKeyForCheckoutSession(sessionId), JSON.stringify(session), "Deterministic checkout session");
  await createBillingAuditEntry(storage, accountId, "checkout.session_created", { sessionId, productCode });
  return session;
}

export async function getCheckoutSession(storage: IStorage, sessionId: string): Promise<BillingCheckoutSession | null> {
  const raw = await storage.getSystemSetting(settingKeyForCheckoutSession(sessionId));
  return raw ? JSON.parse(raw) as BillingCheckoutSession : null;
}

export async function createBillingPortalSession(storage: IStorage, accountId: string, provider = "test-provider"): Promise<BillingPortalSession> {
  const sessionId = `portal_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const session: BillingPortalSession = {
    sessionId,
    accountId,
    provider,
    url: `https://billing.test.breedlog.local/portal/${sessionId}`,
    createdAt: new Date().toISOString(),
  };
  await storage.setSystemSetting(settingKeyForPortalSession(sessionId), JSON.stringify(session), "Deterministic billing portal session");
  await createBillingAuditEntry(storage, accountId, "portal.session_created", { sessionId });
  return session;
}

export async function completeTestCheckoutSession(
  storage: IStorage,
  sessionId: string,
  options: { now?: Date } = {},
): Promise<{ session: BillingCheckoutSession; subscription: BillingSubscriptionState; entitlement: EntitlementState }> {
  const session = await getCheckoutSession(storage, sessionId);
  if (!session) {
    throw new EntitlementDeniedError("UNKNOWN_CHECKOUT_SESSION", "Checkout session was not found.", 404);
  }
  if (session.status === "completed") {
    const subscription = await getBillingSubscriptionState(storage, session.accountId);
    if (!subscription) {
      throw new EntitlementDeniedError("SUBSCRIPTION_MISSING", "Checkout completed without a subscription record.", 500);
    }
    return { session, subscription, entitlement: await getEntitlementState(storage, session.accountId) };
  }
  const catalog = BILLING_CATALOG[session.productCode];
  if (catalog.billingPeriod === "addon") {
    await createBillingAuditEntry(storage, session.accountId, "checkout.addon_completed", { sessionId, productCode: session.productCode });
    const completedSession = { ...session, status: "completed" as const, completedAt: (options.now ?? new Date()).toISOString() };
    await storage.setSystemSetting(settingKeyForCheckoutSession(sessionId), JSON.stringify(completedSession), "Completed deterministic checkout session");
    return {
      session: completedSession,
      subscription: await getBillingSubscriptionState(storage, session.accountId) ?? {
        accountId: session.accountId,
        provider: session.provider,
        subscriptionId: "",
        customerId: "",
        productCode: "premium_monthly",
        planId: "free",
        billingPeriod: "monthly",
        status: "pending",
        currentPeriodStart: completedSession.completedAt!,
        currentPeriodEnd: completedSession.completedAt!,
        cancelAtPeriodEnd: false,
        addOns: [session.productCode],
        updatedAt: completedSession.completedAt!,
      },
      entitlement: await getEntitlementState(storage, session.accountId),
    };
  }

  const now = options.now ?? new Date();
  const currentPeriodStart = now.toISOString();
  const currentPeriodEnd = periodEnd(now, catalog.billingPeriod).toISOString();
  const subscription: BillingSubscriptionState = {
    accountId: session.accountId,
    provider: session.provider,
    subscriptionId: `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    customerId: `cus_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    productCode: session.productCode,
    planId: catalog.planId,
    billingPeriod: catalog.billingPeriod,
    status: "active",
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    addOns: [],
    updatedAt: now.toISOString(),
  };
  await saveBillingSubscriptionState(storage, subscription);
  const entitlement = (await applyBillingEvent(storage, {
    provider: session.provider,
    providerEventId: `evt_checkout_${sessionId}`,
    accountId: session.accountId,
    eventType: "subscription.created",
    planId: subscription.planId,
    subscriptionId: subscription.subscriptionId,
    customerId: subscription.customerId,
    effectiveAt: now.toISOString(),
    metadata: { sessionId, productCode: session.productCode },
  })).entitlement;
  const completedSession = { ...session, status: "completed" as const, completedAt: now.toISOString() };
  await storage.setSystemSetting(settingKeyForCheckoutSession(sessionId), JSON.stringify(completedSession), "Completed deterministic checkout session");
  await createBillingAuditEntry(storage, session.accountId, "checkout.completed", { sessionId, subscriptionId: subscription.subscriptionId, productCode: session.productCode });
  return { session: completedSession, subscription, entitlement };
}

export async function cancelBillingSubscription(
  storage: IStorage,
  accountId: string,
  options: { atPeriodEnd?: boolean; now?: Date } = {},
): Promise<BillingSubscriptionState> {
  const subscription = await getBillingSubscriptionState(storage, accountId);
  if (!subscription) {
    throw new EntitlementDeniedError("SUBSCRIPTION_NOT_FOUND", "No active billing subscription exists for this account.", 404);
  }
  const now = options.now ?? new Date();
  const updated: BillingSubscriptionState = {
    ...subscription,
    cancelAtPeriodEnd: options.atPeriodEnd !== false,
    status: options.atPeriodEnd === false ? "cancelled" : subscription.status,
    updatedAt: now.toISOString(),
  };
  await saveBillingSubscriptionState(storage, updated);
  await createBillingAuditEntry(storage, accountId, "subscription.cancel_requested", { atPeriodEnd: updated.cancelAtPeriodEnd });
  if (options.atPeriodEnd === false) {
    await applyBillingEvent(storage, {
      provider: updated.provider,
      providerEventId: `evt_cancel_${updated.subscriptionId}_${now.getTime()}`,
      accountId,
      eventType: "subscription.cancelled",
      planId: updated.planId,
      subscriptionId: updated.subscriptionId,
      customerId: updated.customerId,
      effectiveAt: now.toISOString(),
    });
  }
  return updated;
}

export async function simulateBillingProviderEvent(
  storage: IStorage,
  accountId: string,
  input: { eventType: BillingEvent["eventType"]; providerEventId?: string; now?: Date },
) {
  const subscription = await getBillingSubscriptionState(storage, accountId);
  const now = input.now ?? new Date();
  const nextSubscription: BillingSubscriptionState | null = subscription
    ? {
        ...subscription,
        status:
          input.eventType === "subscription.grace_period" ? "grace_period"
          : input.eventType === "subscription.payment_failed" ? "payment_failed"
          : input.eventType === "subscription.cancelled" ? "cancelled"
          : input.eventType === "subscription.refunded" || input.eventType === "subscription.reversed" ? "refunded"
          : input.eventType === "subscription.expired" ? "expired"
          : "active",
        currentPeriodStart: input.eventType === "subscription.renewed" ? now.toISOString() : subscription.currentPeriodStart,
        currentPeriodEnd:
          input.eventType === "subscription.renewed"
            ? periodEnd(now, subscription.billingPeriod).toISOString()
            : subscription.currentPeriodEnd,
        updatedAt: now.toISOString(),
      }
    : null;
  if (nextSubscription) {
    await saveBillingSubscriptionState(storage, nextSubscription);
  }
  const entitlement = (await applyBillingEvent(storage, {
    provider: subscription?.provider ?? "test-provider",
    providerEventId: input.providerEventId ?? `evt_${input.eventType}_${now.getTime()}`,
    accountId,
    eventType: input.eventType,
    planId: subscription?.planId ?? "free",
    subscriptionId: subscription?.subscriptionId,
    customerId: subscription?.customerId,
    effectiveAt: now.toISOString(),
    metadata: { simulated: true },
  })).entitlement;
  await createBillingAuditEntry(storage, accountId, input.eventType, { effectiveAt: now.toISOString() });
  return { entitlement, subscription: nextSubscription };
}

export async function assertCanCreateAnimal(storage: IStorage, accountId: string): Promise<void> {
  const entitlement = await getEntitlementState(storage, accountId);
  const plan = getBreedLogPlan(entitlement.planId);
  const activeLimit = plan.limits.activeAnimals;
  if (activeLimit === "unlimited") return;
  const activeAnimals = (await storage.getAnimals(accountId, { status: "active" })).length;
  if (activeAnimals >= activeLimit) {
    throw new EntitlementDeniedError(
      "ACTIVE_ANIMAL_LIMIT_REACHED",
      `Free accounts are limited to ${activeLimit} active animals. Upgrade to Premium to add more active animals.`,
    );
  }
}

export function projectDowngradedAnimalVisibility<T extends { id: number; createdAt?: Date | string | null; status?: string | null }>(
  animals: T[],
): DowngradeProjection<T> {
  const activeAnimals = animals
    .filter((animal) => (animal.status ?? "active") === "active")
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime || a.id - b.id;
    });
  const visibleIds = new Set(activeAnimals.slice(0, BREEDLOG_PLANS.free.limits.activeAnimals as number).map((animal) => animal.id));
  return {
    visible: animals.filter((animal) => visibleIds.has(animal.id) || (animal.status ?? "active") !== "active"),
    hidden: animals.filter((animal) => !visibleIds.has(animal.id) && (animal.status ?? "active") === "active"),
    rule: "first_30_originally_added",
  };
}

export async function reserveUsage(
  storage: IStorage,
  accountId: string,
  kind: "aiActions" | "individualPdfExports" | "batchPdfExports" | "manualBackups",
  now = new Date(),
): Promise<UsageState> {
  const entitlement = await getEntitlementState(storage, accountId);
  const plan = getBreedLogPlan(entitlement.planId);
  const usage = await getUsageState(storage, accountId, now);

  if (kind === "manualBackups") {
    if (plan.limits.manualBackups === "rolling_7_day") {
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      usage.manualBackups = usage.manualBackups.filter((stamp) => new Date(stamp).getTime() > sevenDaysAgo);
      if (usage.manualBackups.length >= 1) {
        throw new EntitlementDeniedError(
          "MANUAL_BACKUP_LIMIT_REACHED",
          "Free accounts can create one manual .breedlogbackup in a rolling seven-day window.",
        );
      }
    }
    usage.manualBackups.push(now.toISOString());
    await saveUsageState(storage, usage);
    return usage;
  }

  const limit =
    kind === "aiActions"
      ? plan.limits.aiActionsPerMonth
      : kind === "individualPdfExports"
        ? plan.limits.individualPdfExportsPerMonth
        : plan.limits.batchPdfExportsPerMonth;
  if (limit !== "fair_use" && usage[kind] >= limit) {
    throw new EntitlementDeniedError(
      `${kind.toUpperCase()}_LIMIT_REACHED`,
      `${plan.displayName} accounts have reached the ${kind} monthly quota.`,
    );
  }
  usage[kind] += 1;
  await saveUsageState(storage, usage);
  return usage;
}

export function verifyBillingSignature(rawBody: string, signature: string | undefined, secret: string | undefined): boolean {
  if (!secret) return process.env.NODE_ENV !== "production" && signature === "test-signature";
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function applyBillingEvent(storage: IStorage, event: BillingEvent): Promise<{ idempotent: boolean; entitlement: EntitlementState }> {
  const eventKey = settingKeyForBillingEvent(event.provider, event.providerEventId);
  const existing = await storage.getSystemSetting(eventKey);
  if (existing) {
    return { idempotent: true, entitlement: await getEntitlementState(storage, event.accountId) };
  }

  const now = new Date().toISOString();
  const existingEntitlement = await getEntitlementState(storage, event.accountId);
  const nextPlan: BreedLogPlanId =
    event.eventType === "subscription.refunded" ||
    event.eventType === "subscription.reversed" ||
    event.eventType === "subscription.expired"
      ? "free"
      : event.planId ?? existingEntitlement.planId;
  const nextStatus: EntitlementState["status"] =
    event.eventType === "subscription.grace_period" ? "grace_period"
    : event.eventType === "subscription.cancelled" ? "cancelled"
    : event.eventType === "subscription.payment_failed" ? "payment_failed"
    : event.eventType === "subscription.refunded" ? "refunded"
    : event.eventType === "subscription.reversed" ? "refunded"
    : event.eventType === "subscription.expired" ? "expired"
    : "active";

  const entitlement = await setEntitlementState(storage, {
    accountId: event.accountId,
    planId: nextPlan,
    status: nextStatus,
    source: "billing_event",
    pricingVersion: BREEDLOG_PRICING_VERSION,
    subscriptionId: event.subscriptionId ?? existingEntitlement.subscriptionId,
    customerId: event.customerId ?? existingEntitlement.customerId,
    effectiveAt: event.effectiveAt ?? now,
    updatedAt: now,
  });
  await storage.setSystemSetting(eventKey, JSON.stringify({ event, appliedAt: now }), "Idempotency record for billing event");
  return { idempotent: false, entitlement };
}
