import test from "node:test";
import assert from "node:assert/strict";
import { getHerdCounts } from "../client/src/lib/herd-counts";
import fs from "node:fs";

test("count helper has non-overlapping herd partitions", () => {
  const animals: any[] = [
    { id: 1, status: "active", birthDate: "2023-01-01", lambStatus: "moved_to_ewes" }, // admitted mature
    { id: 2, status: "active", birthDate: "2026-04-01", lambStatus: "active" }, // non-admitted lamb
    { id: 3, status: "culled", birthDate: "2024-01-01" }, // archive
    { id: 4, status: "sold", birthDate: "2024-01-01" }, // archive + dead/sold
    { id: 5, status: "active", birthDate: "2026-03-20", lambStatus: "moved_to_rams" }, // admitted lamb
  ];
  const c = getHerdCounts(animals as any);
  assert.equal(c.totalFarmRecords, 5);
  assert.equal(c.archiveAnimals, 2);
  assert.equal(c.activeHerdAnimals, 3);
  assert.equal(c.deadOrSoldAnimals, 1);
  assert.equal(c.nonAdmittedLambStageAnimals, 1);
  assert.equal(c.admittedHerdAnimals, 2);
  assert.equal(c.activeHerdAnimals, c.nonAdmittedLambStageAnimals + c.admittedHerdAnimals);
});

test("animals page labels use shared herd count helper outputs", () => {
  const src = fs.readFileSync("client/src/pages/Animals.tsx", "utf8");
  assert.match(src, /const herdCounts = getHerdCounts\(allAnimals \|\| \[\]\)/);
  assert.match(src, /My Herd`\s*:\s*"My Herd"\} \(\{herdCounts\.activeHerdAnimals\}\)/);
  assert.match(src, /title="Total Herd \(Active, excl\. archive\)"/);
  assert.match(src, /count=\{herdCounts\.activeHerdAnimals\}/);
  assert.match(src, /Lamb stage \(not admitted\): \{herdCounts\.nonAdmittedLambStageAnimals\}/);
});
