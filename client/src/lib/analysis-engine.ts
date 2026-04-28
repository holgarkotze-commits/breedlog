import { differenceInDays } from "date-fns";
import type { Animal, BreedingEvent, HealthRecord, PerformanceRecord } from "@shared/schema";

export type ConfidenceLevel = "Low" | "Medium" | "High" | "Proven";
export type SelectionCategory =
  | "Keep Stud Candidate"
  | "Keep Commercial Candidate"
  | "Watchlist"
  | "Cull Candidate"
  | "Insufficient Data";
export type PedigreeRiskLevel = "Unknown" | "Low" | "Medium" | "High";

export interface AnalysisDataInput {
  animals: Animal[];
  breedingEvents: BreedingEvent[];
  performanceRecords: PerformanceRecord[];
  healthRecords: HealthRecord[];
  today?: Date;
}

export interface RankedAnimal {
  animalId: number;
  tagId: string;
  name: string | null;
  sex: string | null;
  birthDate: string | null;
  sireTagId: string | null;
  damTagId: string | null;
  score: number;
  rank: number;
  confidence: ConfidenceLevel;
  reasonSummary: string;
  missingDataWarnings: string[];
  rawMetrics: Record<string, number | string | null>;
}

export interface AnalysisBundle {
  flockOverview: ReturnType<typeof getFlockOverview>;
  growth: ReturnType<typeof getGrowthAnalysis>;
  eweMaternal: ReturnType<typeof getEweMaternalAnalysis>;
  sirePerformance: ReturnType<typeof getSirePerformanceAnalysis>;
  survival: ReturnType<typeof getSurvivalAnalysis>;
  fertility: ReturnType<typeof getFertilityAnalysis>;
  selection: ReturnType<typeof getSelectionCandidates>;
  pedigreeRisk: ReturnType<typeof getPedigreeRiskAnalysis>;
  dataQuality: ReturnType<typeof getDataQualityReport>;
}

interface WeightPoint {
  type: "BIRTH" | "D30" | "M3" | "M6" | "M9" | "M12" | "WEANING" | "CURRENT";
  weightKg: number;
  date: string;
  nearestBased?: boolean;
}

const MATERNAL_WEIGHTS = {
  lambingConsistency: 15,
  lambsBornAlive: 15,
  lambSurvival: 20,
  lambsWeaned: 20,
  lambGrowthToWeaning: 15,
  lambingEase: 5,
  motheringIssues: 5,
  repeatedPerformance: 5,
};

const SIRE_WEIGHTS = {
  progenyCount: 20,
  progenySurvival: 20,
  progenyGrowth: 25,
  progenyConsistency: 15,
  lambsWeaned: 10,
  confidence: 10,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(num) ? num : null;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getAgeInDaysAt(dateString: string | null | undefined, targetDate: Date): number | null {
  if (!dateString) return null;
  const source = new Date(dateString);
  if (Number.isNaN(source.getTime())) return null;
  return Math.max(0, differenceInDays(targetDate, source));
}

export function calculateAgeInDays(birthDate: string | null, targetDate: string | Date): number | null {
  if (!birthDate) return null;
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  if (Number.isNaN(target.getTime())) return null;
  return getAgeInDaysAt(birthDate, target);
}

export function calculateADG(
  startWeight: number | null,
  endWeight: number | null,
  startDate: string | Date | null,
  endDate: string | Date | null
): number | null {
  if (startWeight === null || endWeight === null || !startDate || !endDate) return null;
  const from = typeof startDate === "string" ? new Date(startDate) : startDate;
  const to = typeof endDate === "string" ? new Date(endDate) : endDate;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const days = differenceInDays(to, from);
  if (days <= 0) return null;
  return (endWeight - startWeight) / days;
}

export function calculateSurvivalRate(totalBornAlive: number, totalAliveAtCheckpoint: number): number | null {
  if (totalBornAlive <= 0) return null;
  return (totalAliveAtCheckpoint / totalBornAlive) * 100;
}

export function calculateWeaningRate(lambsWeaned: number, lambsBornAlive: number): number | null {
  if (lambsBornAlive <= 0) return null;
  return (lambsWeaned / lambsBornAlive) * 100;
}

export function calculateLambingInterval(previousLambingDate: string | null, currentLambingDate: string | null): number | null {
  if (!previousLambingDate || !currentLambingDate) return null;
  const prev = new Date(previousLambingDate);
  const curr = new Date(currentLambingDate);
  if (Number.isNaN(prev.getTime()) || Number.isNaN(curr.getTime())) return null;
  const interval = differenceInDays(curr, prev);
  return interval > 0 ? interval : null;
}

export function calculateDataConfidence(requiredFields: number, availableFields: number, recordCount: number): ConfidenceLevel {
  if (requiredFields <= 0) return "Low";
  const completeness = availableFields / requiredFields;
  if (recordCount <= 1 || completeness < 0.35) return "Low";
  if (recordCount >= 6 && completeness >= 0.85) return "Proven";
  if (recordCount >= 3 && completeness >= 0.65) return "High";
  return "Medium";
}

export function buildMissingDataWarnings(record: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined || value === "") {
      warnings.push(`Missing ${key}`);
    }
  }
  return warnings;
}

export function buildRuleBasedReason(metrics: {
  confidence: ConfidenceLevel;
  positives?: string[];
  negatives?: string[];
  context?: string;
}): string {
  const positiveText = metrics.positives?.filter(Boolean).join(", ");
  const negativeText = metrics.negatives?.filter(Boolean).join(", ");
  const parts = [`${metrics.confidence} confidence`];
  if (positiveText) parts.push(`because ${positiveText}`);
  if (negativeText) parts.push(`with gaps in ${negativeText}`);
  if (metrics.context) parts.push(metrics.context);
  return parts.join(" ").trim();
}

export function buildEweReason(metrics: {
  confidence: ConfidenceLevel;
  lambsWeaned: number;
  lambsBornAlive: number;
  avgWeaningWeight: number | null;
  issues: number;
  repeatedCycles: number;
}): string {
  return buildRuleBasedReason({
    confidence: metrics.confidence,
    positives: [
      `${metrics.lambsWeaned} lambs weaned from ${metrics.lambsBornAlive} born alive`,
      metrics.avgWeaningWeight ? `average weaning weight ${metrics.avgWeaningWeight.toFixed(1)} kg` : "",
      metrics.repeatedCycles >= 2 ? `${metrics.repeatedCycles} lambing cycles recorded` : "",
    ],
    negatives: [metrics.issues > 0 ? `${metrics.issues} mothering/assistance issues` : ""],
  });
}

