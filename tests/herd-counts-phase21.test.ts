import test from "node:test";
import assert from "node:assert/strict";
import { getHerdCounts, isActiveAnimal } from "../client/src/lib/herd-counts";
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

test("isActiveAnimal excludes dead/sold/culled/transferred/inactive animals", () => {
  const base = { birthDate: "2022-01-01", lambStatus: "moved_to_ewes" };
  const active  = { ...base, status: "active" };
  const dead    = { ...base, status: "dead" };
  const deceased = { ...base, status: "deceased" };
  const sold    = { ...base, status: "sold" };
  const culled  = { ...base, status: "culled" };
  const transferred = { ...base, status: "transferred" };
  const inactive = { ...base, status: "inactive" };
  const removed = { ...base, status: "removed" };

  assert.equal(isActiveAnimal(active as any), true, "active should be true");
  assert.equal(isActiveAnimal(dead as any), false, "dead should be false");
  assert.equal(isActiveAnimal(deceased as any), false, "deceased should be false");
  assert.equal(isActiveAnimal(sold as any), false, "sold should be false");
  assert.equal(isActiveAnimal(culled as any), false, "culled should be false");
  assert.equal(isActiveAnimal(transferred as any), false, "transferred should be false");
  assert.equal(isActiveAnimal(inactive as any), false, "inactive should be false");
  assert.equal(isActiveAnimal(removed as any), false, "removed should be false");
});

test("getHerdCounts activeHerdAnimals excludes dead/sold/culled even when not archived", () => {
  const animals: any[] = [
    { id: 1, status: "active", birthDate: "2022-01-01", lambStatus: "moved_to_ewes" },
    { id: 2, status: "dead",   birthDate: "2022-01-01", lambStatus: "moved_to_ewes" },
    { id: 3, status: "sold",   birthDate: "2022-01-01", lambStatus: "moved_to_ewes" },
    { id: 4, status: "culled", birthDate: "2022-01-01", lambStatus: "moved_to_ewes" },
    { id: 5, status: "active", birthDate: "2022-01-01", lambStatus: "moved_to_ewes" },
  ];
  const c = getHerdCounts(animals as any);
  assert.equal(c.activeHerdAnimals, 2, "only status=active animals count as activeHerdAnimals");
  assert.equal(c.totalFarmRecords, 5, "totalFarmRecords includes all animals");
});

test("animals page labels use shared herd count helper outputs", () => {
  const src = fs.readFileSync("client/src/pages/Animals.tsx", "utf8");
  assert.match(src, /const herdCounts = getHerdCounts\(allAnimals \|\| \[\]\)/);
  assert.match(src, /My Herd`\s*:\s*"My Herd"\} \(\{herdCounts\.activeHerdAnimals\}\)/);
  assert.match(src, /title="Total Herd \(Active\)"/);
  assert.match(src, /count=\{herdCounts\.activeHerdAnimals\}/);
  assert.match(src, /Active animals on farm: \{herdCounts\.activeHerdAnimals\}/);
});
