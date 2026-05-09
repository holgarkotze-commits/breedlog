import type { Animal, BreedingEvent, HealthRecord, PerformanceRecord, FlockHealthEvent, MatingGroup, FarmSettings } from "@shared/schema";

export interface AnimalContext {
  tagId: string;
  sex: string;
  status: string;
  birthDate: string | null;
  ageApproxDays: number | null;
  birthWeight: number | null;
  weaningWeight: number | null;
  currentWeight: number | null;
  sireTag: string | null;
  damTag: string | null;
  classification: string | null;
  lambingSeason: string | null;
  healthRecordCount: number;
  offspringCount: number;
  missingFields: string[];
}

export interface BreedLogAIContext {
  workspace: {
    farmName: string | null;
    totalAnimals: number;
    dataQualityScore: number;
    dataQualityWarnings: string[];
  };
  herd: {
    total: number;
    active: number;
    rams: number;
    ewes: number;
    lambs: number;
    culled: number;
    stud: number;
    commercial: number;
    unclassified: number;
  };
  sires: Array<{
    tag: string;
    offspring: number;
    avgBirthWeight: number | null;
    avgWeaningWeight: number | null;
  }>;
  ewes: {
    active: number;
    lambed: number;
    barren: number;
    twinBearing: number;
    watchlist: Array<{ tag: string; lambCount: number; weaningRate: number }>;
    topPerformers: Array<{ tag: string; lambCount: number; twinRate: number }>;
  };
  lambGrowth: {
    count: number;
    avgBirthWeight: number | null;
    avgWeaningWeight: number | null;
    avgADG: number | null;
    singleCount: number;
    twinCount: number;
  };
  reproductive: {
    ewesJoined: number;
    ewesLambed: number;
    lambingRatePct: number | null;
    lambsPerEweJoined: number | null;
    totalLambsBorn: number;
    groupCount: number;
  };
  health: {
    totalFlockEvents: number;
    totalAnimalRecords: number;
    animalsTreated: number;
    recentRecords30Days: number;
    mortalityCount: number;
    topTreatments: Array<{ name: string; count: number }>;
  };
  missingData: {
    noBirthDate: number;
    noBirthWeight: number;
    noWeaningWeight: number;
    noSireLink: number;
    noDamLink: number;
  };
  selectedAnimal?: AnimalContext;
  contextSection?: string;
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

function isLamb(a: Animal, today: Date): boolean {
  if (!isActive(a)) return false;
  if (!a.birthDate) return false;
  const age = (today.getTime() - new Date(a.birthDate).getTime()) / (1000 * 60 * 60 * 24);
  return Number.isFinite(age) && age <= 365;
}

function ageInDays(a: Animal, today: Date): number | null {
  if (!a.birthDate) return null;
  const d = (today.getTime() - new Date(a.birthDate).getTime()) / (1000 * 60 * 60 * 24);
  return Number.isFinite(d) ? Math.round(d) : null;
}

export interface BuildContextOptions {
  animals: Animal[];
  breedingEvents: BreedingEvent[];
  performanceRecords: PerformanceRecord[];
  healthRecords: HealthRecord[];
  flockHealthEvents: FlockHealthEvent[];
  matingGroups: MatingGroup[];
  farmSettings: FarmSettings | undefined;
  animalId?: number;
  contextSection?: string;
  today?: Date;
}

export function buildBreedLogAIContext(opts: BuildContextOptions): BreedLogAIContext {
  const today = opts.today || new Date();
  const {
    animals,
    breedingEvents,
    healthRecords,
    flockHealthEvents,
    farmSettings,
    animalId,
    contextSection,
  } = opts;

  // ── Herd distribution ────────────────────────────────────────────────────
  const active   = animals.filter(isActive);
  const culled   = animals.filter((a) => a.status === "culled" || a.cullConfirmed).length;
  const lambList = active.filter((a) => isLamb(a, today));
  const adults   = active.filter((a) => !isLamb(a, today));
  const rams     = adults.filter((a) => a.sex === "ram").length;
  const ewes     = adults.filter((a) => a.sex === "ewe").length;
  let stud = 0, commercial = 0, unclassified = 0;
  for (const a of animals) {
    const c = a.classification || "";
    if (c === "stud") stud++;
    else if (c === "commercial") commercial++;
    else unclassified++;
  }

  // ── Sire performance ─────────────────────────────────────────────────────
  const sireMap = new Map<number, { tag: string; offspring: Animal[] }>();
  for (const a of animals) {
    if (!a.sireId) continue;
    const sireAnimal = animals.find((s) => s.id === a.sireId);
    if (!sireAnimal) continue;
    const entry = sireMap.get(a.sireId) || { tag: sireAnimal.tagId || `Sire#${a.sireId}`, offspring: [] };
    entry.offspring.push(a);
    sireMap.set(a.sireId, entry);
  }
  const sires = [...sireMap.values()]
    .sort((a, b) => b.offspring.length - a.offspring.length)
    .slice(0, 10)
    .map((s) => ({
      tag: s.tag,
      offspring: s.offspring.length,
      avgBirthWeight: avg(s.offspring.map((o) => toNum(o.birthWeight)).filter((v): v is number => v !== null)),
      avgWeaningWeight: avg(s.offspring.map((o) => toNum(o.weight100Day)).filter((v): v is number => v !== null)),
    }));

  // ── Ewe maternal ─────────────────────────────────────────────────────────
  const activeEwes = adults.filter((a) => a.sex === "ewe");
  const damLambMap = new Map<number, Animal[]>();
  for (const a of animals) {
    if (!a.damId) continue;
    const list = damLambMap.get(a.damId) || [];
    list.push(a);
    damLambMap.set(a.damId, list);
  }
  const eweLambed    = activeEwes.filter((e) => (damLambMap.get(e.id)?.length ?? 0) > 0).length;
  const barren       = Math.max(0, activeEwes.length - eweLambed);
  const twinBearing  = activeEwes.filter((e) => {
    const lambs = damLambMap.get(e.id) || [];
    return lambs.some((l) => l.birthStatus === "twin");
  }).length;

  const eweRanked = activeEwes
    .map((e) => {
      const lambs = damLambMap.get(e.id) || [];
      const withWeaning = lambs.filter((l) => toNum(l.weight100Day) !== null).length;
      const twinLambs = lambs.filter((l) => l.birthStatus === "twin").length;
      const twinRate = lambs.length > 0 ? (twinLambs / lambs.length) * 100 : 0;
      const weaningRate = lambs.length > 0 ? (withWeaning / lambs.length) * 100 : 0;
      return { tag: e.tagId || `Ewe#${e.id}`, lambCount: lambs.length, twinRate, weaningRate };
    })
    .filter((e) => e.lambCount > 0)
    .sort((a, b) => b.lambCount - a.lambCount);

  const watchlist = eweRanked
    .filter((e) => e.lambCount >= 2 && e.weaningRate < 50)
    .slice(0, 10)
    .map((e) => ({ tag: e.tag, lambCount: e.lambCount, weaningRate: Math.round(e.weaningRate) }));

  const topPerformers = eweRanked
    .slice(0, 10)
    .map((e) => ({ tag: e.tag, lambCount: e.lambCount, twinRate: Math.round(e.twinRate) }));

  // ── Lamb growth ───────────────────────────────────────────────────────────
  const birth   = lambList.map((l) => toNum(l.birthWeight)).filter((v): v is number => v !== null);
  const weaning = lambList.map((l) => toNum(l.weight100Day)).filter((v): v is number => v !== null);
  const adgs: number[] = [];
  for (const l of lambList) {
    const bw = toNum(l.birthWeight);
    const ww = toNum(l.weight100Day);
    if (bw !== null && ww !== null && l.birthDate && l.weight100DayDate) {
      const days = (new Date(l.weight100DayDate).getTime() - new Date(l.birthDate).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 0) adgs.push((ww - bw) / days);
    }
  }
  const singleLambs = lambList.filter((l) => l.birthStatus === "single").length;
  const twinLambs   = lambList.filter((l) => l.birthStatus === "twin").length;

  // ── Reproductive ──────────────────────────────────────────────────────────
  const joined = new Set<number>();
  const lambed = new Set<number>();
  let lambsBorn = 0;
  const groupIds = new Set<number | string>();
  for (const e of breedingEvents) {
    joined.add(e.eweId);
    if (e.matingGroupId) groupIds.add(e.matingGroupId);
    if (e.lambingDate) {
      lambed.add(e.eweId);
      lambsBorn += e.lambCount ?? 0;
    }
  }
  if (lambsBorn === 0) {
    lambsBorn = animals.filter((a) => a.damId && joined.has(a.damId)).length;
  }
  const ewesJoined = joined.size;
  const ewesLambed = lambed.size;

  // ── Health ────────────────────────────────────────────────────────────────
  const animalsTreated = new Set(healthRecords.map((r) => r.animalId)).size;
  const cutoff = today.getTime() - 30 * 24 * 60 * 60 * 1000;
  const recentRecords30Days = healthRecords.filter((r) => {
    const t = r.date ? new Date(r.date).getTime() : NaN;
    return Number.isFinite(t) && t >= cutoff;
  }).length;
  const mortalityCount = animals.filter((a) => a.status === "dead").length;
  const treatmentCounts = new Map<string, number>();
  for (const r of healthRecords) {
    const key = (r.treatment || "Other").trim() || "Other";
    treatmentCounts.set(key, (treatmentCounts.get(key) || 0) + 1);
  }
  const topTreatments = [...treatmentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // ── Missing data ──────────────────────────────────────────────────────────
  const noBirthDate   = active.filter((a) => !a.birthDate).length;
  const noBirthWeight = active.filter((a) => toNum(a.birthWeight) === null).length;
  const noWeaningWeight = active.filter((a) => toNum(a.weight100Day) === null).length;
  const noSireLink    = active.filter((a) => a.sex !== "ram" && !a.sireId).length;
  const noDamLink     = active.filter((a) => a.sex !== "ram" && !a.damId).length;

  // ── Data quality score ────────────────────────────────────────────────────
  const total = active.length;
  const warnings: string[] = [];
  let score = 100;
  if (total === 0) {
    score = 0;
    warnings.push("No animals recorded yet.");
  } else {
    const bdPct   = noBirthDate / total;
    const bwPct   = noBirthWeight / total;
    const wwPct   = noWeaningWeight / total;
    const sirePct = noSireLink / total;
    if (bdPct > 0.5)   { score -= 20; warnings.push(`${Math.round(bdPct * 100)}% of animals missing birth date.`); }
    if (bwPct > 0.5)   { score -= 20; warnings.push(`${Math.round(bwPct * 100)}% of animals missing birth weight.`); }
    if (wwPct > 0.5)   { score -= 20; warnings.push(`${Math.round(wwPct * 100)}% of animals missing weaning weight.`); }
    if (sirePct > 0.5) { score -= 15; warnings.push(`${Math.round(sirePct * 100)}% of animals missing sire link.`); }
    if (breedingEvents.length === 0) { score -= 15; warnings.push("No breeding events recorded."); }
    if (healthRecords.length === 0)  { score -= 10; warnings.push("No individual health records recorded."); }
  }
  score = Math.max(0, score);

  // ── Selected animal context ───────────────────────────────────────────────
  let selectedAnimal: AnimalContext | undefined;
  if (animalId) {
    const a = animals.find((x) => x.id === animalId);
    if (a) {
      const sireAnimal = a.sireId ? animals.find((x) => x.id === a.sireId) : null;
      const damAnimal  = a.damId  ? animals.find((x) => x.id === a.damId)  : null;
      const animalHealth  = healthRecords.filter((r) => r.animalId === a.id).length;
      const animalOffspring = animals.filter((x) => x.sireId === a.id || x.damId === a.id).length;
      const missing: string[] = [];
      if (!a.birthDate)          missing.push("birth date");
      if (toNum(a.birthWeight) === null)  missing.push("birth weight");
      if (toNum(a.weight100Day) === null) missing.push("weaning weight");
      if (!a.sireId && a.sex !== "ram")   missing.push("sire link");
      if (!a.damId)               missing.push("dam link");
      if (animalHealth === 0)     missing.push("health records");
      selectedAnimal = {
        tagId: a.tagId || `Animal#${a.id}`,
        sex: a.sex,
        status: a.status || "active",
        birthDate: a.birthDate ? String(a.birthDate) : null,
        ageApproxDays: ageInDays(a, today),
        birthWeight: toNum(a.birthWeight),
        weaningWeight: toNum(a.weight100Day),
        currentWeight: toNum(a.currentWeight),
        sireTag: sireAnimal?.tagId || null,
        damTag: damAnimal?.tagId || null,
        classification: a.classification || null,
        lambingSeason: a.lambingSeason || null,
        healthRecordCount: animalHealth,
        offspringCount: animalOffspring,
        missingFields: missing,
      };
    }
  }

  return {
    workspace: {
      farmName: farmSettings?.studName || farmSettings?.farmName || null,
      totalAnimals: animals.length,
      dataQualityScore: score,
      dataQualityWarnings: warnings,
    },
    herd: {
      total: animals.length,
      active: active.length,
      rams,
      ewes,
      lambs: lambList.length,
      culled,
      stud,
      commercial,
      unclassified,
    },
    sires,
    ewes: {
      active: activeEwes.length,
      lambed: eweLambed,
      barren,
      twinBearing,
      watchlist,
      topPerformers,
    },
    lambGrowth: {
      count: lambList.length,
      avgBirthWeight: avg(birth),
      avgWeaningWeight: avg(weaning),
      avgADG: avg(adgs),
      singleCount: singleLambs,
      twinCount: twinLambs,
    },
    reproductive: {
      ewesJoined,
      ewesLambed,
      lambingRatePct: ewesJoined > 0 ? Math.round((ewesLambed / ewesJoined) * 100) : null,
      lambsPerEweJoined: ewesJoined > 0 ? Math.round((lambsBorn / ewesJoined) * 100) / 100 : null,
      totalLambsBorn: lambsBorn,
      groupCount: groupIds.size,
    },
    health: {
      totalFlockEvents: flockHealthEvents.length,
      totalAnimalRecords: healthRecords.length,
      animalsTreated,
      recentRecords30Days,
      mortalityCount,
      topTreatments,
    },
    missingData: {
      noBirthDate,
      noBirthWeight,
      noWeaningWeight,
      noSireLink,
      noDamLink,
    },
    selectedAnimal,
    contextSection,
  };
}