export function buildSireReason(metrics: {
  confidence: ConfidenceLevel;
  progenyCount: number;
  survivalToWeaning: number | null;
  avgWeaningWeight: number | null;
  consistencyPenalty: number;
}): string {
  return buildRuleBasedReason({
    confidence: metrics.confidence,
    positives: [
      `${metrics.progenyCount} linked progeny`,
      metrics.survivalToWeaning !== null ? `${metrics.survivalToWeaning.toFixed(1)}% progeny survival to weaning` : "",
      metrics.avgWeaningWeight !== null ? `${metrics.avgWeaningWeight.toFixed(1)} kg average progeny weaning weight` : "",
    ],
    negatives: [metrics.consistencyPenalty > 0 ? "high variability across progeny groups" : ""],
  });
}

export function buildLambGrowthReason(metrics: {
  confidence: ConfidenceLevel;
  adg: number | null;
  groupDelta: number | null;
  weightsRecorded: number;
}): string {
  return buildRuleBasedReason({
    confidence: metrics.confidence,
    positives: [
      metrics.adg !== null ? `ADG ${metrics.adg.toFixed(3)} kg/day` : "",
      metrics.groupDelta !== null ? `${metrics.groupDelta >= 0 ? "above" : "below"} group by ${Math.abs(metrics.groupDelta).toFixed(3)} kg/day` : "",
      `${metrics.weightsRecorded} growth points recorded`,
    ],
    negatives: [metrics.weightsRecorded < 2 ? "insufficient weights for full-period trend" : ""],
  });
}

export function buildSurvivalReason(metrics: {
  confidence: ConfidenceLevel;
  survivalToWeaning: number | null;
  bornAlive: number;
  weaned: number;
  missingCheckpointData: boolean;
}): string {
  return buildRuleBasedReason({
    confidence: metrics.confidence,
    positives: [
      `${metrics.weaned}/${metrics.bornAlive} lambs weaned`,
      metrics.survivalToWeaning !== null ? `${metrics.survivalToWeaning.toFixed(1)}% survival to weaning` : "",
    ],
    negatives: [metrics.missingCheckpointData ? "survival checkpoints missing" : ""],
  });
}

export function buildSelectionReason(metrics: {
  confidence: ConfidenceLevel;
  category: SelectionCategory;
  score: number;
  growthScore?: number | null;
  maternalScore?: number | null;
  sireScore?: number | null;
  warnings: string[];
}): string {
  return buildRuleBasedReason({
    confidence: metrics.confidence,
    context: `${metrics.category} (score ${metrics.score.toFixed(1)})`,
    positives: [
      metrics.growthScore !== null && metrics.growthScore !== undefined ? `growth ${metrics.growthScore.toFixed(1)}` : "",
      metrics.maternalScore !== null && metrics.maternalScore !== undefined ? `maternal ${metrics.maternalScore.toFixed(1)}` : "",
      metrics.sireScore !== null && metrics.sireScore !== undefined ? `sire impact ${metrics.sireScore.toFixed(1)}` : "",
    ],
    negatives: metrics.warnings,
  });
}

export function buildDataQualityReason(metrics: {
  confidence: ConfidenceLevel;
  completenessScore: number;
  majorGaps: string[];
}): string {
  return buildRuleBasedReason({
    confidence: metrics.confidence,
    positives: [`data completeness ${metrics.completenessScore.toFixed(1)}%`],
    negatives: metrics.majorGaps,
  });
}

function isActive(animal: Animal): boolean {
  return (animal.status || "active") === "active";
}

function isLamb(animal: Animal, today: Date): boolean {
  const age = getAgeInDaysAt(animal.birthDate, today);
  return age !== null && age <= 365 && isActive(animal);
}

function normalizeWeightType(type: string | null | undefined): WeightPoint["type"] | null {
  const value = (type || "").trim().toUpperCase();
  if (["BIRTH", "D30", "M3", "M6", "M9", "M12", "WEANING"].includes(value)) {
    return value as WeightPoint["type"];
  }
  if (value.includes("100") || value.includes("WEAN")) return "WEANING";
  if (value.includes("270")) return "M9";
  return null;
}

function getAnimalLookup(animals: Animal[]): Map<number, Animal> {
  return new Map(animals.map((animal) => [animal.id, animal]));
}

