import test from "node:test";
import assert from "node:assert/strict";
import type { Animal, BreedingEvent, HealthRecord, PerformanceRecord } from "../shared/schema";
import { buildDataInsights, getAvailableSeasons } from "../client/src/lib/data-engine";

const TODAY = new Date("2026-05-06");

function makeAnimal(p: Partial<Animal> & { id: number; tagId: string; sex: string }): Animal {
  return {
    id: p.id,
    userId: p.userId ?? "u1",
    tagId: p.tagId,
    rawTag: null,
    tattooId: null,
    electronicId: null,
    studPrefix: null,
    name: null,
    sex: p.sex,
    breed: "Meatmaster",
    classification: p.classification ?? "unclassified",
    status: p.status ?? "active",
    photo: null,
    lambStatus: "active",
    ramLambClass: null,
    ramType: null,
    cullConfirmed: p.cullConfirmed ?? false,
    cullDate: null,
    cullReason: null,
    removalReason: null,
    birthDate: p.birthDate ?? null,
    birthStatus: p.birthStatus ?? null,
    damId: p.damId ?? null,
    sireId: p.sireId ?? null,
    externalDamInfo: null,
    externalSireInfo: null,
    evaluationDocument: null,
    lambingSeason: p.lambingSeason ?? null,
    environmentGroup: null,
    managementGroup: p.managementGroup ?? null,
    birthWeight: (p.birthWeight as any) ?? null,
    birthWeightEstimated: false,
    currentWeight: (p.currentWeight as any) ?? null,
    weight100Day: (p.weight100Day as any) ?? null,
    weight100DayDate: p.weight100DayDate ?? null,
    weight100DayEstimated: false,
    weight270Day: null,
    weight270DayDate: null,
    weaningStatus: null,
    breederName: null,
    ownerName: null,
    farmName: null,
    location: null,
    notes: null,
    createdAt: null as any,
    clientId: null,
    vectorClock: null,
    lastSyncedAt: null,
  } as Animal;
}

function fixture() {
  // Two adult rams (sires)
  const ramA = makeAnimal({ id: 1, tagId: "RAM-A", sex: "ram", classification: "stud", birthDate: "2022-01-01" });
  const ramB = makeAnimal({ id: 2, tagId: "RAM-B", sex: "ram", classification: "stud", birthDate: "2022-01-01" });

  // Three adult ewes
  const eweA = makeAnimal({ id: 10, tagId: "EWE-A", sex: "ewe", classification: "stud", birthDate: "2022-01-01" });
  const eweB = makeAnimal({ id: 11, tagId: "EWE-B", sex: "ewe", classification: "commercial", birthDate: "2022-01-01" });
  const eweC = makeAnimal({ id: 12, tagId: "EWE-C", sex: "ewe", birthDate: "2022-01-01" });

  // 2024A lambs (older season)
  const lambs2024: Animal[] = [];
  for (let i = 0; i < 4; i++) {
    lambs2024.push(makeAnimal({
      id: 100 + i,
      tagId: `LAMB-24-${i}`,
      sex: i % 2 === 0 ? "ram" : "ewe",
      birthDate: "2025-09-15",
      birthStatus: i < 2 ? "single" : "twin",
      birthWeight: "4.0" as any,
      weight100Day: "20.0" as any,
      weight100DayDate: "2025-12-24",
      currentWeight: "25.0" as any,
      sireId: i < 2 ? ramA.id : ramB.id,
      damId: i < 2 ? eweA.id : eweB.id,
      lambingSeason: "24A",
    }));
  }

  // 2025A lambs (newer season) with HIGHER weaning weights → improving trend
  const lambs2025: Animal[] = [];
  for (let i = 0; i < 4; i++) {
    lambs2025.push(makeAnimal({
      id: 200 + i,
      tagId: `LAMB-25-${i}`,
      sex: i % 2 === 0 ? "ram" : "ewe",
      birthDate: "2026-02-15",
      birthStatus: i < 2 ? "single" : "twin",
      birthWeight: "4.5" as any,
      weight100Day: "26.0" as any,
      weight100DayDate: "2026-05-25",
      currentWeight: "27.0" as any,
      sireId: i < 2 ? ramA.id : ramB.id,
      damId: i < 2 ? eweA.id : eweB.id,
      lambingSeason: "25A",
    }));
  }

  // Eve C: barren ewe, no lambs.
  // One culled animal
  const culled = makeAnimal({ id: 999, tagId: "CULL-1", sex: "ewe", status: "culled", cullConfirmed: true, birthDate: "2020-01-01" });

  const animals = [ramA, ramB, eweA, eweB, eweC, ...lambs2024, ...lambs2025, culled];
  const breedingEvents: BreedingEvent[] = [];
  const perf: PerformanceRecord[] = [];
  const health: HealthRecord[] = [];
  return { animals, breedingEvents, perf, health };
}

test("getAvailableSeasons returns distinct seasons newest-first", () => {
  const { animals } = fixture();
  const seasons = getAvailableSeasons(animals);
  assert.deepEqual(seasons, ["25A", "24A"]);
});

