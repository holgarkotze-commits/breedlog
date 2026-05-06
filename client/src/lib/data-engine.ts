import type { Animal, BreedingEvent, HealthRecord, PerformanceRecord } from "@shared/schema";
import {
  buildAdvancedAnalysisReport,
  calculateADG,
  calculateAgeInDays,
  type AnalysisFilters,
  type ConfidenceLevel,
} from "@/lib/analysis-engine";

export interface DataInsightsInput {
  animals: Animal[];
  breedingEvents: BreedingEvent[];
  performanceRecords: PerformanceRecord[];
  healthRecords: HealthRecord[];
  season?: string | "all";
  classification?: string | "all";
  sex?: "ram" | "ewe" | "all";
  today?: Date;
}

export interface HerdDistribution {
  total: number;
  active: number;
  rams: number;
  ewes: number;
  lambs: number;
  culled: number;
  classification: { stud: number; commercial: number; slaughterCull: number; unclassified: number };
  sufficient: boolean;
}

export interface SireLeader {
  sireId: number;
  sireTag: string;
  offspring: number;
  avgBirthWeight: number | null;
  avgWeaningWeight: number | null;
  confidence: ConfidenceLevel;
}

export interface SirePerformance {
  activeSires: number;
  totalProgeny: number;
  avgProgenyPerSire: number | null;
  leaderboard: SireLeader[];
  sufficient: boolean;
  insufficientReason?: string;
}

export interface EweLeader {
  eweId: number;
  eweTag: string;
  lambCount: number;
  twinRate: number;
  weaningRate: number;
  confidence: ConfidenceLevel;
}

export interface EweMaternal {
  activeEwes: number;
  ewesLambed: number;
  barren: number;
  twinBearing: number;
  leaderboard: EweLeader[];
  watchlist: Array<{ eweId: number; eweTag: string; lambCount: number; weaningRate: number; reason: string }>;
  sufficient: boolean;
  insufficientReason?: string;
}

export interface LambGrowth {
  sampleCount: number;
  avgBirthWeight: number | null;
  avgWeaningWeight: number | null;
  avgADG: number | null;
  singleVsTwin: {
    single: { count: number; avgBirth: number | null; avgWeaning: number | null };
    twin: { count: number; avgBirth: number | null; avgWeaning: number | null };
  };
  progression: Array<{ stage: "Birth" | "Weaning" | "Latest"; avgWeight: number | null; sample: number }>;
  sufficient: boolean;
  insufficientReason?: string;
}

export interface FlockDirection {
  signal: "improving" | "stable" | "declining" | "insufficient";
  deltaWeaningWeightPct: number | null;
  deltaSurvivalPct: number | null;
  seasons: Array<{ season: string; avgWeaningWeight: number | null; lambSurvival: number | null; sampleCount: number }>;
  confidence: ConfidenceLevel;
  summary: string;
}

export interface DataQuality {
  score: number;
  confidence: ConfidenceLevel;
  warnings: string[];
}

