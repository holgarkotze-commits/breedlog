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

export const BREEDLOG_PRICING_VERSION = "2026-07-locked-commercial-model";

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
    priceNadMonthly: 149,
    priceNadYearly: 1520,
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
