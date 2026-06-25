/**
 * Animal Performance Metrics Engine
 *
 * Deterministic, data-honest calculations from real app records only.
 * Returns "Insufficient data" wherever metrics cannot be calculated.
 * All formulas are documented inline.
 */

import type { Animal, BreedingEvent, HealthRecord } from "@shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PerformanceRating =
  | "Excellent"
  | "Strong"
  | "Good"
  | "Developing"
  | "Monitor"
  | "Insufficient data";

export type AnimalRole =
  | "ram"
  | "ewe"
  | "young-stud-ram"
  | "young-stud-ewe"
  | "lamb"
  | "meat-production";

export type DataConfidence = "high" | "medium" | "low" | "insufficient";

export interface GrowthMetrics {
  birthWeight: number | null;
  weight100Day: number | null;
  weight270Day: number | null;
  currentWeight: number | null;
  ageInDays: number | null;
  /** Average daily gain birth → 100-day (g/day). Null if insufficient data. */
  adgBirthTo100: number | null;
  /** Average daily gain birth → 270-day (g/day). Null if insufficient data. */
  adgBirthTo270: number | null;
  /** Average daily gain birth → current weight (g/day). Null if insufficient data. */
  adgBirthToCurrent: number | null;
  /** Number of weight data points recorded (birth/100d/270d/current). */
  weightDataPoints: number;
}

export interface RamProgenyMetrics {
  totalProgeny: number;
  maleProgeny: number;
  femaleProgeny: number;
  progenyLive: number;
  progenyDead: number;
  avgProgenyBirthWeight: number | null;
  avgProgeny100Day: number | null;
  avgProgeny270Day: number | null;
  matingEvents: number;
  lambingEvents: number;
  /** Lambing rate = lambingEvents / matingEvents * 100. */
  lambingRate: number | null;
}

export interface EweProductivityMetrics {
  totalLambingEvents: number;
  totalLambsBorn: number;
  lambsLive: number;
  lambsDead: number;
  avgLambBirthWeight: number | null;
  avgLamb100Day: number | null;
  avgLamb270Day: number | null;
  /** Survival rate = lambsLive / totalLambsBorn * 100. */
  survivalRate: number | null;
  /** Average inter-lambing period in days across consecutive events. */
  avgILP: number | null;
  firstLambDate: string | null;
  lastLambDate: string | null;
  matingEvents: number;
  /** Fertility rate = lambingEvents / matingEvents * 100. */
  fertilityRate: number | null;
}

export interface YoungAnimalMetrics {
  ageInDays: number | null;
  ageCategory: "early" | "growing" | "maturing";
  sireTagId: string | null;
  damTagId: string | null;
  hasParentalData: boolean;
  growthDataPoints: number;
}

export interface MeatProductionMetrics {
  ageInDays: number | null;
  currentWeight: number | null;
  /** Standard market target weight for Meatmaster lambs: ~40 kg. */
  marketTargetKg: number;
  percentToTarget: number | null;
  adgBirthToCurrent: number | null;
  /** Projected additional days to reach market target at current ADG. */
  projectedDaysToTarget: number | null;
}

export interface AnimalPerformanceProfile {
  animalId: number;
  role: AnimalRole;
  growthMetrics: GrowthMetrics;
  ramProgenyMetrics?: RamProgenyMetrics;
  eweProductivityMetrics?: EweProductivityMetrics;
  youngAnimalMetrics?: YoungAnimalMetrics;
  meatProductionMetrics?: MeatProductionMetrics;
  healthRecordCount: number;
  recentHealthNotes: string[];
  overallRating: PerformanceRating;
  ratingReason: string;
  summary: string;
  dataConfidence: DataConfidence;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseKg(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? null : n;
}

function ageInDays(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  try {
    const born = new Date(birthDate);
    const now = new Date();
    const diffMs = now.getTime() - born.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  } catch {
    return null;
  }
}

/** ADG = (finalKg - startKg) * 1000 / days. Returns g/day or null. */
function calcAdg(startKg: number, finalKg: number, days: number): number | null {
  if (days <= 0) return null;
  return Math.round(((finalKg - startKg) * 1000) / days);
}

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => !isNaN(n));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

