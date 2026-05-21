import test from "node:test";
import assert from "node:assert/strict";
import { calculateLambStage } from "../shared/lamb-stage";
import { getHerdCounts } from "../client/src/lib/herd-counts";
import { buildLambBirthRows } from "../client/src/lib/stamboek-export-fields";
import { buildBreedLogAIContext } from "../server/ai/breedlog-ai-context";

const mk = (o:any={}) => ({ id: 1, sex: "ewe", status: "active", ...o }) as any;

test("lamb stage classifications phase23", () => {
  assert.equal(calculateLambStage(mk({ birthDate: "2026-05-15" }), { now: new Date("2026-05-21") }).value, "newborn");
  assert.equal(calculateLambStage(mk({ birthDate: "2026-04-25", tagId: "L1" }), { now: new Date("2026-05-21") }).value, "marked_tagged");
  assert.equal(calculateLambStage(mk({ birthDate: "2026-03-15", tagId: "L2" }), { now: new Date("2026-05-21") }).value, "growing");
  assert.equal(calculateLambStage(mk({ birthDate: "2026-02-01", tagId: "L3" }), { now: new Date("2026-05-21") }).value, "weaning_due");
  assert.equal(calculateLambStage(mk({ birthDate: "2026-02-01", tagId: "L4", weight100Day: "28", weight100DayDate: "2026-05-15" }), { now: new Date("2026-05-21") }).value, "ready_for_herd_admission");
  assert.equal(calculateLambStage(mk({ sex: "ram", birthDate: "2026-02-01", weight100Day: "28", weight100DayDate: "2026-05-15", ramLambClass: "commercial" }), { now: new Date("2026-05-21") }).value, "sale_candidate");
  assert.equal(calculateLambStage(mk({ sex: "ram", birthDate: "2026-02-01", weight100Day: "28", weight100DayDate: "2026-05-15", ramLambClass: "cull" }), { now: new Date("2026-05-21") }).value, "cull_watch");
  assert.equal(calculateLambStage(mk({ birthDate: "2026-02-01", weight100Day: "28", weight100DayDate: "2026-05-15", classification: "stud" }), { now: new Date("2026-05-21") }).value, "ready_for_herd_admission");
  assert.equal(calculateLambStage(mk({ birthDate: "2026-02-01", lambStatus: "moved_to_ewes" }), { now: new Date("2026-05-21") }).value, "admitted_to_herd");
  assert.equal(calculateLambStage(mk({ birthDate: "2026-02-01", lambStatus: "moved_to_rams" }), { now: new Date("2026-05-21") }).value, "admitted_to_herd");
  assert.doesNotThrow(() => calculateLambStage(mk({ birthDate: null })));
  assert.doesNotThrow(() => calculateLambStage(mk({ birthDate: "2026-01-01", weight100Day: null, weight270Day: null })));
  assert.equal(calculateLambStage(mk({ status: "sold", birthDate: "2026-02-01" })).isActiveLambStage, false);
});

test("herd counts and integrations", () => {
  const animals = [
    mk({ id: 1, birthDate: "2026-02-01" }),
    mk({ id: 2, birthDate: "2026-02-01", lambStatus: "moved_to_ewes" }),
    mk({ id: 3, status: "deceased", birthDate: "2026-02-01" }),
  ];
  const c = getHerdCounts(animals as any);
  assert.equal(c.nonAdmittedLambStageAnimals, 1);
  assert.equal(c.admittedHerdAnimals, 1);

  const rows = buildLambBirthRows([animals[0]] as any);
  assert.ok(rows[0]["Lamb stage"]);

  const ctx = buildBreedLogAIContext({ animals: animals as any, breedingEvents: [], performanceRecords: [], healthRecords: [], flockHealthEvents: [], matingGroups: [], farmSettings: undefined, animalId: 1, today: new Date("2026-05-21") });
  assert.ok(ctx.herd.lambStageSummary);
  assert.ok(ctx.selectedAnimal?.lambStage);
});