function getWeightPointsForAnimal(animal: Animal, records: PerformanceRecord[]): WeightPoint[] {
  const points: WeightPoint[] = [];
  if (toNumber(animal.birthWeight) !== null && animal.birthDate) {
    points.push({ type: "BIRTH", weightKg: toNumber(animal.birthWeight)!, date: animal.birthDate });
  }
  if (toNumber(animal.weight100Day) !== null && animal.weight100DayDate) {
    points.push({ type: "WEANING", weightKg: toNumber(animal.weight100Day)!, date: animal.weight100DayDate });
  }
  if (toNumber(animal.weight270Day) !== null && animal.weight270DayDate) {
    points.push({ type: "M9", weightKg: toNumber(animal.weight270Day)!, date: animal.weight270DayDate });
  }
  if (toNumber(animal.currentWeight) !== null && animal.birthDate) {
    points.push({
      type: "CURRENT",
      weightKg: toNumber(animal.currentWeight)!,
      date: new Date().toISOString().slice(0, 10),
      nearestBased: true,
    });
  }

  for (const record of records) {
    const weight = toNumber(record.weight);
    if (weight === null || !record.date) continue;
    const normalizedType = normalizeWeightType(record.type);
    if (!normalizedType) continue;
    points.push({
      type: normalizedType,
      weightKg: weight,
      date: record.date,
      nearestBased: normalizedType !== (record.type as WeightPoint["type"]),
    });
  }

  const dedupe = new Map<string, WeightPoint>();
  for (const point of points) {
    dedupe.set(point.type, point);
  }
  return [...dedupe.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function rankAnimals(items: RankedAnimal[]): RankedAnimal[] {
  return items
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function confidenceWeight(confidence: ConfidenceLevel): number {
  switch (confidence) {
    case "Low":
      return 40;
    case "Medium":
      return 65;
    case "High":
      return 85;
    case "Proven":
      return 100;
  }
}

function buildDataset(input: AnalysisDataInput) {
  const today = input.today ?? new Date();
  const animals = input.animals || [];
  const breedingEvents = input.breedingEvents || [];
  const performanceRecords = input.performanceRecords || [];
  const healthRecords = input.healthRecords || [];
  const byAnimal = getAnimalLookup(animals);
  const perfByAnimal = new Map<number, PerformanceRecord[]>();
  for (const record of performanceRecords) {
    const list = perfByAnimal.get(record.animalId) || [];
    list.push(record);
    perfByAnimal.set(record.animalId, list);
  }
  return { today, animals, breedingEvents, performanceRecords, healthRecords, byAnimal, perfByAnimal };
}

export function getFlockOverview(input: AnalysisDataInput) {
  const { today, animals } = buildDataset(input);
  const active = animals.filter(isActive);
  const lambs = active.filter((animal) => isLamb(animal, today));
  const rams = active.filter((animal) => animal.sex === "ram" && !isLamb(animal, today));
  const ewes = active.filter((animal) => animal.sex === "ewe" && !isLamb(animal, today));
  const studAnimals = active.filter((animal) => animal.classification === "stud");
  const commercialAnimals = active.filter((animal) => animal.classification === "commercial");

  const birthWeights = animals.map((a) => toNumber(a.birthWeight)).filter((v): v is number => v !== null);
  const weaningWeights = animals.map((a) => toNumber(a.weight100Day)).filter((v): v is number => v !== null);
  const m6Weights = animals
    .filter((a) => a.birthDate && a.currentWeight)
    .map((a) => {
      const age = getAgeInDaysAt(a.birthDate, today);
      if (age === null || age < 150 || age > 220) return null;
      return toNumber(a.currentWeight);
    })
    .filter((v): v is number => v !== null);
  const m12Weights = animals
    .filter((a) => a.birthDate && a.currentWeight)
    .map((a) => {
      const age = getAgeInDaysAt(a.birthDate, today);
      if (age === null || age < 330 || age > 420) return null;
      return toNumber(a.currentWeight);
    })
    .filter((v): v is number => v !== null);

  const bornAlive = animals.filter((a) => a.status !== "dead" && a.birthDate).length;
  const weaned = animals.filter((a) => toNumber(a.weight100Day) !== null).length;
  const survivalRate = calculateSurvivalRate(bornAlive, weaned);
  const completeness = getDataQualityReport(input).completenessScore;
  const confidence = calculateDataConfidence(
    animals.length * 6,
    animals.reduce((sum, a) => sum + [a.birthDate, a.sex, a.damId, a.sireId, a.birthWeight, a.weight100Day].filter(Boolean).length, 0),
    animals.length
  );

  const reasonSummary = buildRuleBasedReason({
    confidence,
    positives: [
      `${active.length} active animals`,
      survivalRate !== null ? `${survivalRate.toFixed(1)}% lamb survival to weaning checkpoint` : "",
      `data completeness ${completeness.toFixed(1)}%`,
    ],
    negatives: [
      weaningWeights.length < animals.length * 0.4 ? "limited weaning weights" : "",
      birthWeights.length < animals.length * 0.5 ? "birth weights missing for many animals" : "",
    ],
  });

  return {
    totalAnimals: animals.length,
    activeAnimals: active.length,
    rams: rams.length,
    ewes: ewes.length,
    lambs: lambs.length,
    studAnimals: studAnimals.length,
    commercialAnimals: commercialAnimals.length,
    averages: {
      birthWeight: average(birthWeights),
      weaningWeight: average(weaningWeights),
      m3Weight: average(weaningWeights),
      m6Weight: average(m6Weights),
      m12Weight: average(m12Weights),
    },
    lambSurvivalPercentage: survivalRate,
    lambsBornPerEweLambed: getFertilityAnalysis(input).lambsBornPerEweLambed,
    lambsWeanedPerEweLambed: getFertilityAnalysis(input).lambsWeanedPerEweLambed,
    dataCompletenessScore: completeness,
    confidence,
    reasonSummary,
    missingDataWarnings: getDataQualityReport(input).majorWarnings.slice(0, 4),
  };
}

export function getGrowthAnalysis(input: AnalysisDataInput) {
  const { today, animals, byAnimal, perfByAnimal } = buildDataset(input);
  const lambs = animals.filter((animal) => isLamb(animal, today));

  const rows: RankedAnimal[] = lambs.map((lamb) => {
    const points = getWeightPointsForAnimal(lamb, perfByAnimal.get(lamb.id) || []);
    const birth = points.find((point) => point.type === "BIRTH");
    const weaning = points.find((point) => point.type === "WEANING");
    const latest = points[points.length - 1];
    const adg = calculateADG(birth?.weightKg ?? null, latest?.weightKg ?? null, birth?.date ?? null, latest?.date ?? null);
    const requiredFields = 6;
    const availableFields = [lamb.birthDate, lamb.sireId, lamb.damId, birth?.weightKg, weaning?.weightKg, latest?.weightKg].filter(Boolean).length;
    const confidence = calculateDataConfidence(requiredFields, availableFields, points.length);
    const score = clamp(
      40 +
        (adg !== null ? adg * 120 : 0) +
        (weaning?.weightKg !== undefined ? weaning.weightKg : 0) * 0.3 +
        (confidenceWeight(confidence) - 50) * 0.25
    );
    const sire = lamb.sireId ? byAnimal.get(lamb.sireId) : null;
    const dam = lamb.damId ? byAnimal.get(lamb.damId) : null;
    const missing = buildMissingDataWarnings({
      birthDate: lamb.birthDate,
      sire: sire?.tagId ?? null,
      dam: dam?.tagId ?? null,
      birthWeight: birth?.weightKg ?? null,
      weaningWeight: weaning?.weightKg ?? null,
    });
    return {
      animalId: lamb.id,
      tagId: lamb.tagId,
      name: lamb.name || null,
      sex: lamb.sex || null,
      birthDate: lamb.birthDate || null,
      sireTagId: sire?.tagId || null,
      damTagId: dam?.tagId || null,
      score,
      rank: 0,
      confidence,
      reasonSummary: buildLambGrowthReason({
        confidence,
        adg,
        groupDelta: null,
        weightsRecorded: points.length,
      }),
      missingDataWarnings: missing,
      rawMetrics: {
        adg,
        birthWeight: birth?.weightKg ?? null,
        weaningWeight: weaning?.weightKg ?? null,
        latestWeight: latest?.weightKg ?? null,
      },
    };
  });

  const ranked = rankAnimals(rows);
  const groupAverageAdg = average(
    ranked
      .map((row) => (typeof row.rawMetrics.adg === "number" ? row.rawMetrics.adg : null))
      .filter((value): value is number => value !== null)
  );
  const withDelta = ranked.map((row) => ({
    ...row,
    rawMetrics: {
      ...row.rawMetrics,
      groupAverageAdg,
      groupDelta: typeof row.rawMetrics.adg === "number" && groupAverageAdg !== null ? row.rawMetrics.adg - groupAverageAdg : null,
    },
  }));

  return {
    totalLambsAnalyzed: withDelta.length,
    groupAverageAdg,
    bestGrowing: withDelta.slice(0, 10),
    slowGrowing: [...withDelta].reverse().slice(0, 10),
    rows: withDelta,
    confidence: calculateDataConfidence(withDelta.length * 4, withDelta.reduce((sum, row) => sum + (row.missingDataWarnings.length === 0 ? 4 : 2), 0), withDelta.length),
    reasonSummary: buildRuleBasedReason({
      confidence: calculateDataConfidence(withDelta.length * 4, withDelta.reduce((sum, row) => sum + (row.missingDataWarnings.length === 0 ? 4 : 2), 0), withDelta.length),
      positives: [groupAverageAdg !== null ? `average ADG ${groupAverageAdg.toFixed(3)} kg/day` : "", `${withDelta.length} lambs analyzed`],
      negatives: [withDelta.filter((row) => row.missingDataWarnings.length > 0).length > 0 ? "missing growth points on part of the flock" : ""],
    }),
  };
}

export function getEweMaternalAnalysis(input: AnalysisDataInput) {
  const { animals, breedingEvents, byAnimal, perfByAnimal } = buildDataset(input);
  const ewes = animals.filter((animal) => animal.sex === "ewe");

  const ranked = rankAnimals(
    ewes.map((ewe) => {
      const offspring = animals.filter((animal) => animal.damId === ewe.id);
      const lambings = breedingEvents.filter((event) => event.eweId === ewe.id && event.lambingDate);
      const lambsBorn = lambings.reduce((sum, event) => sum + (event.lambCount || 0), 0);
      const lambsBornAlive = offspring.filter((animal) => animal.status !== "dead").length;
      const lambsWeaned = offspring.filter((animal) => toNumber(animal.weight100Day) !== null).length;
      const survivalToWeaning = calculateSurvivalRate(Math.max(lambsBornAlive, 1), lambsWeaned);
      const avgWeaningWeight = average(
        offspring.map((animal) => toNumber(animal.weight100Day)).filter((value): value is number => value !== null)
      );
      const intervals = lambings
        .map((event) => event.lambingDate)
        .filter((value): value is string => !!value)
        .sort()
        .slice(1)
        .map((date, idx, list) => calculateLambingInterval(list[idx] || null, date))
        .filter((value): value is number => value !== null);
      const avgInterval = average(intervals);
      const issueCount = offspring.filter((animal) => (animal.notes || "").toLowerCase().includes("reject")).length;
      const confidence = calculateDataConfidence(
        8,
        [lambings.length > 0, lambsBorn > 0, lambsBornAlive > 0, lambsWeaned > 0, avgWeaningWeight !== null, avgInterval !== null, ewe.damId, ewe.sireId].filter(Boolean).length,
        lambings.length
      );
      const repeated = lambings.length >= 3 ? 100 : lambings.length >= 2 ? 70 : lambings.length === 1 ? 40 : 0;
      const maternalScore = clamp(
        (Math.min(lambings.length, 4) / 4) * MATERNAL_WEIGHTS.lambingConsistency +
          (lambsBornAlive > 0 ? Math.min(lambsBornAlive / Math.max(lambsBorn, 1), 1) * 100 : 0) * (MATERNAL_WEIGHTS.lambsBornAlive / 100) +
          (survivalToWeaning || 0) * (MATERNAL_WEIGHTS.lambSurvival / 100) +
          (lambsWeaned > 0 ? Math.min(lambsWeaned / Math.max(lambsBornAlive, 1), 1) * 100 : 0) * (MATERNAL_WEIGHTS.lambsWeaned / 100) +
          ((avgWeaningWeight || 0) / 40) * 100 * (MATERNAL_WEIGHTS.lambGrowthToWeaning / 100) +
          (issueCount === 0 ? 100 : Math.max(0, 100 - issueCount * 20)) * (MATERNAL_WEIGHTS.motheringIssues / 100) +
          repeated * (MATERNAL_WEIGHTS.repeatedPerformance / 100)
      );
      const missing = buildMissingDataWarnings({
        lambingRecords: lambings.length > 0 ? lambings.length : null,
        weaningWeights: avgWeaningWeight,
        sireLink: ewe.sireId,
      });
      return {
        animalId: ewe.id,
        tagId: ewe.tagId,
        name: ewe.name || null,
        sex: ewe.sex || null,
        birthDate: ewe.birthDate || null,
        sireTagId: ewe.sireId ? byAnimal.get(ewe.sireId)?.tagId || null : null,
        damTagId: ewe.damId ? byAnimal.get(ewe.damId)?.tagId || null : null,
        score: maternalScore,
        rank: 0,
        confidence,
        reasonSummary: buildEweReason({
          confidence,
          lambsWeaned,
          lambsBornAlive,
          avgWeaningWeight,
          issues: issueCount,
          repeatedCycles: lambings.length,
        }),
        missingDataWarnings: missing,
        rawMetrics: {
          exposures: lambings.length,
          lambings: lambings.length,
          lambsBorn,
          lambsBornAlive,
          lambsWeaned,
          survivalToWeaning,
          avgWeaningWeight,
          avgLambingIntervalDays: avgInterval,
        },
      } satisfies RankedAnimal;
    })
  );

  return {
    formula: MATERNAL_WEIGHTS,
    rows: ranked,
    top: ranked.slice(0, 10),
    watchlist: ranked.filter((row) => row.score < 45 || row.missingDataWarnings.length >= 3).slice(0, 10),
    confidence: calculateDataConfidence(ranked.length * 5, ranked.reduce((sum, row) => sum + (5 - Math.min(4, row.missingDataWarnings.length)), 0), ranked.length),
  };
}

export function getSirePerformanceAnalysis(input: AnalysisDataInput) {
  const { animals, byAnimal } = buildDataset(input);
  const sires = animals.filter((animal) => animal.sex === "ram");

  const ranked = rankAnimals(
    sires.map((ram) => {
      const progeny = animals.filter((animal) => animal.sireId === ram.id);
      const bornAlive = progeny.filter((animal) => animal.status !== "dead").length;
      const weaned = progeny.filter((animal) => toNumber(animal.weight100Day) !== null).length;
      const avgWeaningWeight = average(
        progeny.map((animal) => toNumber(animal.weight100Day)).filter((value): value is number => value !== null)
      );
      const avgBirthWeight = average(
        progeny.map((animal) => toNumber(animal.birthWeight)).filter((value): value is number => value !== null)
      );
      const progenyAdg = average(
        progeny
          .map((animal) => {
            const adg = calculateADG(
              toNumber(animal.birthWeight),
              toNumber(animal.weight100Day),
              animal.birthDate,
              animal.weight100DayDate || animal.birthDate
            );
            return adg;
          })
          .filter((value): value is number => value !== null)
      );
      const dams = new Set(progeny.map((animal) => animal.damId).filter((value): value is number => typeof value === "number"));
      const consistencyPenalty = dams.size > 0 ? Math.max(0, 20 - dams.size * 2) : 20;
      const confidence = calculateDataConfidence(6, [progeny.length > 0, bornAlive > 0, weaned > 0, avgWeaningWeight !== null, dams.size > 1, progeny.length >= 10].filter(Boolean).length, progeny.length);
      const score = clamp(
        (Math.min(progeny.length, 25) / 25) * SIRE_WEIGHTS.progenyCount +
          (calculateSurvivalRate(Math.max(bornAlive, 1), weaned) || 0) * (SIRE_WEIGHTS.progenySurvival / 100) +
          ((progenyAdg || 0) * 120) * (SIRE_WEIGHTS.progenyGrowth / 100) +
          Math.max(0, 100 - consistencyPenalty) * (SIRE_WEIGHTS.progenyConsistency / 100) +
          (weaned > 0 ? Math.min(weaned / Math.max(progeny.length, 1), 1) * 100 : 0) * (SIRE_WEIGHTS.lambsWeaned / 100) +
          confidenceWeight(confidence) * (SIRE_WEIGHTS.confidence / 100)
      );
      const missing = buildMissingDataWarnings({
        progeny: progeny.length > 0 ? progeny.length : null,
        weaningWeights: avgWeaningWeight,
        damDiversity: dams.size > 1 ? dams.size : null,
      });
      return {
        animalId: ram.id,
        tagId: ram.tagId,
        name: ram.name || null,
        sex: ram.sex || null,
        birthDate: ram.birthDate || null,
        sireTagId: ram.sireId ? byAnimal.get(ram.sireId)?.tagId || null : null,
        damTagId: ram.damId ? byAnimal.get(ram.damId)?.tagId || null : null,
        score,
        rank: 0,
        confidence,
        reasonSummary: buildSireReason({
          confidence,
          progenyCount: progeny.length,
          survivalToWeaning: calculateSurvivalRate(Math.max(bornAlive, 1), weaned),
          avgWeaningWeight,
          consistencyPenalty,
        }),
        missingDataWarnings: missing,
        rawMetrics: {
          progenyCount: progeny.length,
          progenyBornAlive: bornAlive,
          progenyWeaned: weaned,
          avgBirthWeight,
          avgWeaningWeight,
          avgProgenyAdg: progenyAdg,
        },
      } satisfies RankedAnimal;
    })
  );

  return {
    formula: SIRE_WEIGHTS,
    rows: ranked,
    top: ranked.slice(0, 10),
    lowConfidence: ranked.filter((row) => row.confidence === "Low").slice(0, 10),
    confidence: calculateDataConfidence(ranked.length * 4, ranked.reduce((sum, row) => sum + (row.confidence === "Low" ? 1 : row.confidence === "Medium" ? 2 : 3), 0), ranked.length),
  };
}

export function getSurvivalAnalysis(input: AnalysisDataInput) {
  const { animals, breedingEvents } = buildDataset(input);
  const bornAlive = animals.filter((animal) => animal.birthDate && animal.status !== "dead");
  const weaned = animals.filter((animal) => toNumber(animal.weight100Day) !== null);
  const survivalToWeaning = calculateSurvivalRate(bornAlive.length, weaned.length);
  const bySire = new Map<number, { bornAlive: number; weaned: number }>();
  const byDam = new Map<number, { bornAlive: number; weaned: number }>();

  for (const animal of animals) {
    if (animal.sireId) {
      const current = bySire.get(animal.sireId) || { bornAlive: 0, weaned: 0 };
      if (animal.status !== "dead") current.bornAlive += 1;
      if (toNumber(animal.weight100Day) !== null) current.weaned += 1;
      bySire.set(animal.sireId, current);
    }
    if (animal.damId) {
      const current = byDam.get(animal.damId) || { bornAlive: 0, weaned: 0 };
      if (animal.status !== "dead") current.bornAlive += 1;
      if (toNumber(animal.weight100Day) !== null) current.weaned += 1;
      byDam.set(animal.damId, current);
    }
  }

  const sireRows = [...bySire.entries()].map(([sireId, stats]) => ({
    sireId,
    bornAlive: stats.bornAlive,
    weaned: stats.weaned,
    survivalRate: calculateSurvivalRate(stats.bornAlive, stats.weaned),
  }));
  const damRows = [...byDam.entries()].map(([damId, stats]) => ({
    damId,
    bornAlive: stats.bornAlive,
    weaned: stats.weaned,
    survivalRate: calculateSurvivalRate(stats.bornAlive, stats.weaned),
  }));
  const confidence = calculateDataConfidence(4, [bornAlive.length > 0, weaned.length > 0, sireRows.length > 0, damRows.length > 0].filter(Boolean).length, animals.length);
  return {
    bornAlive: bornAlive.length,
    weaned: weaned.length,
    survivalToWeaning,
    bySire: sireRows.sort((a, b) => (b.survivalRate || 0) - (a.survivalRate || 0)).slice(0, 10),
    byDam: damRows.sort((a, b) => (b.survivalRate || 0) - (a.survivalRate || 0)).slice(0, 10),
    confidence,
    reasonSummary: buildSurvivalReason({
      confidence,
      survivalToWeaning,
      bornAlive: bornAlive.length,
      weaned: weaned.length,
      missingCheckpointData: true,
    }),
    missingDataWarnings: ["Survival checkpoint records (DAY_1, M3, M6, M9, M12) are not yet captured in this schema."],
  };
}

export function getFertilityAnalysis(input: AnalysisDataInput) {
  const { animals, breedingEvents } = buildDataset(input);
  const ewesExposed = new Set(breedingEvents.map((event) => event.eweId)).size;
  const ewesLambed = new Set(breedingEvents.filter((event) => !!event.lambingDate).map((event) => event.eweId)).size;
  const totalBorn = breedingEvents.reduce((sum, event) => sum + (event.lambCount || 0), 0);
  const totalWeaned = animals.filter((animal) => toNumber(animal.weight100Day) !== null).length;
  const lambsBornPerEweExposed = ewesExposed > 0 ? totalBorn / ewesExposed : null;
  const lambsBornPerEweLambed = ewesLambed > 0 ? totalBorn / ewesLambed : null;
  const lambsWeanedPerEweExposed = ewesExposed > 0 ? totalWeaned / ewesExposed : null;
  const lambsWeanedPerEweLambed = ewesLambed > 0 ? totalWeaned / ewesLambed : null;
  const confidence = calculateDataConfidence(4, [ewesExposed > 0, ewesLambed > 0, totalBorn > 0, totalWeaned > 0].filter(Boolean).length, breedingEvents.length);
  return {
    ewesExposed,
    ewesLambed,
    lambsBornPerEweExposed,
    lambsBornPerEweLambed,
    lambsWeanedPerEweExposed,
    lambsWeanedPerEweLambed,
    confidence,
    reasonSummary: buildRuleBasedReason({
      confidence,
      positives: [
        ewesExposed > 0 ? `${ewesExposed} ewes exposed` : "",
        ewesLambed > 0 ? `${ewesLambed} ewes with lambing records` : "",
      ],
      negatives: [ewesExposed === 0 ? "breeding exposure records missing" : ""],
    }),
    missingDataWarnings: ewesExposed === 0 ? ["No breeding exposure records available."] : [],
  };
}

export function getSelectionCandidates(input: AnalysisDataInput) {
  const growth = getGrowthAnalysis(input);
  const ewe = getEweMaternalAnalysis(input);
  const sire = getSirePerformanceAnalysis(input);
  const growthMap = new Map(growth.rows.map((row) => [row.animalId, row]));
  const eweMap = new Map(ewe.rows.map((row) => [row.animalId, row]));
  const sireMap = new Map(sire.rows.map((row) => [row.animalId, row]));
  const { animals, today } = buildDataset(input);

  const rows = animals
    .filter((animal) => isActive(animal))
    .map((animal) => {
      const growthRow = growthMap.get(animal.id);
      const eweRow = eweMap.get(animal.id);
      const sireRow = sireMap.get(animal.id);
      const confidence = growthRow?.confidence || eweRow?.confidence || sireRow?.confidence || "Low";
      const baseScore = growthRow?.score || eweRow?.score || sireRow?.score || 0;
      const warnings = [
        ...(growthRow?.missingDataWarnings || []),
        ...(eweRow?.missingDataWarnings || []),
        ...(sireRow?.missingDataWarnings || []),
      ].slice(0, 3);
      const isYoungLamb = isLamb(animal, today);
      let category: SelectionCategory = "Insufficient Data";
      if (confidence === "Low" || baseScore < 30) {
        category = "Insufficient Data";
      } else if (baseScore < 45) {
        category = "Cull Candidate";
      } else if (baseScore < 60) {
        category = "Watchlist";
      } else if (animal.classification === "stud" || (animal.sex === "ram" && baseScore >= 70)) {
        category = "Keep Stud Candidate";
      } else if (animal.classification === "commercial" || baseScore >= 60) {
        category = "Keep Commercial Candidate";
      }
      return {
        animalId: animal.id,
        tagId: animal.tagId,
        category,
        score: baseScore,
        confidence,
        reasonSummary: buildSelectionReason({
          confidence,
          category,
          score: baseScore,
          growthScore: growthRow?.score || null,
          maternalScore: eweRow?.score || null,
          sireScore: sireRow?.score || null,
          warnings,
        }),
        missingDataWarnings: warnings,
      };
    });

  return {
    rows,
    keepStud: rows.filter((row) => row.category === "Keep Stud Candidate").slice(0, 10),
    keepCommercial: rows.filter((row) => row.category === "Keep Commercial Candidate").slice(0, 10),
    watchlist: rows.filter((row) => row.category === "Watchlist").slice(0, 10),
    cullCandidates: rows.filter((row) => row.category === "Cull Candidate").slice(0, 10),
    insufficientData: rows.filter((row) => row.category === "Insufficient Data").slice(0, 10),
  };
}

export function getPedigreeRiskAnalysis(input: AnalysisDataInput) {
  const { animals, byAnimal } = buildDataset(input);
  const warnings: Array<{ animalId: number; tagId: string; risk: PedigreeRiskLevel; reason: string; missing: string[] }> = [];

  for (const animal of animals) {
    const missing = buildMissingDataWarnings({ sireId: animal.sireId, damId: animal.damId });
    if (!animal.sireId || !animal.damId) {
      warnings.push({
        animalId: animal.id,
        tagId: animal.tagId,
        risk: "Unknown",
        reason: "Unknown risk because one or both parents are missing.",
        missing,
      });
      continue;
    }
    if (animal.sireId === animal.damId) {
      warnings.push({
        animalId: animal.id,
        tagId: animal.tagId,
        risk: "High",
        reason: "High risk because sire and dam are the same animal record.",
        missing: [],
      });
      continue;
    }
    const sire = byAnimal.get(animal.sireId);
    const dam = byAnimal.get(animal.damId);
    const sharedGrandParent =
      (sire?.sireId && dam?.sireId && sire.sireId === dam.sireId) ||
      (sire?.damId && dam?.damId && sire.damId === dam.damId);
    if (sharedGrandParent) {
      warnings.push({
        animalId: animal.id,
        tagId: animal.tagId,
        risk: "Medium",
        reason: "Medium risk because sire and dam lines share a grandparent.",
        missing: [],
      });
      continue;
    }
    warnings.push({
      animalId: animal.id,
      tagId: animal.tagId,
      risk: "Low",
      reason: "Low risk from available pedigree links.",
      missing: [],
    });
  }

  return {
    rows: warnings.slice(0, 200),
    highRisk: warnings.filter((row) => row.risk === "High"),
    mediumRisk: warnings.filter((row) => row.risk === "Medium"),
    unknown: warnings.filter((row) => row.risk === "Unknown"),
  };
}

export function getDataQualityReport(input: AnalysisDataInput) {
  const { animals } = buildDataset(input);
  const lambs = animals.filter((animal) => animal.birthDate !== null);
  const ewes = animals.filter((animal) => animal.sex === "ewe");
  const rams = animals.filter((animal) => animal.sex === "ram");
  const missingBirthDate = animals.filter((animal) => !animal.birthDate).length;
  const missingSex = animals.filter((animal) => !animal.sex).length;
  const missingSire = animals.filter((animal) => !animal.sireId).length;
  const missingDam = animals.filter((animal) => !animal.damId).length;
  const lambsMissingBirthWeight = lambs.filter((animal) => toNumber(animal.birthWeight) === null).length;
  const lambsMissingWeaningWeight = lambs.filter((animal) => toNumber(animal.weight100Day) === null).length;
  const missingManagementGroup = animals.filter((animal) => !animal.managementGroup).length;
  const ewesMissingLambingRecords = ewes.filter((ewe) => !animals.some((animal) => animal.damId === ewe.id)).length;
  const ramsTooFewProgeny = rams.filter((ram) => animals.filter((animal) => animal.sireId === ram.id).length < 3).length;
  const incompleteStatus = animals.filter((animal) => !animal.status).length;
  const duplicateRisk = animals.filter((animal, index, list) => list.findIndex((entry) => entry.tagId === animal.tagId) !== index).length;

  const requiredFields = animals.length * 8;
  const availableFields = animals.reduce(
    (sum, animal) =>
      sum +
      [
        animal.tagId,
        animal.birthDate,
        animal.sex,
        animal.sireId,
        animal.damId,
        animal.birthWeight,
        animal.weight100Day,
        animal.status,
      ].filter((value) => value !== null && value !== undefined && value !== "").length,
    0
  );
  const completenessScore = requiredFields > 0 ? (availableFields / requiredFields) * 100 : 0;
  const majorWarnings = [
    missingSire > animals.length * 0.3 ? "Record sire links for lambs to improve sire performance analysis." : "",
    lambsMissingWeaningWeight > lambs.length * 0.3 ? "Add weaning weights and M3/M6/M9/M12 weights to improve growth analysis." : "",
    ewesMissingLambingRecords > ewes.length * 0.3 ? "Link lambing outcomes to ewes for stronger maternal analysis." : "",
  ].filter(Boolean);
  const confidence = calculateDataConfidence(requiredFields, availableFields, animals.length);

  return {
    totalAnimals: animals.length,
    missingBirthDate,
    missingSex,
    missingSire,
    missingDam,
    lambsMissingBirthWeight,
    lambsMissingWeaningWeight,
    missingManagementGroup,
    ewesMissingLambingRecords,
    ramsTooFewProgeny,
    incompleteStatus,
    unanalyzableRecords: [missingBirthDate, missingSex, missingSire, missingDam].reduce((sum, value) => sum + value, 0),
    duplicateRiskRecords: duplicateRisk,
    completenessScore,
    confidence,
    majorWarnings,
    reasonSummary: buildDataQualityReason({
      confidence,
      completenessScore,
      majorGaps: majorWarnings,
    }),
  };
}

export function buildAnalysisBundle(input: AnalysisDataInput): AnalysisBundle {
  return {
    flockOverview: getFlockOverview(input),
    growth: getGrowthAnalysis(input),
    eweMaternal: getEweMaternalAnalysis(input),
    sirePerformance: getSirePerformanceAnalysis(input),
    survival: getSurvivalAnalysis(input),
    fertility: getFertilityAnalysis(input),
    selection: getSelectionCandidates(input),
    pedigreeRisk: getPedigreeRiskAnalysis(input),
    dataQuality: getDataQualityReport(input),
  };
}

export interface AnalysisFilters {
  scope: "total_herd" | "individual" | "offspring_of_sire";
  animalId?: number | null;
  sireId?: number | null;
  sex?: "ram" | "ewe" | "all";
  status?: string | "all";
  classification?: string | "all";
  familyLine?: string | "all";
  birthType?: string | "all";
  minAgeDays?: number | null;
  maxAgeDays?: number | null;
}

export interface AdvancedAnalysisReport {
  filteredCount: number;
  herdComposition: { total: number; rams: number; ewes: number; lambs: number };
  birthTypeSplit: Record<string, number>;
  dataCompleteness: { score: number; warnings: string[]; confidence: ConfidenceLevel };
  weights: {
    actualBirthAvg: number | null;
    estimatedBirthAvg: number | null;
    actualWeaningAvg: number | null;
    estimatedWeaningAvg: number | null;
  };
  sireComparison: Array<{ sireId: number; sireTag: string; offspring: number; avgBirthWeight: number | null; avgWeaningWeight: number | null; confidence: ConfidenceLevel }>;
  familyLineComparison: Array<{ familyLine: string; animals: number; avgBirthWeight: number | null; avgWeaningWeight: number | null }>;
  maternalRanking: Array<{ eweId: number; eweTag: string; lambCount: number; twinRate: number; weaningRate: number; confidence: ConfidenceLevel }>;
  growthRanking: Array<{ animalId: number; tagId: string; metric: number; confidence: ConfidenceLevel }>;
}

function getConfidenceFromRatio(records: number, ratio: number): ConfidenceLevel {
  if (records >= 10 && ratio >= 0.75) return "High";
  if (records >= 4 && ratio >= 0.45) return "Medium";
  return "Low";
}

export function filterAnimalsBySelection(input: AnalysisDataInput, filters: AnalysisFilters): Animal[] {
  const today = input.today ?? new Date();
  let animals = [...(input.animals || [])];
  if (filters.scope === "individual" && filters.animalId) {
    animals = animals.filter((a) => a.id === filters.animalId);
  }
  if (filters.scope === "offspring_of_sire" && filters.sireId) {
    animals = animals.filter((a) => a.sireId === filters.sireId);
  }
  if (filters.sex && filters.sex !== "all") {
    animals = animals.filter((a) => a.sex === filters.sex);
  }
  if (filters.status && filters.status !== "all") {
    animals = animals.filter((a) => a.status === filters.status);
  }
  if (filters.classification && filters.classification !== "all") {
    animals = animals.filter((a) => a.classification === filters.classification);
  }
  if (filters.familyLine && filters.familyLine !== "all") {
    animals = animals.filter((a) => (a.managementGroup || "Unassigned") === filters.familyLine);
  }
  if (filters.birthType && filters.birthType !== "all") {
    animals = animals.filter((a) => (a.birthStatus || "unknown") === filters.birthType);
  }
  if (filters.minAgeDays || filters.maxAgeDays) {
    animals = animals.filter((a) => {
      const age = getAgeInDaysAt(a.birthDate, today);
      if (age === null) return false;
      if (filters.minAgeDays && age < filters.minAgeDays) return false;
      if (filters.maxAgeDays && age > filters.maxAgeDays) return false;
      return true;
    });
  }
  return animals;
}

export function buildAdvancedAnalysisReport(input: AnalysisDataInput, filters: AnalysisFilters): AdvancedAnalysisReport {
  const today = input.today ?? new Date();
  const selected = filterAnimalsBySelection(input, filters);
  const byId = new Map(input.animals.map((a) => [a.id, a]));

  const lambs = selected.filter((a) => isLamb(a, today));
  const rams = selected.filter((a) => a.sex === "ram");
  const ewes = selected.filter((a) => a.sex === "ewe");

  const birthTypeSplit: Record<string, number> = {};
  for (const animal of selected) {
    const key = animal.birthStatus || "unknown";
    birthTypeSplit[key] = (birthTypeSplit[key] || 0) + 1;
  }

  const actualBirth = selected
    .filter((a) => toNumber(a.birthWeight) !== null && !(a as any).birthWeightEstimated)
    .map((a) => toNumber(a.birthWeight) as number);
  const estimatedBirth = selected
    .filter((a) => toNumber(a.birthWeight) !== null && !!(a as any).birthWeightEstimated)
    .map((a) => toNumber(a.birthWeight) as number);
  const actualWeaning = selected
    .filter((a) => toNumber(a.weight100Day) !== null && !(a as any).weight100DayEstimated)
    .map((a) => toNumber(a.weight100Day) as number);
  const estimatedWeaning = selected
    .filter((a) => toNumber(a.weight100Day) !== null && !!(a as any).weight100DayEstimated)
    .map((a) => toNumber(a.weight100Day) as number);

  const completenessRequired = selected.length * 10;
  const completenessAvailable = selected.reduce((sum, a) => {
    return sum + [a.tagId, a.sex, a.status, a.birthDate, a.birthStatus, a.sireId, a.damId, a.birthWeight, a.weight100DayDate, a.weight100Day].filter(Boolean).length;
  }, 0);
  const completenessScore = completenessRequired > 0 ? (completenessAvailable / completenessRequired) * 100 : 0;
  const completenessWarnings = [
    selected.some((a) => !a.birthDate) ? "Record birth date for all animals to improve age and survival analysis." : "",
    selected.some((a) => !a.birthWeight) ? "Record birth weights (actual or estimated flagged) for stronger growth analysis." : "",
    selected.some((a) => !a.weight100Day) ? "Record weaning date + weaning weight to unlock weaning performance analysis." : "",
    selected.some((a) => !a.sireId) ? "Add sire links to unlock sire offspring comparison." : "",
    selected.some((a) => !a.damId) ? "Add dam links to unlock maternal ranking." : "",
  ].filter(Boolean);

  const sireMap = new Map<number, Animal[]>();
  for (const animal of selected) {
    if (!animal.sireId) continue;
    const list = sireMap.get(animal.sireId) || [];
    list.push(animal);
    sireMap.set(animal.sireId, list);
  }
  const sireComparison = [...sireMap.entries()].map(([sireId, offspring]) => {
    const birthValues = offspring.map((a) => toNumber(a.birthWeight)).filter((v): v is number => v !== null);
    const weaningValues = offspring.map((a) => toNumber(a.weight100Day)).filter((v): v is number => v !== null);
    const confidence = getConfidenceFromRatio(
      offspring.length,
      ((birthValues.length + weaningValues.length) / Math.max(offspring.length * 2, 1))
    );
    return {
      sireId,
      sireTag: byId.get(sireId)?.tagId || `Sire ${sireId}`,
      offspring: offspring.length,
      avgBirthWeight: average(birthValues),
      avgWeaningWeight: average(weaningValues),
      confidence,
    };
  }).sort((a, b) => b.offspring - a.offspring);

  const familyLineMap = new Map<string, Animal[]>();
  for (const animal of selected) {
    const key = animal.managementGroup || "Unassigned";
    const list = familyLineMap.get(key) || [];
    list.push(animal);
    familyLineMap.set(key, list);
  }
  const familyLineComparison = [...familyLineMap.entries()].map(([familyLine, items]) => ({
    familyLine,
    animals: items.length,
    avgBirthWeight: average(items.map((a) => toNumber(a.birthWeight)).filter((v): v is number => v !== null)),
    avgWeaningWeight: average(items.map((a) => toNumber(a.weight100Day)).filter((v): v is number => v !== null)),
  })).sort((a, b) => b.animals - a.animals);

  const maternalRanking = ewes.map((ewe) => {
    const offspring = selected.filter((a) => a.damId === ewe.id);
    const twins = offspring.filter((a) => a.birthStatus === "twin").length;
    const weaned = offspring.filter((a) => toNumber(a.weight100Day) !== null).length;
    const confidence = getConfidenceFromRatio(offspring.length, offspring.length ? weaned / offspring.length : 0);
    return {
      eweId: ewe.id,
      eweTag: ewe.tagId,
      lambCount: offspring.length,
      twinRate: offspring.length ? (twins / offspring.length) * 100 : 0,
      weaningRate: offspring.length ? (weaned / offspring.length) * 100 : 0,
      confidence,
    };
  }).sort((a, b) => b.lambCount - a.lambCount);

  const growthRanking = lambs.map((lamb) => {
    const birth = toNumber(lamb.birthWeight);
    const weaning = toNumber(lamb.weight100Day);
    const adg = calculateADG(birth, weaning, lamb.birthDate, lamb.weight100DayDate || lamb.birthDate);
    const confidence = getConfidenceFromRatio(1, adg !== null ? 1 : 0.3);
    return {
      animalId: lamb.id,
      tagId: lamb.tagId,
      metric: adg ?? 0,
      confidence,
    };
  }).sort((a, b) => b.metric - a.metric);

  return {
    filteredCount: selected.length,
    herdComposition: { total: selected.length, rams: rams.length, ewes: ewes.length, lambs: lambs.length },
    birthTypeSplit,
    dataCompleteness: {
      score: completenessScore,
      warnings: completenessWarnings,
      confidence: getConfidenceFromRatio(selected.length, completenessScore / 100),
    },
    weights: {
      actualBirthAvg: average(actualBirth),
      estimatedBirthAvg: average(estimatedBirth),
      actualWeaningAvg: average(actualWeaning),
      estimatedWeaningAvg: average(estimatedWeaning),
    },
    sireComparison,
    familyLineComparison,
    maternalRanking,
    growthRanking,
  };
}
