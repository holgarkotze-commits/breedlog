import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryStorage } from "../server/storage.js";

// ─── Bloodlines CRUD ──────────────────────────────────────────────────────────
const USER = "test-user-genetics";

test("Bloodlines: create and retrieve", async () => {
  const s = new InMemoryStorage();
  const bl = await s.createBloodline(USER, {
    name: "Baksteen",
    type: "foundation_line",
    status: "active",
    evidenceStatus: "proven",
  });
  assert.equal(typeof bl.id, "number");
  assert.equal(bl.name, "Baksteen");
  assert.equal(bl.userId, USER);
  const list = await s.getBloodlines(USER);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "Baksteen");
});

test("Bloodlines: user isolation", async () => {
  const s = new InMemoryStorage();
  await s.createBloodline(USER, { name: "A", type: "unknown", status: "active", evidenceStatus: "unknown" });
  await s.createBloodline("other-user", { name: "B", type: "unknown", status: "active", evidenceStatus: "unknown" });
  const list = await s.getBloodlines(USER);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, "A");
});

test("Bloodlines: update", async () => {
  const s = new InMemoryStorage();
  const bl = await s.createBloodline(USER, { name: "Old", type: "unknown", status: "active", evidenceStatus: "unknown" });
  const updated = await s.updateBloodline(USER, bl.id, { name: "New", evidenceStatus: "proven" });
  assert.equal(updated.name, "New");
  assert.equal(updated.evidenceStatus, "proven");
});

test("Bloodlines: delete", async () => {
  const s = new InMemoryStorage();
  const bl = await s.createBloodline(USER, { name: "ToDelete", type: "unknown", status: "active", evidenceStatus: "unknown" });
  await s.deleteBloodline(USER, bl.id);
  const list = await s.getBloodlines(USER);
  assert.equal(list.length, 0);
});

// ─── Genetic Lines CRUD ───────────────────────────────────────────────────────
test("GeneticLines: create and retrieve", async () => {
  const s = new InMemoryStorage();
  const line = await s.createGeneticLine(USER, {
    lineName: "Maternal Ewe Line",
    lineGoal: "High mothering ability",
    activeStatus: true,
  });
  assert.equal(typeof line.id, "number");
  assert.equal(line.lineName, "Maternal Ewe Line");
  const list = await s.getGeneticLines(USER);
  assert.equal(list.length, 1);
});

test("GeneticLines: update", async () => {
  const s = new InMemoryStorage();
  const line = await s.createGeneticLine(USER, { lineName: "Test", activeStatus: true });
  const updated = await s.updateGeneticLine(USER, line.id, { lineName: "Updated", activeStatus: false });
  assert.equal(updated.lineName, "Updated");
  assert.equal(updated.activeStatus, false);
});

test("GeneticLines: delete", async () => {
  const s = new InMemoryStorage();
  const line = await s.createGeneticLine(USER, { lineName: "ToDelete", activeStatus: true });
  await s.deleteGeneticLine(USER, line.id);
  const list = await s.getGeneticLines(USER);
  assert.equal(list.length, 0);
});

// ─── Animal Bloodline Assignment ──────────────────────────────────────────────
test("AnimalBloodlines: assign and retrieve", async () => {
  const s = new InMemoryStorage();
  const animal = await s.createAnimal(USER, {
    tagId: "T001",
    sex: "ram",
    breed: "Meatmaster",
    status: "active",
    classification: "active",
  });
  const bl = await s.createBloodline(USER, { name: "Rolo", type: "sire_line", status: "active", evidenceStatus: "promising" });
  await s.setAnimalBloodline(USER, { animalId: animal.id, bloodlineId: bl.id, role: "sire_line" });
  const assignments = await s.getAnimalBloodlines(USER, animal.id);
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].bloodlineId, bl.id);
  assert.equal(assignments[0].role, "sire_line");
});

test("AnimalBloodlines: remove assignment", async () => {
  const s = new InMemoryStorage();
  const animal = await s.createAnimal(USER, { tagId: "T002", sex: "ewe", breed: "Meatmaster", status: "active", classification: "active" });
  const bl = await s.createBloodline(USER, { name: "Bosch", type: "dam_line", status: "active", evidenceStatus: "unproven" });
  const row = await s.setAnimalBloodline(USER, { animalId: animal.id, bloodlineId: bl.id, role: "dam_line" });
  await s.removeAnimalBloodline(USER, row.id);
  const assignments = await s.getAnimalBloodlines(USER, animal.id);
  assert.equal(assignments.length, 0);
});

test("AnimalBloodlines: upsert replaces same role", async () => {
  const s = new InMemoryStorage();
  const animal = await s.createAnimal(USER, { tagId: "T003", sex: "ram", breed: "Meatmaster", status: "active", classification: "active" });
  const bl1 = await s.createBloodline(USER, { name: "Nitro", type: "sire_line", status: "active", evidenceStatus: "unknown" });
  const bl2 = await s.createBloodline(USER, { name: "Zelenski", type: "sire_line", status: "active", evidenceStatus: "unknown" });
  await s.setAnimalBloodline(USER, { animalId: animal.id, bloodlineId: bl1.id, role: "sire_line" });
  await s.setAnimalBloodline(USER, { animalId: animal.id, bloodlineId: bl2.id, role: "sire_line" });
  const assignments = await s.getAnimalBloodlines(USER, animal.id);
  const sireAssignments = assignments.filter((a: any) => a.role === "sire_line");
  assert.equal(sireAssignments.length, 1);
  assert.equal(sireAssignments[0].bloodlineId, bl2.id);
});

// ─── Seed Demo Genetics ───────────────────────────────────────────────────────
test("seedGeneticsForUser: seeds correct bloodlines", async () => {
  const s = new InMemoryStorage();
  const names = ["Baksteen", "Bosch", "Zelenski", "Rolo", "Nitro"];
  await s.seedGeneticsForUser(USER, names);
  const list = await s.getBloodlines(USER);
  assert.equal(list.length, 5);
  const seededNames = list.map((b: any) => b.name).sort();
  assert.deepEqual(seededNames, names.slice().sort());
});

test("seedGeneticsForUser: idempotent on second call", async () => {
  const s = new InMemoryStorage();
  await s.seedGeneticsForUser(USER, ["Baksteen", "Rolo"]);
  await s.seedGeneticsForUser(USER, ["Baksteen", "Rolo"]);
  const list = await s.getBloodlines(USER);
  assert.equal(list.length, 2);
});

// ─── Pedigree ancestry ────────────────────────────────────────────────────────
test("Pedigree: parent-offspring relationship is detectable via sireId", async () => {
  const s = new InMemoryStorage();
  const ram = await s.createAnimal(USER, { tagId: "RAM01", sex: "ram", breed: "Meatmaster", status: "active", classification: "active" });
  const ewe = await s.createAnimal(USER, { tagId: "EWE01", sex: "ewe", breed: "Meatmaster", status: "active", classification: "active", sireId: ram.id });
  const animals = await s.getAnimals(USER, {});
  const eweRecord = animals.find((a: any) => a.id === ewe.id)!;
  assert.equal(eweRecord.sireId, ram.id);
});
