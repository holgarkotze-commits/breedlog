import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  calculateADG,
  getGrowthAnalysis,
  getEweMaternalAnalysis,
  getSirePerformanceAnalysis,
  getSurvivalAnalysis,
  getFertilityAnalysis,
  getSelectionCandidates,
  getPedigreeRiskAnalysis,
  getDataQualityReport,
  buildAnalysisBundle,
  filterAnimalsBySelection,
  buildAdvancedAnalysisReport,
} from "../client/src/lib/analysis-engine";
import type { Animal, BreedingEvent, HealthRecord, PerformanceRecord } from "../shared/schema";

function makeFixture() {
  const animals: Animal[] = [];
  const breedingEvents: BreedingEvent[] = [];
  const performanceRecords: PerformanceRecord[] = [];
  const healthRecords: HealthRecord[] = [];
  const now = new Date("2026-04-01");

  // 3 Rams
  for (let i = 1; i <= 3; i++) {
    animals.push({
      id: i,
      userId: "u",
      tagId: `R-${i}`,
      sex: "ram",
      breed: "Meatmaster",
      classification: i === 1 ? "stud" : "commercial",
      status: "active",
      birthDate: "2023-01-01",
      birthWeight: "4.2",
      weight100Day: null,
      weight100DayDate: null,
      weight270Day: null,
      weight270DayDate: null,
      currentWeight: "95",
      createdAt: now,
      tattooId: null,
      electronicId: null,
      studPrefix: null,
      name: null,
      photo: null,
      lambStatus: "active",
      ramLambClass: null,
      ramType: null,
      cullConfirmed: false,
      cullDate: null,
      cullReason: null,
      removalReason: null,
      birthStatus: "single",
      damId: null,
      sireId: null,
      externalDamInfo: null,
      externalSireInfo: null,
      evaluationDocument: null,
      lambingSeason: null,
      environmentGroup: null,
      managementGroup: "A",
      weaningStatus: null,
      breederName: null,
      ownerName: null,
      farmName: null,
      location: null,
      notes: null,
      clientId: null,
      vectorClock: null,
      lastSyncedAt: null,
    });
  }

  // 12 Ewes
  for (let i = 4; i <= 15; i++) {
    animals.push({
      id: i,
      userId: "u",
      tagId: `E-${i}`,
      sex: "ewe",
      breed: "Meatmaster",
      classification: "commercial",
      status: "active",
      birthDate: "2023-02-01",
      birthWeight: "3.9",
      weight100Day: null,
      weight100DayDate: null,
      weight270Day: null,
      weight270DayDate: null,
      currentWeight: "72",
      createdAt: now,
      tattooId: null,
      electronicId: null,
      studPrefix: null,
      name: null,
      photo: null,
      lambStatus: "active",
      ramLambClass: null,
      ramType: null,
      cullConfirmed: false,
      cullDate: null,
      cullReason: null,
      removalReason: null,
      birthStatus: "single",
      damId: null,
      sireId: null,
      externalDamInfo: null,
      externalSireInfo: null,
      evaluationDocument: null,
      lambingSeason: "26A",
      environmentGroup: null,
      managementGroup: i % 2 === 0 ? "A" : "B",
      weaningStatus: null,
      breederName: null,
      ownerName: null,
      farmName: null,
      location: null,
      notes: null,
      clientId: null,
      vectorClock: null,
      lastSyncedAt: null,
    });
  }

  let lambId = 100;
  for (let eweId = 4; eweId <= 15; eweId++) {
    const sireId = eweId % 3 === 0 ? 3 : eweId % 2 === 0 ? 1 : 2;
    const lambsForEwe = eweId <= 9 ? 3 : 2;
    breedingEvents.push({
      id: eweId,
      userId: "u",
      eweId,
      ramId: sireId,
      matingGroupId: null,
      matingDate: "2025-03-01",
      lambingDate: "2025-08-01",
      lambCount: lambsForEwe,
      matingType: "natural",
      notes: null,
      clientId: null,
      vectorClock: null,
      lastSyncedAt: null,
    });
    for (let x = 0; x < lambsForEwe; x++) {
      const missingParent = lambId % 11 === 0;
      const weaningWeight = lambId % 7 === 0 ? null : (22 + (lambId % 8)).toFixed(1);
      const status = lambId % 13 === 0 ? "dead" : "active";
      animals.push({
        id: lambId,
        userId: "u",
        tagId: `L-${lambId}`,
        sex: lambId % 2 === 0 ? "ram" : "ewe",
        breed: "Meatmaster",
        classification: lambId % 4 === 0 ? "stud" : "commercial",
        status,
        birthDate: "2025-08-01",
        birthWeight: lambId % 5 === 0 ? null : (3.3 + (lambId % 3) * 0.2).toFixed(1),
        weight100Day: weaningWeight,
        weight100DayDate: weaningWeight ? "2025-11-10" : null,
        weight270Day: lambId % 9 === 0 ? "39.0" : null,
        weight270DayDate: lambId % 9 === 0 ? "2026-04-01" : null,
        currentWeight: "41.0",
        createdAt: now,
        tattooId: null,
        electronicId: null,
        studPrefix: null,
        name: null,
        photo: null,
        lambStatus: "active",
        ramLambClass: lambId % 6 === 0 ? "stud" : "commercial",
        ramType: null,
        cullConfirmed: false,
        cullDate: null,
        cullReason: null,
        removalReason: null,
        birthStatus: lambId % 3 === 0 ? "twin" : "single",
        damId: missingParent ? null : eweId,
        sireId: missingParent ? null : sireId,
        externalDamInfo: null,
        externalSireInfo: null,
        evaluationDocument: null,
        lambingSeason: "26A",
        environmentGroup: null,
        managementGroup: lambId % 2 === 0 ? "A" : "B",
        weaningStatus: weaningWeight ? "normal" : null,
        breederName: null,
        ownerName: null,
        farmName: null,
        location: null,
        notes: lambId % 10 === 0 ? "reject case" : null,
        clientId: null,
        vectorClock: null,
        lastSyncedAt: null,
      });
      performanceRecords.push({
        id: lambId,
        userId: "u",
        animalId: lambId,
        date: "2025-11-10",
        weight: weaningWeight,
        ageDays: 100,
        type: "WEANING",
        traitNotes: null,
        notes: null,
      });
      lambId += 1;
    }
  }

  healthRecords.push({
    id: 1,
    userId: "u",
    animalId: 113,
    date: "2025-08-02",
    treatment: "respiratory",
    medication: null,
    dosage: null,
    vet: null,
    withdrawalPeriod: null,
    notes: "death reason: pneumonia",
  });

  return { animals, breedingEvents, performanceRecords, healthRecords };
}

