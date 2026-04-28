import test from "node:test";
import assert from "node:assert/strict";
import { buildBreedLogSimulationDataset } from "../shared/breedlog-simulation";
import { buildAdvancedAnalysisReport } from "../client/src/lib/analysis-engine";

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

test("simulation dataset is deterministic and satisfies breeding design constraints", () => {
  const datasetA = buildBreedLogSimulationDataset();
  const datasetB = buildBreedLogSimulationDataset();

  assert.deepEqual(datasetA, datasetB);

  assert.equal(datasetA.farmMetadata.studPrefix, "KW");
  assert.equal(datasetA.farmMetadata.mode, "test");

  assert.equal(datasetA.baseEwes.length, 200);
  assert.equal(datasetA.baseRams.length, 4);

  const brunoDaughters = datasetA.baseEwes.filter((ewe) => ewe.externalSireInfo === "Bruno");
  const bashDaughters = datasetA.baseEwes.filter((ewe) => ewe.externalSireInfo === "Bash");
  assert.equal(brunoDaughters.length, 100);
  assert.equal(bashDaughters.length, 100);

  const eweBirthWeights = datasetA.baseEwes.map((ewe) => Number(ewe.birthWeight));
  const eweWeaningWeights = datasetA.baseEwes.map((ewe) => Number(ewe.weight100Day));
  assert.equal(average(eweBirthWeights), 4.0);
  assert.equal(average(eweWeaningWeights), 31.0);

  assert.equal(datasetA.matingGroups.length, 4);
  for (const group of datasetA.matingGroups) {
    assert.equal(group.eweIds?.length, 50);
  }

  assert.equal(datasetA.matingWindow.startDate, "2024-10-01");
  assert.equal(datasetA.matingWindow.endDate, "2024-11-11");
  assert.equal(datasetA.matingWindow.lambingStartDate, "2025-02-25");
  assert.equal(datasetA.matingWindow.lambingEndDate, "2025-04-07");

  const group1 = datasetA.expectedAnalysisSummary.groupOutcomes.find((group) => group.groupId === 1)!;
  const group2 = datasetA.expectedAnalysisSummary.groupOutcomes.find((group) => group.groupId === 2)!;
  const group3 = datasetA.expectedAnalysisSummary.groupOutcomes.find((group) => group.groupId === 3)!;
  const group4 = datasetA.expectedAnalysisSummary.groupOutcomes.find((group) => group.groupId === 4)!;

  assert.equal(group1.ewesLambed, 50);
  assert.equal(group1.lambsTotal, 59);
  assert.equal(group1.singles, 41);
  assert.equal(group1.twins, 9);

  assert.equal(group2.ewesLambed, 48);
  assert.equal(group2.lambsTotal, 55);
  assert.equal(group2.openEwes, 2);
  assert.equal(group2.singles, 41);
  assert.equal(group2.twins, 7);
  assert.equal(group2.avgBirthWeightKg, 3.2);

  assert.equal(group3.ewesLambed, 49);
  assert.equal(group3.lambsTotal, 66);
  assert.equal(group3.openEwes, 1);
  assert.equal(group3.singles, 32);
  assert.equal(group3.twins, 17);
  assert.ok(Math.abs(group3.avgBirthWeightKg - 4.67) < 0.01);

  assert.equal(group4.ewesLambed, 41);
  assert.equal(group4.lambsTotal, 42);
  assert.equal(group4.openEwes, 9);
  assert.equal(group4.singles, 40);
  assert.equal(group4.twins, 1);

  const minLambDate = datasetA.lambAnimals.reduce((min, lamb) => (lamb.birthDate! < min ? lamb.birthDate! : min), "9999-12-31");
  const maxLambDate = datasetA.lambAnimals.reduce((max, lamb) => (lamb.birthDate! > max ? lamb.birthDate! : max), "0000-01-01");
  assert.equal(minLambDate >= "2025-02-25", true);
  assert.equal(maxLambDate <= "2025-04-07", true);

  const twinLambs = datasetA.lambAnimals.filter((lamb) => lamb.birthStatus === "twin");
  assert.ok(twinLambs.length > 0);
  for (const lamb of twinLambs) {
    assert.match(lamb.notes || "", /twinGroup:TW-G\d-\d{2}/);
  }

  const allTags = datasetA.animals.map((animal) => animal.tagId);
  assert.equal(new Set(allTags).size, allTags.length);
  for (const animal of datasetA.animals) {
    assert.match(animal.tagId, /^KW/);
    assert.ok(!animal.rawTag?.startsWith("KW"));
  }

  const analysis = buildAdvancedAnalysisReport(
    {
      animals: datasetA.animals,
      breedingEvents: datasetA.breedingEvents,
      performanceRecords: datasetA.performanceRecords,
      healthRecords: datasetA.healthRecords,
      today: new Date("2025-06-01"),
    },
    { scope: "total_herd", sex: "all" }
  );

  assert.equal(analysis.herdComposition.total, datasetA.expectedAnalysisSummary.totalAnimals);
  assert.equal(analysis.herdComposition.ewes, datasetA.expectedAnalysisSummary.eweCount);
  assert.equal(analysis.herdComposition.rams, datasetA.expectedAnalysisSummary.ramCount);
  assert.equal(analysis.herdComposition.lambs, datasetA.expectedAnalysisSummary.lambCount);

  const sireComparison = Object.fromEntries(analysis.sireComparison.map((row) => [row.sireTag, row.offspring]));
  assert.equal(sireComparison.KWR1, 59);
  assert.equal(sireComparison.KWR2, 55);
  assert.equal(sireComparison.KWR3, 66);
  assert.equal(sireComparison.KWR4, 42);

  assert.ok((analysis.birthTypeSplit.single || 0) >= 154);
  assert.ok((analysis.birthTypeSplit.twin || 0) >= 68);

  const familyLineRows = Object.fromEntries(analysis.familyLineComparison.map((row) => [row.familyLine, row.animals]));
  assert.ok((familyLineRows.Bruno || 0) > 0);
  assert.ok((familyLineRows.Bash || 0) > 0);

  const minimal = buildAdvancedAnalysisReport(
    {
      animals: [{ ...datasetA.animals[0], birthWeight: null, weight100Day: null, managementGroup: null }],
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      today: new Date("2025-06-01"),
    },
    { scope: "total_herd", sex: "all" }
  );
  assert.equal(minimal.herdComposition.total, 1);
});
