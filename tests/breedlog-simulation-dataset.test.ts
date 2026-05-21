import test from "node:test";
import assert from "node:assert/strict";
import { buildBreedLogSimulationDataset } from "../shared/breedlog-simulation";

test("simulation dataset deterministic and kwantam-based", () => {
  const a = buildBreedLogSimulationDataset();
  const b = buildBreedLogSimulationDataset();
  assert.deepEqual(a, b);
  assert.equal(a.farmSettings.studPrefix, "KW");
  assert.ok(a.animals.length > 500);
  assert.ok(a.matingGroups.length >= 6);
  assert.ok(a.breedingEvents.length >= 100);
});
