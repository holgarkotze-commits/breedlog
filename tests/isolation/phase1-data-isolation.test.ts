import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { InMemoryStorage } from "../../server/storage.ts";
import { MASTER_SIMULATION_ACCESS_CODE, MASTER_SIMULATION_BATCH_MARKER, isMasterSimulationCode } from "../../shared/master-simulation.ts";
import { buildBreedLogSimulationDataset } from "../../shared/breedlog-simulation.ts";

const cleanUser = "phase1-clean-commercial";
const masterUser = "phase1-master-simulation";
const otherUser = "phase1-other-commercial";

function hasSimulationMarker(value: unknown): boolean {
  return JSON.stringify(value).includes(MASTER_SIMULATION_BATCH_MARKER) || JSON.stringify(value).includes("Kwantam");
}

test("ordinary new workspace remains clean and cannot read master simulation records", async () => {
  const storage = new InMemoryStorage();
  const masterAnimal = await storage.createAnimal(masterUser, { tagId: "KW22001", sex: "ewe", notes: MASTER_SIMULATION_BATCH_MARKER } as any);
  await storage.createHealthRecord(masterUser, { animalId: masterAnimal.id, eventDate: "2026-01-01", eventType: "simulation", notes: MASTER_SIMULATION_BATCH_MARKER } as any);
  await storage.createBreedingEvent(masterUser, { eweId: masterAnimal.id, ramId: masterAnimal.id, matingDate: "2026-01-02", matingType: "natural", notes: MASTER_SIMULATION_BATCH_MARKER } as any);

  assert.deepEqual(await storage.getAnimals(cleanUser, {}), []);
  assert.equal(await storage.getAnimal(cleanUser, masterAnimal.id), undefined);
  assert.deepEqual(await storage.getAllHealthRecords(cleanUser), []);
  assert.deepEqual(await storage.getBreedingEvents(cleanUser), []);
  assert.equal((await storage.getAnimals(cleanUser, {})).some(hasSimulationMarker), false);
});

test("normal workspaces cannot read each other's animals by ID and exports are scoped", async () => {
  const storage = new InMemoryStorage();
  const animalA = await storage.createAnimal(cleanUser, { tagId: "A-001", sex: "ewe" } as any);
  await storage.createAnimal(otherUser, { tagId: "B-001", sex: "ram" } as any);
  await storage.createExportedDocument(cleanUser, { fileName: "a.csv", exportType: "csv", category: "herd", subfolder: "herd", recordCount: 1 } as any);
  await storage.createExportedDocument(otherUser, { fileName: "b.csv", exportType: "csv", category: "herd", subfolder: "herd", recordCount: 1 } as any);

  assert.equal(await storage.getAnimal(otherUser, animalA.id), undefined);
  assert.deepEqual((await storage.getAnimals(cleanUser, {})).map(a => a.tagId), ["A-001"]);
  assert.deepEqual((await storage.getAnimals(otherUser, {})).map(a => a.tagId), ["B-001"]);
  assert.deepEqual((await storage.getExportedDocuments(cleanUser, "herd")).map(d => d.fileName), ["a.csv"]);
  assert.deepEqual((await storage.getExportedDocuments(otherUser, "herd")).map(d => d.fileName), ["b.csv"]);
});

test("U2A2ZAVQ is the only master simulation code and dataset is deterministic", () => {
  assert.equal(MASTER_SIMULATION_ACCESS_CODE, "U2A2ZAVQ");
  assert.equal(isMasterSimulationCode("u2a2zavq"), true);
  assert.equal(isMasterSimulationCode("PH1CLEAN"), false);
  const first = buildBreedLogSimulationDataset();
  const second = buildBreedLogSimulationDataset();
  assert.equal(first.animals.length, second.animals.length);
  assert.deepEqual(first.animals.slice(0, 5).map(a => a.tagId), second.animals.slice(0, 5).map(a => a.tagId));
  assert.equal(first.animals.some(a => a.farmName === "Kwantam Meatmasters"), true);
});

test("Phase 1 fixture specification is deterministic and explicitly non-production", () => {
  const fixtures = JSON.parse(fs.readFileSync("tests/fixtures/phase1-fixtures.json", "utf8"));
  assert.equal(fixtures.metadata.nonProduction, true);
  assert.equal(fixtures.metadata.deterministic, true);
  assert.equal(fixtures.fixtures.find((f: any) => f.key === "master-simulation").accessCode, MASTER_SIMULATION_ACCESS_CODE);
  assert.equal(fixtures.fixtures.find((f: any) => f.key === "clean-commercial").expectsKwantamSimulation, false);
});