// ─── Role detection ──────────────────────────────────────────────────────────

/**
 * Determine the animal's role for the performance report.
 * Logic:
 *  - Ram aged ≥ 730 days (2 yr) OR with progeny → "ram"
 *  - Ram aged 100-729 days → "young-stud-ram"
 *  - Ram aged < 100 days → "lamb"
 *  - Ewe aged ≥ 730 days OR with lambing history → "ewe"
 *  - Ewe aged 100-729 days → "young-stud-ewe"
 *  - Status "active" + classification "slaughter_cull" + sex "ram"/"ewe" → "meat-production"
 *  - Otherwise young → "lamb"
 */
export function buildAnimalRole(
  animal: Animal,
  allAnimals: Animal[],
  breedingEvents: BreedingEvent[]
): AnimalRole {
  const age = ageInDays(animal.birthDate);
  const classification = animal.classification || "";
  const isMeatClass = classification === "slaughter_cull";

  if (isMeatClass) return "meat-production";

  if (animal.sex === "ram") {
    const hasProgeny = allAnimals.some((a) => a.sireId === animal.id);
    if (hasProgeny || (age !== null && age >= 730)) return "ram";
    if (age !== null && age >= 100) return "young-stud-ram";
    return "lamb";
  }

  if (animal.sex === "ewe") {
    const hasLambings = breedingEvents.some(
      (e) => e.eweId === animal.id && e.lambingDate
    );
    if (hasLambings || (age !== null && age >= 730)) return "ewe";
    if (age !== null && age >= 100) return "young-stud-ewe";
    return "lamb";
  }

  return "lamb";
}

// ─── Growth metrics ──────────────────────────────────────────────────────────

export function buildGrowthMetrics(animal: Animal): GrowthMetrics {
  const birthWeight = parseKg(animal.birthWeight);
  const weight100Day = parseKg(animal.weight100Day);
  const weight270Day = parseKg(animal.weight270Day);
  const currentWeight = parseKg(animal.currentWeight);
  const age = ageInDays(animal.birthDate);

  let adgBirthTo100: number | null = null;
  if (birthWeight !== null && weight100Day !== null) {
    adgBirthTo100 = calcAdg(birthWeight, weight100Day, 100);
  }

  let adgBirthTo270: number | null = null;
  if (birthWeight !== null && weight270Day !== null) {
    adgBirthTo270 = calcAdg(birthWeight, weight270Day, 270);
  }

  let adgBirthToCurrent: number | null = null;
  if (birthWeight !== null && currentWeight !== null && age !== null && age > 0) {
    adgBirthToCurrent = calcAdg(birthWeight, currentWeight, age);
  }

  const weightDataPoints = [birthWeight, weight100Day, weight270Day, currentWeight].filter(
    (v) => v !== null
  ).length;

  return {
    birthWeight,
    weight100Day,
    weight270Day,
    currentWeight,
    ageInDays: age,
    adgBirthTo100,
    adgBirthTo270,
    adgBirthToCurrent,
    weightDataPoints,
  };
}

// ─── Ram progeny metrics ──────────────────────────────────────────────────────