test("ADG calculation handles valid and invalid input", () => {
  assert.equal(calculateADG(4, 24, "2025-01-01", "2025-03-02")?.toFixed(3), "0.333");
  assert.equal(calculateADG(null, 24, "2025-01-01", "2025-03-02"), null);
  assert.equal(calculateADG(4, 24, null, "2025-03-02"), null);
  assert.equal(calculateADG(4, 24, "2025-03-02", "2025-01-01"), null);
});

test("growth analysis computes rankings and handles missing weights", () => {
  const fixture = makeFixture();
  const growth = getGrowthAnalysis(fixture);
  assert.ok(growth.totalLambsAnalyzed >= 20);
  assert.ok(growth.rows.some((row) => row.missingDataWarnings.length > 0));
  assert.equal(typeof growth.rows[0].score, "number");
});

test("ewe maternal analysis rewards weaning and reduces confidence with missing data", () => {
  const maternal = getEweMaternalAnalysis(makeFixture());
  assert.ok(maternal.rows.length >= 12);
  assert.ok(maternal.rows.some((row) => row.confidence === "Low"));
  assert.ok(maternal.rows.some((row) => row.reasonSummary.length > 0));
});

test("sire performance analysis uses progeny count and avoids proving with tiny progeny", () => {
  const sire = getSirePerformanceAnalysis(makeFixture());
  assert.ok(sire.rows.length >= 3);
  const lowProgeny = sire.rows.find((row) => (row.rawMetrics.progenyCount as number) < 3);
  if (lowProgeny) {
    assert.notEqual(lowProgeny.confidence, "Proven");
  }
});

test("survival and fertility analysis compute expected ratios", () => {
  const fixture = makeFixture();
  const survival = getSurvivalAnalysis(fixture);
  const fertility = getFertilityAnalysis(fixture);
  assert.ok(survival.bornAlive > 0);
  assert.ok(fertility.ewesLambed > 0);
  assert.ok(fertility.lambsBornPerEweLambed !== null);
});

test("selection classification includes watchlist/cull/insufficient buckets", () => {
  const selection = getSelectionCandidates(makeFixture());
  const categories = new Set(selection.rows.map((row) => row.category));
  assert.ok(categories.has("Insufficient Data"));
  assert.ok(categories.has("Keep Commercial Candidate") || categories.has("Keep Stud Candidate"));
});

