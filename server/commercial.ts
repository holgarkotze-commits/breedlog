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

function settingKeyForEntitlement(accountId: string): string {
  return `${ENTITLEMENT_PREFIX}${accountId}`;
}

function settingKeyForUsage(accountId: string, month: string): string {
  return `${USAGE_PREFIX}${accountId}:${month}`;
}

function settingKeyForBillingEvent(provider: string, providerEventId: string): string {
  return `${BILLING_EVENT_PREFIX}${provider}:${providerEventId}`;
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
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