export function getRamProgenyMetrics(
  ramId: number,
  allAnimals: Animal[],
  breedingEvents: BreedingEvent[]
): RamProgenyMetrics {
  const progeny = allAnimals.filter((a) => a.sireId === ramId);
  const matingEvents = breedingEvents.filter((e) => e.ramId === ramId).length;
  const lambingEventsArr = breedingEvents.filter(
    (e) => e.ramId === ramId && e.lambingDate && e.lambCount && e.lambCount > 0
  );

  const progenyLive = progeny.filter(
    (a) => a.status === "active" || a.status === "sold"
  ).length;
  const progenyDead = progeny.filter(
    (a) => a.status === "dead" || a.status === "culled"
  ).length;
  const maleProgeny = progeny.filter((a) => a.sex === "ram").length;
  const femaleProgeny = progeny.filter((a) => a.sex === "ewe").length;

  const birthWeights = progeny
    .map((a) => parseKg(a.birthWeight))
    .filter((v): v is number => v !== null);
  const weights100 = progeny
    .map((a) => parseKg(a.weight100Day))
    .filter((v): v is number => v !== null);
  const weights270 = progeny
    .map((a) => parseKg(a.weight270Day))
    .filter((v): v is number => v !== null);

  return {
    totalProgeny: progeny.length,
    maleProgeny,
    femaleProgeny,
    progenyLive,
    progenyDead,
    avgProgenyBirthWeight: avg(birthWeights),
    avgProgeny100Day: avg(weights100),
    avgProgeny270Day: avg(weights270),
    matingEvents,
    lambingEvents: lambingEventsArr.length,
    lambingRate:
      matingEvents > 0
        ? Math.round((lambingEventsArr.length / matingEvents) * 100)
        : null,
  };
}

// ─── Ewe productivity metrics ─────────────────────────────────────────────────

export function getEweProductivityMetrics(
  eweId: number,
  allAnimals: Animal[],
  breedingEvents: BreedingEvent[]
): EweProductivityMetrics {
  const eweLambings = breedingEvents
    .filter((e) => e.eweId === eweId && e.lambingDate)
    .sort((a, b) => new Date(a.lambingDate!).getTime() - new Date(b.lambingDate!).getTime());

  const totalLambsBorn = eweLambings.reduce(
    (sum, e) => sum + (e.lambCount || 0),
    0
  );
  const progeny = allAnimals.filter((a) => a.damId === eweId);
  const lambsLive = progeny.filter(
    (a) => a.status === "active" || a.status === "sold"
  ).length;
  const lambsDead = progeny.filter(
    (a) => a.status === "dead" || a.status === "culled"
  ).length;

  const birthWeights = progeny
    .map((a) => parseKg(a.birthWeight))
    .filter((v): v is number => v !== null);
  const weights100 = progeny
    .map((a) => parseKg(a.weight100Day))
    .filter((v): v is number => v !== null);
  const weights270 = progeny
    .map((a) => parseKg(a.weight270Day))
    .filter((v): v is number => v !== null);

  // Inter-lambing period: average gap between consecutive lambing dates
  let avgILP: number | null = null;
  if (eweLambings.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < eweLambings.length; i++) {
      const prev = new Date(eweLambings[i - 1].lambingDate!).getTime();
      const curr = new Date(eweLambings[i].lambingDate!).getTime();
      const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (days > 0) gaps.push(days);
    }
    avgILP = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  }

  const matingEvents = breedingEvents.filter((e) => e.eweId === eweId).length;
  const firstLambDate = eweLambings[0]?.lambingDate ?? null;
  const lastLambDate = eweLambings[eweLambings.length - 1]?.lambingDate ?? null;

  return {
    totalLambingEvents: eweLambings.length,
    totalLambsBorn,
    lambsLive,
    lambsDead,
    avgLambBirthWeight: avg(birthWeights),
    avgLamb100Day: avg(weights100),
    avgLamb270Day: avg(weights270),
    survivalRate:
      totalLambsBorn > 0
        ? Math.round((lambsLive / totalLambsBorn) * 100)
        : null,
    avgILP,
    firstLambDate,
    lastLambDate,
    matingEvents,
    fertilityRate:
      matingEvents > 0
        ? Math.round((eweLambings.length / matingEvents) * 100)
        : null,
  };
}

// ─── Young animal metrics ─────────────────────────────────────────────────────

