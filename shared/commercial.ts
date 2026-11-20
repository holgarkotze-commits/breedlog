export type BreedLogPlanId = "free" | "premium";

export type BreedLogPlanLimits = {
  activeAnimals: number | "unlimited";
  activeDevices: number;
  individualPdfExportsPerMonth: number;
  batchPdfExportsPerMonth: number;
  aiActionsPerMonth: number | "fair_use";
  manualBackups: "rolling_7_day" | "unlimited";
  retainedWeeklyAutomaticBackups: number;
  quotaAddOns: boolean;
};

export type BreedLogPlan = {
  id: BreedLogPlanId;
  displayName: string;
  priceNadMonthly: number;
  priceNadYearly: number | null;
  limits: BreedLogPlanLimits;
};

export const BREEDLOG_PRICING_VERSION = "2026-11-12-approved-free-premium";

export const BREEDLOG_PLANS: Record<BreedLogPlanId, BreedLogPlan> = {
  free: {
    id: "free",
    displayName: "Free",
    priceNadMonthly: 0,
    priceNadYearly: null,
    limits: {
      activeAnimals: 30,
      activeDevices: 1,
      individualPdfExportsPerMonth: 0,
      batchPdfExportsPerMonth: 0,
      aiActionsPerMonth: 10,
      manualBackups: "rolling_7_day",
      retainedWeeklyAutomaticBackups: 4,
      quotaAddOns: false,
    },
  },
  premium: {
    id: "premium",
    displayName: "Premium",
    priceNadMonthly: 79.99,
    priceNadYearly: 799,
    limits: {
      activeAnimals: "unlimited",
      activeDevices: 3,
      individualPdfExportsPerMonth: 1000,
      batchPdfExportsPerMonth: 50,
      aiActionsPerMonth: "fair_use",
      manualBackups: "unlimited",
      retainedWeeklyAutomaticBackups: 12,
      quotaAddOns: true,
    },
  },
};

export function getBreedLogPlan(planId: BreedLogPlanId): BreedLogPlan {
  return BREEDLOG_PLANS[planId];
}

export function monthWindowKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const BILLING_CURRENCIES = ["NAD", "ZAR", "USD", "GBP", "EUR"] as const;
export type BillingCurrency = typeof BILLING_CURRENCIES[number];
export type PremiumInterval = "monthly" | "annual";
export const PAYMENT_GRACE_MS = 72 * 60 * 60 * 1000;
const EURO_COUNTRIES = new Set(["AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"]);

export function defaultBillingCurrency(country?: string, locale?: string): BillingCurrency {
  let region = country?.trim().toUpperCase();
  if (!region && locale) {
    try { region = new Intl.Locale(locale.split(",")[0].split(";")[0].trim().replace("_", "-")).region; }
    catch { /* Unrecognized locale is a display hint, never charge authority. */ }
  }
  if (region === "ZA") return "ZAR";
  if (region === "US") return "USD";
  if (region === "GB") return "GBP";
  if (region && EURO_COUNTRIES.has(region)) return "EUR";
  return "NAD";
}

// Exact minor units are authoritative. International amounts are deliberately
// absent; display localization/FX must never invent a chargeable price.
export function premiumPrice(currency: BillingCurrency, interval: PremiumInterval): number | null {
  return currency === "NAD" || currency === "ZAR" ? interval === "monthly" ? 7999 : 79900 : null;
}
export function localizedPricing(country?: string, locale?: string, override?: string) {
  const currency = override && BILLING_CURRENCIES.includes(override as BillingCurrency)
    ? override as BillingCurrency : defaultBillingCurrency(country, locale);
  const monthlyMinor = premiumPrice(currency, "monthly"), annualMinor = premiumPrice(currency, "annual");
  const savingsMinor = monthlyMinor !== null && annualMinor !== null ? monthlyMinor * 12 - annualMinor : null;
  return { currency, monthlyMinor, annualMinor, savingsMinor,
    annualSavingsPercent: savingsMinor !== null && monthlyMinor ? Math.round(savingsMinor * 1000 / (monthlyMinor * 12)) / 10 : null,
    priceApproved: monthlyMinor !== null, checkoutEnabled: false as const,
    renewalMode: "customer_initiated" as const, graceHours: 72 };
}

// Persisted only by verified server-side renewal confirmation, never by a
// browser hint or the mere passage of a paid-term deadline.
export type VerifiedRenewalFailure = {
  verified: true;
  paidPeriodId: string;
  dueAt: string;
  observedAt: string;
  renewalOrderId: string;
};

export function paidTermTime(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
  const n = Date.parse(value);
  if (!Number.isFinite(n) || new Date(n).toISOString() !== value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")) return NaN;
  return n;
}

// Every authorization/read derives its projection without writing an expiry
// over a newer payment. Grace belongs to an original failed renewal period.
export function effectivePaidAccess<T extends { planId: BreedLogPlanId; status: string; paidUntil?: string;
  source?: string; paymentOrderId?: string; subscriptionId?: string; renewalFailure?: VerifiedRenewalFailure;
  billingPeriod?: string; cancelAtPeriodEnd?: boolean; graceUntil?: string }>(state: T, now = new Date()): T & { graceUntil?: string } {
  const { graceUntil: _discardStaleDeadline, ...clean } = state;
  if (state.source === "internal_test") return state;
  if (["refunded", "cancelled"].includes(state.status)) return { ...clean, planId: "free" } as T;
  if (state.planId !== "premium") return clean as T;
  const due = paidTermTime(state.paidUntil), time = now.getTime();
  if (!Number.isFinite(due) || !Number.isFinite(time)) return { ...clean, planId: "free", status: "expired" } as T;
  if (time < due) return { ...clean, status: state.status === "grace_period" ? "active" : state.status } as T;
  const f = state.renewalFailure;
  const observed = paidTermTime(f?.observedAt);
  const verified = state.billingPeriod === "monthly" && !state.cancelAtPeriodEnd && f?.verified === true &&
    !!f.renewalOrderId && !!f.paidPeriodId && f.paidPeriodId === (state.paymentOrderId ?? state.subscriptionId) &&
    paidTermTime(f.dueAt) === due && Number.isFinite(observed) && observed >= due && observed <= time;
  const graceUntil = verified ? new Date(due + PAYMENT_GRACE_MS).toISOString() : undefined;
  if (verified && time < due + PAYMENT_GRACE_MS) return { ...clean, planId: "premium", status: "grace_period", graceUntil } as T;
  return { ...clean, planId: "free", status: "expired", ...(graceUntil ? { graceUntil } : {}) } as T;
}