test("herd distribution counts active vs culled and adult vs lamb correctly (no season filter)", () => {
  const { animals, breedingEvents, perf, health } = fixture();
  const insights = buildDataInsights({
    animals, breedingEvents, performanceRecords: perf, healthRecords: health, today: TODAY,
  });
  const d = insights.herdDistribution;
  // 2 rams + 3 ewes + 8 lambs + 1 culled = 14 total
  assert.equal(d.total, 14);
  assert.equal(d.rams, 2);
  assert.equal(d.ewes, 3);
  // 8 lambs minus the 4 from 24A — but at TODAY=2026-05-06 the 24A lambs are 233 days (still ≤365),
  // so all 8 are still lambs.
  assert.equal(d.lambs, 8);
  assert.equal(d.culled, 1);
  assert.ok(d.classification.stud >= 3);
});

test("season filter narrows herd distribution to only that season's animals", () => {
  const { animals, breedingEvents, perf, health } = fixture();
  const insights = buildDataInsights({
    animals, breedingEvents, performanceRecords: perf, healthRecords: health,
    season: "25A", today: TODAY,
  });
  // 25A has 4 lambs only.
  assert.equal(insights.herdDistribution.total, 4);
  assert.equal(insights.herdDistribution.lambs, 4);
  assert.equal(insights.herdDistribution.rams, 0);
  assert.equal(insights.herdDistribution.ewes, 0);
});

test("sire performance leaderboard ranks sires by progeny count and is sufficient when offspring exist", () => {
  const { animals, breedingEvents, perf, health } = fixture();
  const insights = buildDataInsights({
    animals, breedingEvents, performanceRecords: perf, healthRecords: health, today: TODAY,
  });
  const sp = insights.sirePerformance;
  assert.equal(sp.sufficient, true);
  assert.equal(sp.activeSires, 2);
  assert.equal(sp.totalProgeny, 8);
  assert.equal(sp.leaderboard.length, 2);
  // Both sires have 4 progeny each.
  assert.equal(sp.leaderboard[0].offspring, 4);
  assert.equal(sp.leaderboard[1].offspring, 4);
});

test("ewe maternal: barren ewe is detected and twin-bearing count is correct", () => {
  const { animals, breedingEvents, perf, health } = fixture();
  const insights = buildDataInsights({
    animals, breedingEvents, performanceRecords: perf, healthRecords: health, today: TODAY,
  });
  const m = insights.eweMaternal;
  // EWE-A and EWE-B lambed; EWE-C did not.
  assert.equal(m.activeEwes, 3);
  assert.equal(m.ewesLambed, 2);
  assert.equal(m.barren, 1);
  // EWE-B had twins (the 2 lambs with sireB are birthStatus="twin" linked to eweB).
  assert.equal(m.twinBearing, 1);
});

test("lamb growth aggregates compute averages and single vs twin split", () => {
  const { animals, breedingEvents, perf, health } = fixture();
  const insights = buildDataInsights({
    animals, breedingEvents, performanceRecords: perf, healthRecords: health, today: TODAY,
  });
  const g = insights.lambGrowth;
  assert.ok(g.sufficient);
  assert.ok(g.avgBirthWeight !== null && g.avgBirthWeight > 4 && g.avgBirthWeight < 5);
  assert.ok(g.avgWeaningWeight !== null && g.avgWeaningWeight > 20 && g.avgWeaningWeight < 27);
  assert.equal(g.singleVsTwin.single.count, 4);
  assert.equal(g.singleVsTwin.twin.count, 4);
  assert.equal(g.progression.length, 3);
  assert.equal(g.progression[0].stage, "Birth");
});

test("flock direction signal is 'improving' when newer season's weaning weight is materially higher", () => {
  const { animals, breedingEvents, perf, health } = fixture();
  const insights = buildDataInsights({
    animals, breedingEvents, performanceRecords: perf, healthRecords: health, today: TODAY,
  });
  const fd = insights.flockDirection;
  assert.equal(fd.signal, "improving");
  assert.equal(fd.seasons.length, 2);
  assert.ok(fd.deltaWeaningWeightPct !== null && fd.deltaWeaningWeightPct > 5);
});

test("flock direction is 'insufficient' when only one season has data", () => {
  const ram = makeAnimal({ id: 1, tagId: "R", sex: "ram", birthDate: "2022-01-01" });
  const lambs: Animal[] = [];
  for (let i = 0; i < 5; i++) {
    lambs.push(makeAnimal({
      id: 100 + i,
      tagId: `L${i}`,
      sex: "ewe",
      birthDate: "2026-02-01",
      weight100Day: "22" as any,
      weight100DayDate: "2026-05-01",
      lambingSeason: "25A",
    }));
  }
  const insights = buildDataInsights({
    animals: [ram, ...lambs],
    breedingEvents: [], performanceRecords: [], healthRecords: [], today: TODAY,
  });
  assert.equal(insights.flockDirection.signal, "insufficient");
});