export function getYoungAnimalDevelopmentMetrics(
  animal: Animal,
  allAnimals: Animal[]
): YoungAnimalMetrics {
  const age = ageInDays(animal.birthDate);
  let ageCategory: "early" | "growing" | "maturing" = "early";
  if (age !== null) {
    if (age >= 200) ageCategory = "maturing";
    else if (age >= 60) ageCategory = "growing";
  }

  const sire = allAnimals.find((a) => a.id === animal.sireId);
  const dam = allAnimals.find((a) => a.id === animal.damId);

  const growthDataPoints = [
    parseKg(animal.birthWeight),
    parseKg(animal.weight100Day),
    parseKg(animal.weight270Day),
    parseKg(animal.currentWeight),
  ].filter((v) => v !== null).length;

  return {
    ageInDays: age,
    ageCategory,
    sireTagId: sire?.tagId ?? (animal.externalSireInfo ? "External" : null),
    damTagId: dam?.tagId ?? (animal.externalDamInfo ? "External" : null),
    hasParentalData: !!(sire || dam || animal.externalSireInfo || animal.externalDamInfo),
    growthDataPoints,
  };
}

// ─── Meat production metrics ─────────────────────────────────────────────────

export function getMeatProductionMetrics(animal: Animal): MeatProductionMetrics {
  const MARKET_TARGET_KG = 40;
  const age = ageInDays(animal.birthDate);
  const currentWeight = parseKg(animal.currentWeight);
  const birthWeight = parseKg(animal.birthWeight);

  const percentToTarget =
    currentWeight !== null
      ? Math.round((currentWeight / MARKET_TARGET_KG) * 100)
      : null;

  let adg: number | null = null;
  let projectedDays: number | null = null;
  if (birthWeight !== null && currentWeight !== null && age !== null && age > 0) {
    adg = calcAdg(birthWeight, currentWeight, age);
    if (adg !== null && adg > 0 && currentWeight < MARKET_TARGET_KG) {
      const kgNeeded = MARKET_TARGET_KG - currentWeight;
      projectedDays = Math.round((kgNeeded * 1000) / adg);
    }
  }

  return {
    ageInDays: age,
    currentWeight,
    marketTargetKg: MARKET_TARGET_KG,
    percentToTarget,
    adgBirthToCurrent: adg,
    projectedDaysToTarget: projectedDays,
  };
}

// ─── Rating ──────────────────────────────────────────────────────────────────

/**
 * Rating rules (deterministic):
 *
 * RAM:
 *  Excellent  → ≥10 progeny, lambing rate ≥80%, avg 270d ≥35 kg
 *  Strong     → ≥5 progeny, lambing rate ≥65%, avg 100d ≥22 kg
 *  Good       → ≥3 progeny, lambing rate ≥50%
 *  Developing → <3 progeny but some data
 *  Monitor    → progeny with high mortality (>30%)
 *  Insuff.    → no progeny data
 *
 * EWE:
 *  Excellent  → ≥4 lambings, survival ≥90%, fertility ≥80%
 *  Strong     → ≥3 lambings, survival ≥75%, fertility ≥65%
 *  Good       → ≥2 lambings, survival ≥60%
 *  Developing → 1 lambing event
 *  Monitor    → survival <50%
 *  Insuff.    → no lambing data
 *
 * YOUNG/LAMB/MEAT: based on ADG vs Meatmaster benchmarks:
 *  Excellent  → adg ≥300 g/day
 *  Strong     → adg ≥240 g/day
 *  Good       → adg ≥180 g/day
 *  Developing → adg ≥120 g/day
 *  Monitor    → adg <120 g/day
 *  Insuff.    → no weights
 */
