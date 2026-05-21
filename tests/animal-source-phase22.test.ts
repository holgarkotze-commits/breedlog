import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseBreedLogCsvRecords, buildBreedLogCsvRows } from "../shared/import-export";

test("schema defines animal source with safe unknown default", () => {
  const schema = fs.readFileSync("shared/schema.ts", "utf8");
  assert.match(schema, /animalSource:\s*text\("animal_source"\)\.default\("unknown_not_recorded"\)/);
});

test("create/edit UIs expose animal source selector", () => {
  const animals = fs.readFileSync("client/src/pages/Animals.tsx", "utf8");
  const detail = fs.readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");
  assert.match(animals, /name="animalSource"/);
  assert.match(animals, /select-animal-source/);
  assert.match(detail, /select-edit-animal-source/);
});

test("import mapping normalizes source variants and blanks safely", () => {
  const existing: any[] = [];
  const parsed = parseBreedLogCsvRecords([
    { displayTag: "25-001", sex: "ewe", animalSource: "born on farm" },
    { displayTag: "25-002", sex: "ewe", animalSource: "bought" },
    { displayTag: "25-003", sex: "ewe", animalSource: "" },
    { displayTag: "25-004", sex: "ewe", animalSource: "nonsense" },
  ], existing as any);
  assert.equal(parsed.rowsToCreate[0].animalSource, "born_on_farm");
  assert.equal(parsed.rowsToCreate[1].animalSource, "bought_in");
  assert.equal(parsed.rowsToCreate[2].animalSource, "unknown_not_recorded");
  assert.equal(parsed.rowsToCreate[3].animalSource, "unknown_not_recorded");
});

test("export mapping includes animal source and AI context tracks source counts", () => {
  const rows = buildBreedLogCsvRows([
    { id: 1, tagId: "25-001", rawTag: "25-001", studPrefix: null, sex: "ewe", status: "active", classification: "unclassified", animalSource: "born_on_farm" } as any,
  ] as any);
  assert.equal(rows[0].animalSource, "born_on_farm");
  const ai = fs.readFileSync("server/ai/breedlog-ai-context.ts", "utf8");
  assert.match(ai, /sourceBornOnFarm/);
  assert.match(ai, /sourceBoughtIn/);
  assert.match(ai, /sourceUnknown/);
  assert.match(ai, /source:\s*\(a as any\)\.animalSource/);
});