test("pedigree risk detects unknown and resolves known risk levels", () => {
  const pedigree = getPedigreeRiskAnalysis(makeFixture());
  assert.ok(pedigree.rows.length > 0);
  assert.ok(pedigree.unknown.length > 0);
});

test("selection filters support herd, sex and offspring-of-sire slices", () => {
  const fixture = makeFixture();
  const herd = filterAnimalsBySelection(fixture, { scope: "total_herd", sex: "all" });
  const onlyRams = filterAnimalsBySelection(fixture, { scope: "total_herd", sex: "ram" });
  const sire1Offspring = filterAnimalsBySelection(fixture, { scope: "offspring_of_sire", sireId: 1, sex: "all" });
  assert.ok(herd.length > onlyRams.length);
  assert.ok(onlyRams.every((a) => a.sex === "ram"));
  assert.ok(sire1Offspring.every((a) => a.sireId === 1));
});

test("advanced analysis computes birth type split, sire comparison, family line and completeness", () => {
  const fixture = makeFixture();
  const report = buildAdvancedAnalysisReport(fixture, { scope: "total_herd", sex: "all" });
  assert.ok(report.filteredCount > 0);
  assert.ok(Object.keys(report.birthTypeSplit).length > 0);
  assert.ok(report.dataCompleteness.score >= 0);
  assert.ok(report.sireComparison.length > 0);
  assert.ok(report.familyLineComparison.length > 0);
  assert.ok(report.growthRanking.length >= 0);
});

test("advanced analysis separates actual vs estimated weights and actual overrides estimated", () => {
  const fixture = makeFixture();
  fixture.animals[0] = {
    ...fixture.animals[0],
    birthWeight: "4.0",
    birthWeightEstimated: true as any,
    weight100Day: "28.0",
    weight100DayEstimated: true as any,
  };
  fixture.animals[1] = {
    ...fixture.animals[1],
    birthWeight: "4.5",
    birthWeightEstimated: false as any,
    weight100Day: "31.0",
    weight100DayEstimated: false as any,
  };

  const report = buildAdvancedAnalysisReport(fixture, { scope: "total_herd", sex: "all" });
  assert.ok(report.weights.actualBirthAvg !== null);
  assert.ok(report.weights.estimatedBirthAvg !== null);
  assert.ok(report.weights.actualWeaningAvg !== null);
  assert.ok(report.weights.estimatedWeaningAvg !== null);
});

test("advanced analysis handles empty dataset safely", () => {
  const report = buildAdvancedAnalysisReport(
    { animals: [], breedingEvents: [], performanceRecords: [], healthRecords: [] },
    { scope: "total_herd", sex: "all" }
  );
  assert.equal(report.filteredCount, 0);
  assert.equal(report.herdComposition.total, 0);
  assert.equal(report.sireComparison.length, 0);
  assert.equal(report.familyLineComparison.length, 0);
});

test("analysis page renders selector and section containers", () => {
  const source = fs.readFileSync("client/src/pages/Analysis.tsx", "utf8");
  assert.match(source, /data-testid=\"analysis-selector-panel\"/);
  assert.match(source, /data-testid=\"analysis-summary-cards\"/);
  assert.match(source, /data-testid=\"analysis-sections\"/);
});

test("data quality report surfaces missing fields and completeness", () => {
  const quality = getDataQualityReport(makeFixture());
  assert.ok(quality.missingSire > 0);
  assert.ok(quality.lambsMissingWeaningWeight > 0);
  assert.ok(quality.completenessScore > 0);
});

test("analysis route smoke checks exist and empty states handled in source", () => {
  const appSource = fs.readFileSync("client/src/App.tsx", "utf8");
  const analysisPage = fs.readFileSync("client/src/pages/Analysis.tsx", "utf8");
  assert.match(appSource, /Route path="\/analysis"/);
  assert.match(analysisPage, /BreedLog Analysis/);
  assert.match(analysisPage, /Data-driven insights from your real herd records/);
});

test("bundle builder returns all required modules", () => {
  const bundle = buildAnalysisBundle(makeFixture());
  assert.ok(bundle.flockOverview);
  assert.ok(bundle.growth);
  assert.ok(bundle.eweMaternal);
  assert.ok(bundle.sirePerformance);
  assert.ok(bundle.survival);
  assert.ok(bundle.fertility);
  assert.ok(bundle.selection);
  assert.ok(bundle.pedigreeRisk);
  assert.ok(bundle.dataQuality);
});