export function getAnimalPerformanceRating(profile: AnimalPerformanceProfile): {
  rating: PerformanceRating;
  reason: string;
} {
  const { role, growthMetrics, ramProgenyMetrics, eweProductivityMetrics } = profile;

  if (role === "ram" || role === "young-stud-ram") {
    if (!ramProgenyMetrics || ramProgenyMetrics.totalProgeny === 0) {
      return { rating: "Insufficient data", reason: "No progeny recorded for this ram." };
    }
    const { totalProgeny, lambingRate, avgProgeny270Day, avgProgeny100Day, progenyDead } =
      ramProgenyMetrics;
    const mortalityPct =
      totalProgeny > 0 ? (progenyDead / totalProgeny) * 100 : 0;

    if (mortalityPct > 30) {
      return {
        rating: "Monitor",
        reason: `High progeny mortality (${mortalityPct.toFixed(0)}%). Review health and management.`,
      };
    }
    if (
      totalProgeny >= 10 &&
      (lambingRate ?? 0) >= 80 &&
      (avgProgeny270Day ?? 0) >= 35
    ) {
      return {
        rating: "Excellent",
        reason: `${totalProgeny} progeny, ${lambingRate}% lambing rate, avg 270d weight ${avgProgeny270Day} kg.`,
      };
    }
    if (totalProgeny >= 5 && (lambingRate ?? 0) >= 65 && (avgProgeny100Day ?? 0) >= 22) {
      return {
        rating: "Strong",
        reason: `${totalProgeny} progeny, ${lambingRate}% lambing rate, avg 100d weight ${avgProgeny100Day} kg.`,
      };
    }
    if (totalProgeny >= 3 && (lambingRate ?? 0) >= 50) {
      return {
        rating: "Good",
        reason: `${totalProgeny} progeny recorded, ${lambingRate}% lambing rate.`,
      };
    }
    if (totalProgeny > 0) {
      return {
        rating: "Developing",
        reason: `${totalProgeny} progeny recorded. More data needed for a reliable rating.`,
      };
    }
  }

  if (role === "ewe" || role === "young-stud-ewe") {
    if (!eweProductivityMetrics || eweProductivityMetrics.totalLambingEvents === 0) {
      return { rating: "Insufficient data", reason: "No lambing events recorded for this ewe." };
    }
    const { totalLambingEvents, survivalRate, fertilityRate, lambsDead, totalLambsBorn } =
      eweProductivityMetrics;
    if ((survivalRate ?? 100) < 50 && totalLambsBorn > 1) {
      return {
        rating: "Monitor",
        reason: `Lamb survival rate ${survivalRate}% (${lambsDead} losses). Review health records.`,
      };
    }
    if (
      totalLambingEvents >= 4 &&
      (survivalRate ?? 0) >= 90 &&
      (fertilityRate ?? 0) >= 80
    ) {
      return {
        rating: "Excellent",
        reason: `${totalLambingEvents} lambings, ${survivalRate}% survival, ${fertilityRate}% fertility.`,
      };
    }
    if (
      totalLambingEvents >= 3 &&
      (survivalRate ?? 0) >= 75 &&
      (fertilityRate ?? 0) >= 65
    ) {
      return {
        rating: "Strong",
        reason: `${totalLambingEvents} lambings, ${survivalRate}% survival, ${fertilityRate}% fertility.`,
      };
    }
    if (totalLambingEvents >= 2 && (survivalRate ?? 0) >= 60) {
      return {
        rating: "Good",
        reason: `${totalLambingEvents} lambing events, ${survivalRate}% lamb survival.`,
      };
    }
    if (totalLambingEvents === 1) {
      return {
        rating: "Developing",
        reason: "One lambing event recorded. More seasons needed for a full rating.",
      };
    }
  }

  // Growth-based rating for lamb/young/meat
  const adg =
    growthMetrics.adgBirthTo270 ??
    growthMetrics.adgBirthTo100 ??
    growthMetrics.adgBirthToCurrent;

  if (adg === null) {
    return { rating: "Insufficient data", reason: "Insufficient weight data to calculate growth rate." };
  }
  if (adg >= 300) return { rating: "Excellent", reason: `ADG ${adg} g/day — well above Meatmaster benchmark.` };
  if (adg >= 240) return { rating: "Strong", reason: `ADG ${adg} g/day — above average for the breed.` };
  if (adg >= 180) return { rating: "Good", reason: `ADG ${adg} g/day — within acceptable range.` };
  if (adg >= 120) return { rating: "Developing", reason: `ADG ${adg} g/day — below average, monitor growth.` };
  return { rating: "Monitor", reason: `ADG ${adg} g/day — well below target. Investigate condition.` };
}

// ─── Summary text ─────────────────────────────────────────────────────────────