export interface DataInsights {
  availableSeasons: string[];
  appliedFilters: { season: string; classification: string; sex: string };
  herdDistribution: HerdDistribution;
  sirePerformance: SirePerformance;
  eweMaternal: EweMaternal;
  lambGrowth: LambGrowth;
  flockDirection: FlockDirection;
  dataQuality: DataQuality;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function isActive(a: Animal): boolean {
  return (a.status || "active") === "active";
}

function isCulled(a: Animal): boolean {
  return a.status === "culled" || a.cullConfirmed === true;
}

function isLambAt(a: Animal, today: Date): boolean {
  if (!isActive(a)) return false;
  const age = calculateAgeInDays(a.birthDate, today);
  return age !== null && age <= 365;
}

function confidenceFromSample(n: number): ConfidenceLevel {
  if (n >= 30) return "Proven";
  if (n >= 12) return "High";
  if (n >= 5) return "Medium";
  return "Low";
}

export function getAvailableSeasons(animals: Animal[]): string[] {
  const set = new Set<string>();
  for (const a of animals) {
    const s = (a.lambingSeason || "").trim();
    if (s) set.add(s);
  }
  // Newest-first sort. Format like "24A","24B","25A" sorts naturally with desc string compare.
  return [...set].sort((a, b) => b.localeCompare(a));
}

function applySeasonClassSex(
  animals: Animal[],
  season: string,
  classification: string,
  sex: "ram" | "ewe" | "all",
): Animal[] {
  return animals.filter((a) => {
    if (season !== "all" && (a.lambingSeason || "") !== season) return false;
    if (classification !== "all" && (a.classification || "unclassified") !== classification) return false;
    if (sex !== "all" && a.sex !== sex) return false;
    return true;
  });
}

function buildHerdDistribution(scoped: Animal[], allAnimals: Animal[], today: Date): HerdDistribution {
  // Distribution should reflect the *scoped* selection. Active vs culled is
  // derived from status; lambs/rams/ewes use age + sex.
  const active = scoped.filter(isActive);
  const culled = scoped.filter(isCulled).length;
  const lambs = active.filter((a) => isLambAt(a, today)).length;
  const adults = active.filter((a) => !isLambAt(a, today));
  const rams = adults.filter((a) => a.sex === "ram").length;
  const ewes = adults.filter((a) => a.sex === "ewe").length;
  const cls = { stud: 0, commercial: 0, slaughterCull: 0, unclassified: 0 };
  for (const a of scoped) {
    const c = a.classification || "unclassified";
    if (c === "stud") cls.stud += 1;
    else if (c === "commercial") cls.commercial += 1;
    else if (c === "slaughter_cull") cls.slaughterCull += 1;
    else cls.unclassified += 1;
  }
  // Suppress unused-warning: allAnimals retained for future cross-context comparisons.
  void allAnimals;
  return {
    total: scoped.length,
    active: active.length,
    rams,
    ewes,
    lambs,
    culled,
    classification: cls,
    sufficient: scoped.length > 0,
  };
}

function buildSirePerformance(report: ReturnType<typeof buildAdvancedAnalysisReport>): SirePerformance {
  const leaderboard: SireLeader[] = report.sireComparison.slice(0, 10).map((s) => ({
    sireId: s.sireId,
    sireTag: s.sireTag,
    offspring: s.offspring,
    avgBirthWeight: s.avgBirthWeight,
    avgWeaningWeight: s.avgWeaningWeight,
    confidence: s.confidence,
  }));
  const totalProgeny = report.sireComparison.reduce((sum, s) => sum + s.offspring, 0);
  const activeSires = report.sireComparison.length;
  const sufficient = activeSires >= 1 && totalProgeny >= 2;
  return {
    activeSires,
    totalProgeny,
    avgProgenyPerSire: activeSires > 0 ? totalProgeny / activeSires : null,
    leaderboard,
    sufficient,
    insufficientReason: sufficient
      ? undefined
      : "Link offspring to a sire (sireId) and record at least a few progeny to unlock sire performance.",
  };
}

function buildEweMaternal(
  scoped: Animal[],
  report: ReturnType<typeof buildAdvancedAnalysisReport>,
  today: Date,
): EweMaternal {
  const adults = scoped.filter((a) => isActive(a) && !isLambAt(a, today));
  const ewes = adults.filter((a) => a.sex === "ewe");
  const ewesLambed = report.maternalRanking.filter((m) => m.lambCount > 0).length;
  const twinBearing = report.maternalRanking.filter((m) => m.twinRate > 0).length;
  const barren = Math.max(0, ewes.length - ewesLambed);
  const leaderboard: EweLeader[] = report.maternalRanking
    .filter((m) => m.lambCount > 0)
    .slice(0, 10)
    .map((m) => ({
      eweId: m.eweId,
      eweTag: m.eweTag,
      lambCount: m.lambCount,
      twinRate: m.twinRate,
      weaningRate: m.weaningRate,
      confidence: m.confidence,
    }));
  const watchlist = report.maternalRanking
    .filter((m) => m.lambCount >= 2 && m.weaningRate < 50)
    .slice(0, 10)
    .map((m) => ({
      eweId: m.eweId,
      eweTag: m.eweTag,
      lambCount: m.lambCount,
      weaningRate: m.weaningRate,
      reason: `Only ${m.weaningRate.toFixed(0)}% of ${m.lambCount} lambs reached recorded weaning.`,
    }));
  const sufficient = ewesLambed >= 1;
  return {
    activeEwes: ewes.length,
    ewesLambed,
    barren,
    twinBearing,
    leaderboard,
    watchlist,
    sufficient,
    insufficientReason: sufficient ? undefined : "Add dam links to lambs to unlock maternal ranking.",
  };
}

function buildLambGrowth(scoped: Animal[], today: Date): LambGrowth {
  const lambs = scoped.filter((a) => isLambAt(a, today));
  const birth = lambs.map((l) => toNum(l.birthWeight)).filter((v): v is number => v !== null);
  const weaning = lambs.map((l) => toNum(l.weight100Day)).filter((v): v is number => v !== null);
  const adgs: number[] = [];
  for (const l of lambs) {
    const adg = calculateADG(toNum(l.birthWeight), toNum(l.weight100Day), l.birthDate, l.weight100DayDate || null);
    if (adg !== null) adgs.push(adg);
  }

  const single = lambs.filter((l) => l.birthStatus === "single");
  const twin = lambs.filter((l) => l.birthStatus === "twin");
  const singleBirth = single.map((l) => toNum(l.birthWeight)).filter((v): v is number => v !== null);
  const singleWean = single.map((l) => toNum(l.weight100Day)).filter((v): v is number => v !== null);
  const twinBirth = twin.map((l) => toNum(l.birthWeight)).filter((v): v is number => v !== null);
  const twinWean = twin.map((l) => toNum(l.weight100Day)).filter((v): v is number => v !== null);

  const latest = lambs.map((l) => toNum(l.currentWeight)).filter((v): v is number => v !== null);

  const sufficient = lambs.length > 0 && (birth.length > 0 || weaning.length > 0);
  return {
    sampleCount: lambs.length,
    avgBirthWeight: avg(birth),
    avgWeaningWeight: avg(weaning),
    avgADG: avg(adgs),
    singleVsTwin: {
      single: { count: single.length, avgBirth: avg(singleBirth), avgWeaning: avg(singleWean) },
      twin: { count: twin.length, avgBirth: avg(twinBirth), avgWeaning: avg(twinWean) },
    },
    progression: [
      { stage: "Birth", avgWeight: avg(birth), sample: birth.length },
      { stage: "Weaning", avgWeight: avg(weaning), sample: weaning.length },
      { stage: "Latest", avgWeight: avg(latest), sample: latest.length },
    ],
    sufficient,
    insufficientReason: sufficient
      ? undefined
      : "Record lamb birth weights and weaning weights to unlock growth performance analysis.",
  };
}

function buildFlockDirection(allAnimalsForTrend: Animal[]): FlockDirection {
  // Trend is computed across the FULL animal set (not season-filtered) so the
  // signal stays meaningful even when the user filters to one season for the
  // other sections.
  const seasons = new Map<string, Animal[]>();
  for (const a of allAnimalsForTrend) {
    const s = (a.lambingSeason || "").trim();
    if (!s) continue;
    const list = seasons.get(s) || [];
    list.push(a);
    seasons.set(s, list);
  }

  const seasonRows = [...seasons.entries()]
    .map(([season, list]) => {
      const weaning = list.map((a) => toNum(a.weight100Day)).filter((v): v is number => v !== null);
      const totalLambs = list.length;
      const survivedToWeaning = list.filter((a) => a.status !== "dead" && toNum(a.weight100Day) !== null).length;
      const lambSurvival = totalLambs > 0 ? (survivedToWeaning / totalLambs) * 100 : null;
      return {
        season,
        avgWeaningWeight: avg(weaning),
        lambSurvival,
        sampleCount: totalLambs,
      };
    })
    .sort((a, b) => a.season.localeCompare(b.season)); // chronological asc for charts

  const usable = seasonRows.filter((r) => r.sampleCount >= 3 && r.avgWeaningWeight !== null);

  if (usable.length < 2) {
    return {
      signal: "insufficient",
      deltaWeaningWeightPct: null,
      deltaSurvivalPct: null,
      seasons: seasonRows,
      confidence: "Low",
      summary:
        "Need at least two lambing seasons with three or more recorded lambs each (with weaning weights) to compute a flock-direction signal.",
    };
  }

  const half = Math.floor(usable.length / 2);
  const earlier = usable.slice(0, half || 1);
  const later = usable.slice(usable.length - (half || 1));

  const earlierWean = avg(earlier.map((r) => r.avgWeaningWeight!).filter((v) => v !== null));
  const laterWean = avg(later.map((r) => r.avgWeaningWeight!).filter((v) => v !== null));
  const earlierSurv = avg(earlier.map((r) => r.lambSurvival).filter((v): v is number => v !== null));
  const laterSurv = avg(later.map((r) => r.lambSurvival).filter((v): v is number => v !== null));

  const deltaWean =
    earlierWean !== null && earlierWean > 0 && laterWean !== null
      ? ((laterWean - earlierWean) / earlierWean) * 100
      : null;
  const deltaSurv = earlierSurv !== null && laterSurv !== null ? laterSurv - earlierSurv : null;

  let signal: FlockDirection["signal"] = "stable";
  if (deltaWean !== null && deltaWean >= 5 && (deltaSurv === null || deltaSurv >= -5)) signal = "improving";
  else if (deltaWean !== null && deltaWean <= -5) signal = "declining";

  const totalSamples = usable.reduce((s, r) => s + r.sampleCount, 0);
  const confidence = confidenceFromSample(totalSamples);

  const summary = (() => {
    const parts: string[] = [];
    if (deltaWean !== null) parts.push(`weaning weight ${deltaWean >= 0 ? "+" : ""}${deltaWean.toFixed(1)}%`);
    if (deltaSurv !== null) parts.push(`lamb survival ${deltaSurv >= 0 ? "+" : ""}${deltaSurv.toFixed(1)} pp`);
    if (parts.length === 0) return "Trend computed from recorded lambing seasons.";
    return `Across ${usable.length} usable seasons: ${parts.join(", ")}.`;
  })();

  return {
    signal,
    deltaWeaningWeightPct: deltaWean,
    deltaSurvivalPct: deltaSurv,
    seasons: seasonRows,
    confidence,
    summary,
  };
}

function buildDataQuality(scoped: Animal[]): DataQuality {
  if (scoped.length === 0) {
    return { score: 0, confidence: "Low", warnings: ["No animals match the current filters."] };
  }
  const required = scoped.length * 6;
  let available = 0;
  const missing = { birthDate: 0, birthWeight: 0, weaning: 0, sireLink: 0, damLink: 0, birthStatus: 0 };
  for (const a of scoped) {
    if (a.birthDate) available++; else missing.birthDate++;
    if (toNum(a.birthWeight) !== null) available++; else missing.birthWeight++;
    if (toNum(a.weight100Day) !== null) available++; else missing.weaning++;
    if (a.sireId) available++; else missing.sireLink++;
    if (a.damId) available++; else missing.damLink++;
    if (a.birthStatus) available++; else missing.birthStatus++;
  }
  const score = (available / required) * 100;
  const warnings: string[] = [];
  if (missing.birthDate > 0) warnings.push(`${missing.birthDate} animal(s) missing birth date.`);
  if (missing.birthWeight > 0) warnings.push(`${missing.birthWeight} animal(s) missing birth weight.`);
  if (missing.weaning > 0) warnings.push(`${missing.weaning} animal(s) missing weaning weight.`);
  if (missing.sireLink > 0) warnings.push(`${missing.sireLink} animal(s) missing sire link.`);
  if (missing.damLink > 0) warnings.push(`${missing.damLink} animal(s) missing dam link.`);
  if (missing.birthStatus > 0) warnings.push(`${missing.birthStatus} animal(s) missing birth status (single/twin/triplet).`);
  return { score, confidence: confidenceFromSample(scoped.length), warnings };
}

export function buildDataInsights(input: DataInsightsInput): DataInsights {
  const today = input.today ?? new Date();
  const season = input.season ?? "all";
  const classification = input.classification ?? "all";
  const sex = input.sex ?? "all";
  const animals = input.animals || [];
  const scoped = applySeasonClassSex(animals, season, classification, sex);

  const filters: AnalysisFilters = {
    scope: "total_herd",
    sex,
    status: "all",
    classification,
    familyLine: "all",
    birthType: "all",
    minAgeDays: null,
    maxAgeDays: null,
  };
  // We feed the season-filtered animals into the report so sire/ewe/growth
  // rankings respect the season filter exactly the same way the rest of the
  // page does.
  const report = buildAdvancedAnalysisReport(
    {
      animals: scoped,
      breedingEvents: input.breedingEvents || [],
      performanceRecords: input.performanceRecords || [],
      healthRecords: input.healthRecords || [],
      today,
    },
    filters,
  );

  return {
    availableSeasons: getAvailableSeasons(animals),
    appliedFilters: { season, classification, sex },
    herdDistribution: buildHerdDistribution(scoped, animals, today),
    sirePerformance: buildSirePerformance(report),
    eweMaternal: buildEweMaternal(scoped, report, today),
    lambGrowth: buildLambGrowth(scoped, today),
    flockDirection: buildFlockDirection(animals),
    dataQuality: buildDataQuality(scoped),
  };
}
