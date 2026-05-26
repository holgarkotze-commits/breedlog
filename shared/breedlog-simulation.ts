import { addDays } from "date-fns";
import type { Animal, BreedingEvent, FarmSettings, HealthRecord, MatingGroup, PerformanceRecord } from "./schema";

export interface BreedLogSimulationDataset {
  farmMetadata?: any;
  farmSettings: FarmSettings;
  animals: Animal[];
  matingGroups: MatingGroup[];
  breedingEvents: BreedingEvent[];
  performanceRecords: PerformanceRecord[];
  healthRecords: HealthRecord[];
  expectedAnalysisSummary: Record<string, any>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const USER = "simulation-user-kw";
const SIM_DATE = new Date("2026-05-11T00:00:00Z");
const FOUNDING_DATE = new Date("2022-09-01T00:00:00Z");

// Deterministic hash → [0, 1)
function det(a: number, b: number): number {
  return (((a * 2654435761 + b * 40503) >>> 0) / 4294967296);
}
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function r1(v: number) { return Math.round(v * 10) / 10; }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function ageAt(birthDate: string, ref = SIM_DATE) {
  return Math.floor((ref.getTime() - new Date(birthDate).getTime()) / 86400000);
}

// ─── Ewe tiers ───────────────────────────────────────────────────────────────

type EweTier = "elite" | "strong" | "average" | "weak";
function founderTier(tagN: number): EweTier {
  if (tagN <= 22) return "elite";
  if (tagN <= 57) return "strong";
  if (tagN <= 87) return "average";
  return "weak";
}
const MERIT: Record<EweTier, number> = { elite: 1.0, strong: 0.55, average: 0.0, weak: -0.65 };

// ─── Rounds ──────────────────────────────────────────────────────────────────

interface RoundDef { key: string; mStart: string; mEnd: string; lStart: string; lEnd: string; lambs: number; rams: number; seasonBonus: number; future?: boolean; }
const ROUNDS: RoundDef[] = [
  { key: "R1", mStart: "2022-10-01", mEnd: "2022-11-11", lStart: "2023-03-01", lEnd: "2023-04-11", lambs: 120, rams: 48, seasonBonus:  1.2 },
  { key: "R2", mStart: "2023-06-01", mEnd: "2023-07-12", lStart: "2023-11-01", lEnd: "2023-12-12", lambs: 140, rams: 56, seasonBonus:  1.2 },
  { key: "R3", mStart: "2024-02-01", mEnd: "2024-03-13", lStart: "2024-07-01", lEnd: "2024-08-13", lambs: 235, rams: 94, seasonBonus:  1.2 },
  { key: "R4", mStart: "2024-10-01", mEnd: "2024-11-11", lStart: "2025-03-01", lEnd: "2025-04-11", lambs: 298, rams: 119, seasonBonus: -0.5 },
  { key: "R5", mStart: "2025-06-01", mEnd: "2025-07-12", lStart: "2025-11-01", lEnd: "2025-12-12", lambs: 535, rams: 214, seasonBonus:  1.2 },
  { key: "R6", mStart: "2026-02-01", mEnd: "2026-03-13", lStart: "2026-07-01", lEnd: "2026-08-13", lambs: 0,   rams: 0,   seasonBonus:  0,   future: true },
];

// ─── Weight formulas ─────────────────────────────────────────────────────────

function birthWeight(isRam: boolean, isRam1: boolean, tier: EweTier, twin: boolean, firstParity: boolean, seed: number) {
  let w = twin ? 3.6 : 4.2;
  w += isRam ? 0.20 : -0.05;
  w += isRam1 ? 0.15 : 0.0;
  w += tier === "elite" ? 0.15 : tier === "strong" ? 0.08 : tier === "average" ? 0.0 : -0.20;
  if (firstParity) w -= 0.15;
  w += det(seed, 7) * 0.5 - 0.25;
  return r1(clamp(w, 2.4, 5.6));
}

function weanWeight(isRam: boolean, isRam1: boolean, tier: EweTier, twin: boolean, seasonBonus: number, age: number, seed: number): number | null {
  if (age < 90) return null;
  const threshold = age >= 120 ? 0.95 : 0.72;
  if (det(seed, 99) > threshold) return null;
  let w = 28;
  w += isRam ? 1.8 : 0.3;
  w += twin ? -1.0 : 2.0;
  w += isRam1 ? 2.4 : 0.6;
  w += MERIT[tier] * 1.8;
  w += seasonBonus;
  w += det(seed, 13) * 3.0 - 1.5;
  return r1(clamp(w, 16, 42));
}

function currentWeight(isRam: boolean, isRam1: boolean, tier: EweTier, age: number, isRetained: boolean, seed: number): string {
  let cw: number;
  if (isRam) {
    if (age > 700) {
      cw = (isRam1 ? 90 : 84) + det(seed, 17) * 6 - 3;
    } else if (isRetained) {
      cw = (isRam1 ? 58 : 52) + Math.min(age / 365 * 7, 18) + det(seed, 17) * 4 - 2;
    } else {
      // marketed/culled at last weighing (~6–8 months old)
      cw = (isRam1 ? 46 : 40) + det(seed, 17) * 4 - 2;
    }
  } else {
    if (age > 700) {
      cw = 52 + MERIT[tier] * 3.5 + det(seed, 17) * 4 - 2;
    } else {
      cw = 32 + MERIT[tier] * 2.5 + Math.min(age / 365 * 10, 18) + det(seed, 17) * 3 - 1.5;
    }
  }
  return String(r1(clamp(cw, 18, 115)));
}

// ─── Main generator ──────────────────────────────────────────────────────────

export function buildBreedLogSimulationDataset(): BreedLogSimulationDataset {
  let nextId = 1, mgId = 1, beId = 1, hrId = 1;
  const yearSeq: Record<number, number> = {};
  const animals: any[] = [];
  const matingGroups: any[] = [];
  const breedingEvents: any[] = [];
  const healthRecords: any[] = [];

  function tag(year: number) {
    yearSeq[year] = (yearSeq[year] ?? 0) + 1;
    return `KW${String(year).slice(2)}${String(yearSeq[year]).padStart(3, "0")}`;
  }

  function addA(p: Record<string, any>): any {
    const a: any = {
      id: nextId++, userId: USER,
      tagId: p.tagId, sex: p.sex,
      rawTag: p.tagId.replace(/^KW/, ""), studPrefix: "KW", name: p.tagId,
      tattooId: null, electronicId: null, breed: "Meatmaster",
      classification: p.classification ?? null,
      status: p.status ?? "active",
      photo: null,
      lambStatus: p.lambStatus ?? "active",
      ramLambClass: p.ramLambClass ?? null,
      ramType: p.ramType ?? null,
      cullConfirmed: p.cullConfirmed ?? false,
      cullDate: null, cullReason: p.cullReason ?? null,
      removalReason: p.removalReason ?? null,
      birthStatus: p.birthStatus ?? "single",
      sireId: p.sireId ?? null, damId: p.damId ?? null,
      externalDamInfo: null, externalSireInfo: null, evaluationDocument: null,
      lambingSeason: p.lambingSeason ?? null,
      animalSource: p.animalSource ?? "born_on_farm",
      environmentGroup: "Veld", managementGroup: "Main",
      birthDate: p.birthDate,
      birthWeight: p.birthWeight ?? null,
      birthWeightEstimated: p.birthWeightEstimated ?? false,
      currentWeight: p.currentWeight ?? null,
      weight100Day: p.weight100Day ?? null,
      weight100DayDate: p.weight100DayDate ?? null,
      weight100DayEstimated: false,
      weight270Day: p.weight270Day ?? null,
      weight270DayDate: p.weight270DayDate ?? null,
      weaningStatus: p.weaningStatus ?? "normal",
      breederName: "Kwantam", ownerName: "Kwantam",
      farmName: "Kwantam Meatmasters", location: "Demo",
      notes: p.notes ?? null,
      createdAt: FOUNDING_DATE, clientId: null, vectorClock: null, lastSyncedAt: null,
    };
    animals.push(a);
    return a;
  }

  // ── Founders ─────────────────────────────────────────────────────────────

  const ram1 = addA({
    tagId: "KW22001", sex: "ram", birthDate: "2022-01-10", animalSource: "bought_in",
    classification: "stud", ramType: "stud_ram", lambStatus: "moved_to_rams",
    birthWeight: 4.8, birthWeightEstimated: true,
    currentWeight: "92.0", weight100Day: 34.5, weight100DayDate: "2022-04-20",
    notes: "Elite stud sire. High growth and high survival progeny line.",
  });

  const ram2 = addA({
    tagId: "KW22002", sex: "ram", birthDate: "2022-01-16", animalSource: "bought_in",
    classification: "stud", ramType: "stud_ram", lambStatus: "moved_to_rams",
    birthWeight: 4.5, birthWeightEstimated: true,
    currentWeight: "89.0", weight100Day: 32.0, weight100DayDate: "2022-04-26",
    notes: "Solid commercial sire. Consistent moderate-performance line.",
  });

  // Map: animalId → EweTier (for dam merit lookup)
  const tierMap = new Map<number, EweTier>();
  const founderEweIds: number[] = [];

  for (let i = 3; i <= 102; i++) {
    const tier = founderTier(i);
    const merit = MERIT[tier];
    const bDay = ((i - 3) % 20) + 1;
    const e = addA({
      tagId: `KW22${String(i).padStart(3, "0")}`,
      sex: "ewe", birthDate: `2022-01-${String(bDay).padStart(2, "0")}`,
      animalSource: "bought_in", classification: "commercial",
      birthWeight: r1(clamp(4.2 + merit * 0.2 + det(i, 3) * 0.6 - 0.3, 3.5, 5.2)),
      birthWeightEstimated: true,
      currentWeight: String(r1(clamp(53 + merit * 3 + det(i, 19) * 4 - 2, 44, 68))),
      weight100Day: r1(clamp(30 + merit * 2 + det(i, 23) * 3 - 1.5, 24, 38)),
      weight100DayDate: `2022-04-${String(bDay).padStart(2, "0")}`,
      notes: `Founder ewe. Tier: ${tier}.`,
    });
    founderEweIds.push(e.id);
    tierMap.set(e.id, tier);
  }

  const breedingEweSet = new Set<number>(founderEweIds);
  const lambedSet = new Set<number>(); // ewes that have lambed at least once
  // Quick lookup: animalId → object (for dams)
  const aById = new Map<number, any>(animals.map(a => [a.id, a]));

  // Track summary data for expectedAnalysisSummary
  const blockedByCapByRound: Record<string, number[]> = {};
  const activeBreedingEwesByRound: Record<string, number> = {};

  // ── Lambing rounds ───────────────────────────────────────────────────────

  for (const r of ROUNDS) {
    const mStart = new Date(r.mStart);
    const lStart = new Date(r.lStart);
    const odd = ["R1", "R3", "R5"].includes(r.key);

    // Eligible ewes: born ≥240 days before mating start
    const elig = [...breedingEweSet].filter(eid => {
      const e = aById.get(eid);
      return e && (mStart.getTime() - new Date(e.birthDate).getTime()) / 86400000 >= 240;
    });

    const gA: number[] = [], gB: number[] = [];
    elig.forEach((eid, i) => (i % 2 === 0 ? gA : gB).push(eid));
    const gASet = new Set(gA);

    const rAId = odd ? ram1.id : ram2.id;
    const rBId = odd ? ram2.id : ram1.id;
    const rAName = odd ? "KW22001" : "KW22002";
    const rBName = odd ? "KW22002" : "KW22001";

    const mgAId = mgId++;
    const mgBId = mgId++;
    matingGroups.push({
      id: mgAId, userId: USER,
      name: `${r.key} — Group A (${rAName})`,
      ramId: rAId, eweIds: gA,
      dateIn: r.mStart, dateOut: r.mEnd,
      lambingSeason: r.key, environmentGroup: "Veld", managementGroup: "Main",
      notes: r.future ? "Round 6 — expected lambing Jul–Aug 2026." : `${r.key} Group A. Lambing from ${r.lStart}.`,
    });
    matingGroups.push({
      id: mgBId, userId: USER,
      name: `${r.key} — Group B (${rBName})`,
      ramId: rBId, eweIds: gB,
      dateIn: r.mStart, dateOut: r.mEnd,
      lambingSeason: r.key, environmentGroup: "Veld", managementGroup: "Main",
      notes: r.future ? "Round 6 — expected lambing Jul–Aug 2026." : `${r.key} Group B. Lambing from ${r.lStart}.`,
    });

    if (r.future) {
      for (const eid of gA) breedingEvents.push({ id: beId++, userId: USER, eweId: eid, ramId: rAId, matingDate: r.mStart, matingType: "natural", lambingDate: null, lambCount: null, notes: "R6 — pregnant/expected. Lambing from July 2026.", matingGroupId: mgAId, clientId: null, vectorClock: null, lastSyncedAt: null });
      for (const eid of gB) breedingEvents.push({ id: beId++, userId: USER, eweId: eid, ramId: rBId, matingDate: r.mStart, matingType: "natural", lambingDate: null, lambCount: null, notes: "R6 — pregnant/expected. Lambing from July 2026.", matingGroupId: mgBId, clientId: null, vectorClock: null, lastSyncedAt: null });
      continue;
    }

    // Track lambCount per ewe and born ewe IDs for replacement selection
    const eweLambCount = new Map<number, number>();
    const eweLambIds: number[] = [];
    const RETAINED = 12;
    let ramIdx = 0;

    for (let i = 0; i < r.lambs; i++) {
      const damId = elig[i % elig.length];
      const isRam1 = gASet.has(damId) ? (rAId === ram1.id) : (rBId === ram1.id);
      const sireId = gASet.has(damId) ? rAId : rBId;
      const isRam = i < r.rams;
      const twin = i % 5 === 0;  // ~20% twins
      const seed = i;

      const dam = aById.get(damId)!;
      const tier = tierMap.get(damId) ?? "average";
      const firstParity = !lambedSet.has(damId);

      const lambYear = lStart.getUTCFullYear();
      const lambDate = fmt(addDays(lStart, i % 41));
      const age = ageAt(lambDate);

      const bw = birthWeight(isRam, isRam1, tier, twin, firstParity, seed);
      const ww = weanWeight(isRam, isRam1, tier, twin, r.seasonBonus, age, seed);
      const wwDate = ww !== null ? fmt(addDays(new Date(lambDate), 90 + (i % 10))) : null;

      const age270 = age >= 270;
      const w270 = age270 ? r1(clamp((ww ?? 28) * 1.6 + (isRam ? 8 : 4) + (isRam1 ? 3 : 0) + MERIT[tier] * 2 + det(seed, 29) * 4 - 2, 22, 72)) : null;
      const w270Date = age270 ? fmt(addDays(new Date(lambDate), 270)) : null;

      const isRetained = isRam && ramIdx < RETAINED;
      if (isRam) ramIdx++;

      let status: "active" | "sold" | "culled" = "active";
      let cullReason: string | null = null;
      let removalReason: string | null = null;
      let lambStatus = "active";

      if (isRam && isRetained) lambStatus = "moved_to_rams";
      if (isRam && !isRetained) {
        // All non-retained ram lambs are marketed or culled after selection
        status = det(seed, 55) < 0.6 ? "sold" : "culled";
        if (status === "culled") cullReason = "Commercial cull: lower growth index from ram-lamb selection.";
        else removalReason = "Marketed ram lamb: not retained for stud/commercial breeding.";
      }

      const cw = currentWeight(isRam, isRam1, tier, age, isRetained, seed);
      const weanSt = det(seed, 77) < 0.04 ? "cull" : det(seed, 77) < 0.18 ? "watch" : "normal";
      const ramClass = isRam ? (isRetained ? (isRam1 && ramIdx <= 5 ? "stud" : "commercial") : "cull") : null;

      const tagId = tag(lambYear);
      const lamb = addA({
        tagId, sex: isRam ? "ram" : "ewe",
        birthDate: lambDate, animalSource: "born_on_farm",
        sireId, damId, birthStatus: twin ? "twin" : "single",
        lambingSeason: r.key,
        birthWeight: bw, birthWeightEstimated: false,
        weight100Day: ww, weight100DayDate: wwDate,
        weight270Day: w270, weight270DayDate: w270Date,
        currentWeight: cw,
        classification: isRam ? null : "commercial",
        status, lambStatus,
        ramLambClass: ramClass,
        ramType: isRam && isRetained ? "commercial_ram" : null,
        weaningStatus: weanSt,
        cullConfirmed: status === "culled",
        cullReason, removalReason,
        notes: (status === "sold" ? removalReason : status === "culled" ? cullReason : null),
      });

      aById.set(lamb.id, lamb);
      lambedSet.add(damId);
      eweLambCount.set(damId, (eweLambCount.get(damId) ?? 0) + 1);
      if (!isRam) eweLambIds.push(lamb.id);
    }

    // Replacement ewe selection (5% culled, rest admitted up to cap 400)
    blockedByCapByRound[r.key] = [];
    const cull5 = Math.round(eweLambIds.length * 0.05);
    for (let i = 0; i < cull5; i++) {
      const e = aById.get(eweLambIds[i])!;
      e.status = "culled"; e.cullConfirmed = true;
      e.cullReason = "Selection removal: does not meet Kwantam replacement criteria.";
      e.notes = e.cullReason;
    }
    for (let i = cull5; i < eweLambIds.length; i++) {
      if (breedingEweSet.size >= 400) {
        const e = aById.get(eweLambIds[i])!;
        blockedByCapByRound[r.key].push(eweLambIds[i]);
        const ageAtSim = (SIM_DATE.getTime() - new Date(e.birthDate).getTime()) / 86400000;
        if (ageAtSim < 300) {
          // Most recent batch — young ewe pending herd admission when a slot opens
          e.classification = "replacement";
          e.notes = "Replacement candidate awaiting herd admission: breeding cap reached.";
        } else if (ageAtSim < 480) {
          // 300-480 days — clearly a sale candidate
          e.classification = "commercial";
          e.notes = "Sale candidate: ewe breeding cap reached.";
        } else {
          // Older — would have been marketed by now
          e.status = "sold";
          e.removalReason = "Marketed ewe: sold at weaner/store sale after cap exclusion.";
          e.notes = e.removalReason;
        }
        continue;
      }
      breedingEweSet.add(eweLambIds[i]);
      const e = aById.get(eweLambIds[i])!;
      e.lambStatus = "moved_to_ewes"; e.classification = "replacement";
      e.notes = "Admitted replacement ewe into breeding herd.";
      // Inherit maternal tier from dam
      const damTier = tierMap.get(e.damId) ?? "average";
      tierMap.set(e.id, damTier);
    }
    activeBreedingEwesByRound[r.key] = breedingEweSet.size;

    // Breeding events with actual lambCount per ewe
    for (const eid of elig) {
      const lc = eweLambCount.get(eid) ?? 0;
      const lambDate = lc > 0 ? fmt(addDays(lStart, eid % 41)) : null;
      const sireId = gASet.has(eid) ? rAId : rBId;
      const bs = lc === 1 ? "single" : lc === 2 ? "twin" : lc > 2 ? "triplet" : null;
      breedingEvents.push({
        id: beId++, userId: USER,
        eweId: eid, ramId: sireId,
        matingDate: r.mStart, matingType: "natural",
        lambingDate: lambDate, lambCount: lc,
        notes: bs ? `${r.key}: ${bs}.` : `${r.key}: ewe joined, no lambing recorded.`,
        matingGroupId: gASet.has(eid) ? mgAId : mgBId,
        clientId: null, vectorClock: null, lastSyncedAt: null,
      });
    }
  }

  // ── Health records (~15% of animals) ─────────────────────────────────────

  const TREATMENTS: [string, string, string][] = [
    ["Pulpy kidney vaccination", "Enterotoxaemia vaccine", "Routine annual vaccination."],
    ["Parasite control — drenching", "Macrocyclic lactone drench", "Strategic drench applied. FAMACHA score 3+."],
    ["Tick treatment", "Acaricide pour-on", "Tick burden observed on skin folds."],
    ["Vaccination booster", "Combined clostridial vaccine", "Booster following initial vaccination."],
    ["Respiratory observation", "Supportive care", "Mild nasal discharge. Monitored, no antibiotic required."],
    ["Pneumonia treatment", "Broad-spectrum antibiotic", "Respiratory distress treated. Recovery confirmed."],
    ["Lamb weakness — assisted lambing", "Colostrum support", "Assisted birth. Colostrum given. Lamb active within 2 hours."],
    ["Abscess treatment", "Iodine flush", "Caseous lymphadenitis lesion identified and treated."],
    ["Foot/hoof treatment", "Zinc sulphate foot bath", "Mild footrot. Foot-bath applied."],
    ["Follow-up: recovered", "None", "Follow-up visit. Animal fully recovered."],
    ["Follow-up: monitor", "None", "Continued monitoring. Condition improving."],
    ["Wound care", "Antiseptic spray", "Shear wound treated. Healed without complication."],
    ["Parasite control — pre-lambing", "Levamisole drench", "Pre-lambing strategic drench applied."],
  ];

  const hrBase = new Date("2023-01-01");
  let hrIdx = 0;
  for (let i = 0; i < animals.length; i++) {
    if (det(i * 7 + 3, 88) > 0.15) continue;
    const t = TREATMENTS[hrIdx % TREATMENTS.length];
    const d = fmt(addDays(hrBase, Math.floor(det(i, hrIdx) * 850)));
    healthRecords.push({
      id: hrId++, userId: USER, animalId: animals[i].id,
      date: d, treatment: t[0], medication: t[1],
      dosage: null, vet: null, withdrawalPeriod: null, notes: t[2],
    });
    hrIdx++;
  }

  // ── Farm settings ─────────────────────────────────────────────────────────

  const farmSettings: FarmSettings = {
    id: 1, userId: USER,
    farmName: "Kwantam Meatmasters", studName: "Kwantam Meatmasters", studPrefix: "KW",
    ownerName: "Demo", ownerEmail: "demo@example.invalid",
    ownerPhone: null, farmAddress: null, farmLocation: "Demo",
    membershipNumber: null, registrationNumber: null,
    logoUrl: null, logoSize: "medium", logoWidth: null, logoHeight: null,
    createdAt: FOUNDING_DATE, updatedAt: SIM_DATE,
  } as FarmSettings;

  return {
    farmMetadata: { studPrefix: "KW", farmName: "Kwantam Meatmasters", mode: "test", userId: USER },
    farmSettings, animals, matingGroups, breedingEvents,
    performanceRecords: [],
    healthRecords,
    expectedAnalysisSummary: {
      totalAnimals: animals.length,
      rounds: ROUNDS.map(r => r.key),
      activeBreedingEwesByRound,
      blockedByCapByRound,
    },
  };
}