/** Builds a deterministic summary under 500 characters. */
export function buildAnimalPerformanceSummary(
  profile: AnimalPerformanceProfile
): string {
  const { role, growthMetrics, ramProgenyMetrics, eweProductivityMetrics, meatProductionMetrics } =
    profile;
  const g = growthMetrics;
  const wData = g.weightDataPoints;

  const adgStr = (adg: number | null) =>
    adg !== null ? `${adg} g/day ADG` : null;

  if (role === "ram") {
    const pm = ramProgenyMetrics;
    if (!pm || pm.totalProgeny === 0) {
      const growthNote =
        wData >= 2
          ? `Growth data shows ${adgStr(g.adgBirthToCurrent) ?? "partial records"}.`
          : "Limited growth data recorded.";
      return `Ram with no progeny data recorded. Breeding value cannot be assessed. ${growthNote} Record progeny to enable full performance rating.`.slice(0, 499);
    }
    const progenyGrowth = pm.avgProgeny270Day
      ? ` Avg progeny 270d weight: ${pm.avgProgeny270Day} kg.`
      : pm.avgProgeny100Day
      ? ` Avg progeny 100d weight: ${pm.avgProgeny100Day} kg.`
      : "";
    return `Ram with ${pm.totalProgeny} recorded progeny (${pm.maleProgeny}M / ${pm.femaleProgeny}F). Lambing rate: ${pm.lambingRate ?? "N/A"}%. Survival: ${pm.progenyLive} live.${progenyGrowth} Rating: ${profile.overallRating}.`.slice(0, 499);
  }

  if (role === "ewe") {
    const em = eweProductivityMetrics;
    if (!em || em.totalLambingEvents === 0) {
      return `Ewe with no lambing events recorded. Productivity cannot be rated. ${wData >= 2 ? `Growth: ${adgStr(g.adgBirthToCurrent) ?? "partial records"}.` : ""} Record breeding events to enable full rating.`.slice(0, 499);
    }
    const ilpNote = em.avgILP ? ` Avg inter-lambing: ${em.avgILP} days.` : "";
    return `Ewe with ${em.totalLambingEvents} lambing events, ${em.totalLambsBorn} lambs born (${em.lambsLive} live). Fertility: ${em.fertilityRate ?? "N/A"}%. Survival: ${em.survivalRate ?? "N/A"}%.${ilpNote} Rating: ${profile.overallRating}.`.slice(0, 499);
  }

  if (role === "young-stud-ram" || role === "young-stud-ewe") {
    const ym = profile.youngAnimalMetrics;
    const ageNote = ym?.ageInDays ? `Age: ${ym.ageInDays} days.` : "Age unknown.";
    const parentNote = ym?.hasParentalData
      ? `Sire: ${ym.sireTagId ?? "Recorded"}. Dam: ${ym.damTagId ?? "Recorded"}.`
      : "Parentage not recorded.";
    const growthNote =
      wData >= 2
        ? `Growth tracking active (${wData} weight records, ${adgStr(g.adgBirthToCurrent) ?? "ADG pending"}).`
        : "Limited weight data — record weights to establish growth track.";
    return `Young stud — development in progress. ${ageNote} ${parentNote} ${growthNote} Rating: ${profile.overallRating}.`.slice(0, 499);
  }

  if (role === "meat-production") {
    const mm = meatProductionMetrics;
    const weightNote =
      mm?.currentWeight
        ? `Current weight: ${mm.currentWeight} kg (${mm.percentToTarget ?? "?"}% of ${mm.marketTargetKg} kg target).`
        : "Current weight not recorded.";
    const projNote =
      mm?.projectedDaysToTarget
        ? ` Est. ${mm.projectedDaysToTarget} days to market weight.`
        : "";
    return `Meat/production animal. ${weightNote}${projNote} ADG: ${adgStr(mm?.adgBirthToCurrent ?? null) ?? "Insufficient data"}. Rating: ${profile.overallRating}.`.slice(0, 499);
  }

  // Lamb
  const growthNote =
    wData >= 2
      ? `Growth: ${adgStr(g.adgBirthToCurrent) ?? "partial"}. Birth: ${g.birthWeight ?? "?"}kg → Current: ${g.currentWeight ?? "?"}kg.`
      : "Limited weight records.";
  return `Lamb record. ${growthNote} Rating: ${profile.overallRating}. Record more weight data points to improve accuracy.`.slice(0, 499);
}