test("empty input returns safe values with no NaN and no throws", () => {
  const insights = buildDataInsights({
    animals: [], breedingEvents: [], performanceRecords: [], healthRecords: [], today: TODAY,
  });
  assert.equal(insights.herdDistribution.total, 0);
  assert.equal(insights.sirePerformance.sufficient, false);
  assert.equal(insights.eweMaternal.sufficient, false);
  assert.equal(insights.lambGrowth.sufficient, false);
  assert.equal(insights.flockDirection.signal, "insufficient");
  assert.equal(insights.dataQuality.score, 0);
  assert.equal(insights.availableSeasons.length, 0);
});

test("reproductive efficiency aggregates joined/lambed/groups from breeding events", () => {
  const ewe1 = makeAnimal({ id: 50, tagId: "E1", sex: "ewe", birthDate: "2022-01-01" });
  const ewe2 = makeAnimal({ id: 51, tagId: "E2", sex: "ewe", birthDate: "2022-01-01" });
  const ewe3 = makeAnimal({ id: 52, tagId: "E3", sex: "ewe", birthDate: "2022-01-01" }); // joined, not lambed
  const ram = makeAnimal({ id: 60, tagId: "R1", sex: "ram", birthDate: "2022-01-01" });
  const events: BreedingEvent[] = [
    { id: 1, userId: "u1", eweId: 50, ramId: 60, matingGroupId: 1, matingDate: "2025-08-01", matingType: "natural", lambingDate: "2026-01-10", lambCount: 2, notes: null, clientId: null, vectorClock: null, lastSyncedAt: null } as any,
    { id: 2, userId: "u1", eweId: 51, ramId: 60, matingGroupId: 1, matingDate: "2025-08-05", matingType: "natural", lambingDate: "2026-01-25", lambCount: 1, notes: null, clientId: null, vectorClock: null, lastSyncedAt: null } as any,
    { id: 3, userId: "u1", eweId: 52, ramId: 60, matingGroupId: 2, matingDate: "2025-08-10", matingType: "natural", lambingDate: null, lambCount: null, notes: null, clientId: null, vectorClock: null, lastSyncedAt: null } as any,
  ];
  const insights = buildDataInsights({
    animals: [ewe1, ewe2, ewe3, ram],
    breedingEvents: events,
    performanceRecords: [], healthRecords: [], today: TODAY,
  });
  const r = insights.reproductive;
  assert.equal(r.sufficient, true);
  assert.equal(r.ewesJoined, 3);
  assert.equal(r.ewesLambed, 2);
  assert.equal(r.totalLambsBorn, 3);
  assert.ok(r.lambingRatePct !== null && Math.abs(r.lambingRatePct - 66.67) < 0.1);
  assert.equal(r.groupBreakdown.length, 2);
  assert.equal(r.lambingSpreadDays, 15);
});

test("health overview counts records, mortality, and survival within scope", () => {
  const a1 = makeAnimal({ id: 1, tagId: "A1", sex: "ram", birthDate: "2022-01-01" });
  const a2 = makeAnimal({ id: 2, tagId: "A2", sex: "ewe", birthDate: "2022-01-01", status: "dead" });
  const records: HealthRecord[] = [
    { id: 1, userId: "u1", animalId: 1, date: "2026-04-20", treatment: "Vaccination", medication: null, dosage: null, vet: null, withdrawalPeriod: null, notes: null } as any,
    { id: 2, userId: "u1", animalId: 1, date: "2026-04-22", treatment: "Drench", medication: null, dosage: null, vet: null, withdrawalPeriod: null, notes: null } as any,
    { id: 4, userId: "u1", animalId: 1, date: "2026-04-25", treatment: "Drench", medication: null, dosage: null, vet: null, withdrawalPeriod: null, notes: null } as any,
    { id: 3, userId: "u1", animalId: 99, date: "2026-04-22", treatment: "Drench", medication: null, dosage: null, vet: null, withdrawalPeriod: null, notes: null } as any, // out of scope
  ];
  const insights = buildDataInsights({
    animals: [a1, a2], breedingEvents: [], performanceRecords: [], healthRecords: records, today: TODAY,
  });
  const h = insights.health;
  assert.equal(h.sufficient, true);
  assert.equal(h.totalRecords, 3);
  assert.equal(h.animalsTreated, 1);
  assert.equal(h.recordsLast30Days, 3);
  assert.equal(h.mortalityCount, 1);
  assert.equal(h.survivalPct, 50);
  assert.equal(h.topTreatments[0].name, "Drench");
});

test("reproductive and health are 'insufficient' when no events/records exist", () => {
  const insights = buildDataInsights({
    animals: [], breedingEvents: [], performanceRecords: [], healthRecords: [], today: TODAY,
  });
  assert.equal(insights.reproductive.sufficient, false);
  assert.equal(insights.health.sufficient, false);
});

test("data quality warnings list real missing-field counts", () => {
  const ramOnly = makeAnimal({ id: 1, tagId: "R", sex: "ram" }); // missing birthDate, weights, links
  const insights = buildDataInsights({
    animals: [ramOnly], breedingEvents: [], performanceRecords: [], healthRecords: [], today: TODAY,
  });
  assert.ok(insights.dataQuality.warnings.length > 0);
  assert.match(insights.dataQuality.warnings.join(" "), /birth date/);
});
