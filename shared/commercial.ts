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
      individualPdfExportsPerMonth: 5,
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

// Computed on every authorization/read, with no stale expiry writes that could
// race and overwrite a newer payment. A duplicated failure cannot extend grace.
export function effectivePaidAccess<T extends { planId: BreedLogPlanId; status: string; paidUntil?: string;
  billingPeriod?: string; cancelAtPeriodEnd?: boolean }>(state: T, now = new Date()): T & { graceUntil?: string } {
  if (["refunded", "cancelled"].includes(state.status)) return { ...state, planId: "free" };
  if (state.planId !== "premium" || !state.paidUntil) return state;
  const due = Date.parse(state.paidUntil), time = now.getTime();
  if (!Number.isFinite(due)) return { ...state, planId: "free", status: "expired" };
  if (time < due) return state;
  const graceUntil = new Date(due + PAYMENT_GRACE_MS).toISOString();
  if (state.billingPeriod === "monthly" && !state.cancelAtPeriodEnd && time < due + PAYMENT_GRACE_MS) {
    return { ...state, planId: "premium", status: "grace_period", graceUntil };
  }
  return { ...state, planId: "free", status: "expired", ...(state.billingPeriod === "monthly" && !state.cancelAtPeriodEnd ? { graceUntil } : {}) };
}