// ─── Data confidence ──────────────────────────────────────────────────────────

function calcDataConfidence(profile: AnimalPerformanceProfile): DataConfidence {
  const { role, growthMetrics, ramProgenyMetrics, eweProductivityMetrics } = profile;
  const wData = growthMetrics.weightDataPoints;

  if (role === "ram") {
    const p = ramProgenyMetrics;
    if (!p || p.totalProgeny === 0) return "insufficient";
    if (p.totalProgeny >= 10 && wData >= 3) return "high";
    if (p.totalProgeny >= 5) return "medium";
    return "low";
  }
  if (role === "ewe") {
    const e = eweProductivityMetrics;
    if (!e || e.totalLambingEvents === 0) return "insufficient";
    if (e.totalLambingEvents >= 4 && wData >= 2) return "high";
    if (e.totalLambingEvents >= 2) return "medium";
    return "low";
  }
  if (wData >= 4) return "high";
  if (wData >= 2) return "medium";
  if (wData === 1) return "low";
  return "insufficient";
}

// ─── Master builder ───────────────────────────────────────────────────────────

export function buildAnimalPerformanceProfile(
  animal: Animal,
  allAnimals: Animal[],
  breedingEvents: BreedingEvent[],
  healthRecords: HealthRecord[]
): AnimalPerformanceProfile {
  const role = buildAnimalRole(animal, allAnimals, breedingEvents);
  const growthMetrics = buildGrowthMetrics(animal);

  const recentHealth = healthRecords
    .filter((h) => h.animalId === animal.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3)
    .map((h) => `${h.date}: ${h.treatment}${h.medication ? ` (${h.medication})` : ""}`);

  let ramProgenyMetrics: RamProgenyMetrics | undefined;
  let eweProductivityMetrics: EweProductivityMetrics | undefined;
  let youngAnimalMetrics: YoungAnimalMetrics | undefined;
  let meatProductionMetrics: MeatProductionMetrics | undefined;

  if (role === "ram" || role === "young-stud-ram") {
    ramProgenyMetrics = getRamProgenyMetrics(animal.id, allAnimals, breedingEvents);
    if (role === "young-stud-ram") {
      youngAnimalMetrics = getYoungAnimalDevelopmentMetrics(animal, allAnimals);
    }
  } else if (role === "ewe" || role === "young-stud-ewe") {
    eweProductivityMetrics = getEweProductivityMetrics(animal.id, allAnimals, breedingEvents);
    if (role === "young-stud-ewe") {
      youngAnimalMetrics = getYoungAnimalDevelopmentMetrics(animal, allAnimals);
    }
  } else if (role === "meat-production") {
    meatProductionMetrics = getMeatProductionMetrics(animal);
  } else {
    youngAnimalMetrics = getYoungAnimalDevelopmentMetrics(animal, allAnimals);
  }

  // Build initial profile (without summary) to get rating
  const partialProfile: AnimalPerformanceProfile = {
    animalId: animal.id,
    role,
    growthMetrics,
    ramProgenyMetrics,
    eweProductivityMetrics,
    youngAnimalMetrics,
    meatProductionMetrics,
    healthRecordCount: healthRecords.filter((h) => h.animalId === animal.id).length,
    recentHealthNotes: recentHealth,
    overallRating: "Insufficient data",
    ratingReason: "",
    summary: "",
    dataConfidence: "insufficient",
  };

  const { rating, reason } = getAnimalPerformanceRating(partialProfile);
  partialProfile.overallRating = rating;
  partialProfile.ratingReason = reason;
  partialProfile.dataConfidence = calcDataConfidence(partialProfile);
  partialProfile.summary = buildAnimalPerformanceSummary(partialProfile);

  return partialProfile;
}
