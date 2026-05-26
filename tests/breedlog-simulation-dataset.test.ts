import test from "node:test";
import assert from "node:assert/strict";
import { buildBreedLogSimulationDataset } from "../shared/breedlog-simulation";

const SIM_DATE = new Date("2026-05-11");
function daysOld(birthDate: string) {
  return Math.floor((SIM_DATE.getTime() - new Date(birthDate).getTime()) / 86400000);
}

let ds: ReturnType<typeof buildBreedLogSimulationDataset>;
let ds2: ReturnType<typeof buildBreedLogSimulationDataset>;

test("simulation dataset: deterministic and fully Kwantam-based", () => {
  ds = buildBreedLogSimulationDataset();
  ds2 = buildBreedLogSimulationDataset();
  // Determinism
  assert.deepEqual(ds, ds2, "Two calls must produce identical datasets");
  assert.equal(ds.farmSettings.studPrefix, "KW");
  assert.equal(ds.farmSettings.farmName, "Kwantam Meatmasters");
});

test("simulation dataset: animal count and source breakdown", () => {
  const a = ds.animals as any[];
  assert.equal(a.length, 1430, "Total animals must be 1430");
  assert.equal(a.filter(x => x.animalSource === "bought_in").length, 102, "102 founders bought_in");
  assert.equal(a.filter(x => x.animalSource === "born_on_farm").length, 1328, "1328 born_on_farm");
  assert.equal(a.filter(x => x.animalSource === "unknown_not_recorded").length, 0, "0 unknown_not_recorded");
});

test("simulation dataset: founder rams KW22001 and KW22002 exist as bought-in rams", () => {
  const a = ds.animals as any[];
  const ram1 = a.find(x => x.tagId === "KW22001");
  const ram2 = a.find(x => x.tagId === "KW22002");
  assert.ok(ram1, "KW22001 must exist");
  assert.ok(ram2, "KW22002 must exist");
  assert.equal(ram1.animalSource, "bought_in");
  assert.equal(ram2.animalSource, "bought_in");
  assert.equal(ram1.sex, "ram");
  assert.equal(ram2.sex, "ram");
  assert.equal(ram1.ramType, "stud_ram");
  assert.equal(ram2.ramType, "stud_ram");
});

test("simulation dataset: exactly 100 founder ewes KW22003–KW22102, all bought-in", () => {
  const a = ds.animals as any[];
  const founderEwes = a.filter(x => x.animalSource === "bought_in" && x.sex === "ewe");
  assert.equal(founderEwes.length, 100, "Exactly 100 founder ewes");
  for (let i = 3; i <= 102; i++) {
    const tag = `KW22${String(i).padStart(3, "0")}`;
    const ewe = founderEwes.find(x => x.tagId === tag);
    assert.ok(ewe, `${tag} must exist`);
    assert.equal(ewe.sex, "ewe");
    assert.equal(ewe.animalSource, "bought_in");
  }
});

test("simulation dataset: no duplicate KW tags", () => {
  const a = ds.animals as any[];
  const tags = a.map(x => x.tagId);
  const unique = new Set(tags);
  assert.equal(unique.size, a.length, "All tagIds must be unique");
});

test("simulation dataset: no born KW26 animals before July 2026", () => {
  const a = ds.animals as any[];
  const kw26 = a.filter(x => x.tagId && x.tagId.startsWith("KW26") && x.animalSource === "born_on_farm");
  assert.equal(kw26.length, 0, "No born KW26 animals (simulation date is 2026-05-11, before July 2026 lambing)");
});

test("simulation dataset: all born-on-farm animals have sireId and damId", () => {
  const a = ds.animals as any[];
  const bof = a.filter(x => x.animalSource === "born_on_farm");
  const missingSire = bof.filter(x => !x.sireId);
  const missingDam = bof.filter(x => !x.damId);
  assert.equal(missingSire.length, 0, "0 born-on-farm animals missing sireId");
  assert.equal(missingDam.length, 0, "0 born-on-farm animals missing damId");
});

test("simulation dataset: parent birth dates are before child birth dates", () => {
  const a = ds.animals as any[];
  const byId = new Map(a.map(x => [x.id, x]));
  let badCount = 0;
  for (const animal of a) {
    if (animal.damId) {
      const dam = byId.get(animal.damId);
      if (dam && new Date(dam.birthDate) >= new Date(animal.birthDate)) badCount++;
    }
    if (animal.sireId) {
      const sire = byId.get(animal.sireId);
      if (sire && new Date(sire.birthDate) >= new Date(animal.birthDate)) badCount++;
    }
  }
  assert.equal(badCount, 0, "All parent birth dates must be before child birth dates");
});

test("simulation dataset: all animals have birth weights", () => {
  const a = ds.animals as any[];
  const missing = a.filter(x => x.birthWeight == null);
  assert.equal(missing.length, 0, "All animals must have birthWeight");
});

test("simulation dataset: all animals have current weights", () => {
  const a = ds.animals as any[];
  const missing = a.filter(x => x.currentWeight == null);
  assert.equal(missing.length, 0, "All animals must have currentWeight");
});

test("simulation dataset: weaning weight coverage meets age thresholds", () => {
  const a = ds.animals as any[];
  const bof = a.filter(x => x.animalSource === "born_on_farm" && x.birthDate);

  // >120 days: at least 92% must have weight100Day
  const over120 = bof.filter(x => daysOld(x.birthDate) >= 120);
  const over120HasWW = over120.filter(x => x.weight100Day != null);
  const over120Coverage = over120HasWW.length / over120.length;
  assert.ok(over120Coverage >= 0.92, `Animals >120 days: ${Math.round(over120Coverage * 100)}% have weaning weight (must be ≥92%)`);

  // 90–120 days: at least 70% must have weight100Day
  const btw90120 = bof.filter(x => daysOld(x.birthDate) >= 90 && daysOld(x.birthDate) < 120);
  if (btw90120.length > 0) {
    const btw90120HasWW = btw90120.filter(x => x.weight100Day != null);
    const btw90120Coverage = btw90120HasWW.length / btw90120.length;
    assert.ok(btw90120Coverage >= 0.70, `Animals 90–120 days: ${Math.round(btw90120Coverage * 100)}% have weaning weight (must be ≥70%)`);
  }
});

test("simulation dataset: KW22001 line avg weaning weight is higher than KW22002 line", () => {
  const a = ds.animals as any[];
  const ram1Id = a.find(x => x.tagId === "KW22001")?.id;
  const ram2Id = a.find(x => x.tagId === "KW22002")?.id;
  const kw1 = a.filter(x => x.sireId === ram1Id && x.weight100Day != null);
  const kw2 = a.filter(x => x.sireId === ram2Id && x.weight100Day != null);
  assert.ok(kw1.length > 50, "KW22001 must have >50 progeny with weaning weights");
  assert.ok(kw2.length > 50, "KW22002 must have >50 progeny with weaning weights");
  const avg1 = kw1.reduce((s: number, x: any) => s + Number(x.weight100Day), 0) / kw1.length;
  const avg2 = kw2.reduce((s: number, x: any) => s + Number(x.weight100Day), 0) / kw2.length;
  assert.ok(avg1 > avg2, `KW22001 line avg wean (${avg1.toFixed(1)}) must be higher than KW22002 line (${avg2.toFixed(1)})`);
  // Spec: net difference should be ~1.8 kg (2.4 - 0.6)
  assert.ok(avg1 - avg2 >= 1.0, `Sire line difference must be ≥1.0 kg (got ${(avg1 - avg2).toFixed(1)} kg)`);
});

test("simulation dataset: elite ewe offspring avg weaning weight higher than weak ewe offspring", () => {
  const a = ds.animals as any[];
  const eliteEweIds = new Set(a.filter(x => x.animalSource === "bought_in" && x.sex === "ewe" && parseInt(x.tagId.slice(4)) <= 22).map(x => x.id));
  const weakEweIds = new Set(a.filter(x => x.animalSource === "bought_in" && x.sex === "ewe" && parseInt(x.tagId.slice(4)) >= 88).map(x => x.id));
  const eliteOff = a.filter(x => eliteEweIds.has(x.damId) && x.weight100Day != null);
  const weakOff = a.filter(x => weakEweIds.has(x.damId) && x.weight100Day != null);
  assert.ok(eliteOff.length > 10, "Elite ewe offspring count must be >10");
  assert.ok(weakOff.length > 10, "Weak ewe offspring count must be >10");
  const avgElite = eliteOff.reduce((s: number, x: any) => s + Number(x.weight100Day), 0) / eliteOff.length;
  const avgWeak = weakOff.reduce((s: number, x: any) => s + Number(x.weight100Day), 0) / weakOff.length;
  assert.ok(avgElite > avgWeak, `Elite offspring avg wean (${avgElite.toFixed(1)}) must exceed weak (${avgWeak.toFixed(1)})`);
});

test("simulation dataset: retained ram candidates average higher weaning weight than culled/marketed", () => {
  const a = ds.animals as any[];
  const retained = a.filter(x => x.sex === "ram" && x.lambStatus === "moved_to_rams" && x.animalSource === "born_on_farm" && x.weight100Day != null);
  const culled = a.filter(x => x.sex === "ram" && x.ramLambClass === "cull" && x.weight100Day != null);
  assert.ok(retained.length > 0, "Retained ram candidates must exist");
  assert.ok(culled.length > 0, "Culled/marketed ram lambs must exist");
  const avgRetained = retained.reduce((s: number, x: any) => s + Number(x.weight100Day), 0) / retained.length;
  const avgCulled = culled.reduce((s: number, x: any) => s + Number(x.weight100Day), 0) / culled.length;
  assert.ok(avgRetained >= avgCulled, `Retained rams avg wean (${avgRetained.toFixed(1)}) must be ≥ culled (${avgCulled.toFixed(1)})`);
});

test("simulation dataset: at least 5 completed breeding rounds and 1 future round", () => {
  const mg = ds.matingGroups as any[];
  const be = ds.breedingEvents as any[];
  // 6 rounds × 2 groups = 12 mating groups
  assert.ok(mg.length >= 12, `matingGroups must be ≥12, got ${mg.length}`);
  // 5 completed rounds have lambCount > 0 on their events
  const completedBE = be.filter(x => x.lambCount != null);
  assert.ok(completedBE.length > 0, "Completed breeding events must exist");
  // R6 (future) events have lambCount null
  const futureBE = be.filter((x: any) => x.lambCount == null);
  assert.ok(futureBE.length > 0, "Future/expected breeding events (R6) must exist with null lambCount");
});

test("simulation dataset: breeding events have actual lamb counts (not all zero)", () => {
  const be = ds.breedingEvents as any[];
  const withLambs = be.filter(x => x.lambCount != null && x.lambCount > 0);
  assert.ok(withLambs.length > 500, `Breeding events with lambCount > 0: ${withLambs.length} (must be >500)`);
  const zeroLambs = be.filter(x => x.lambCount === 0);
  assert.equal(zeroLambs.length, 0, "No breeding events should have lambCount === 0 (use null for expected, >0 for actual)");
});

test("simulation dataset: health records exist and are linked to valid animals", () => {
  const hr = ds.healthRecords as any[];
  const a = ds.animals as any[];
  const animalIds = new Set(a.map(x => x.id));
  // Must have 12–18% coverage
  const minHR = Math.floor(a.length * 0.12);
  const maxHR = Math.ceil(a.length * 0.18);
  assert.ok(hr.length >= minHR, `Health records (${hr.length}) must be ≥ 12% of animals (${minHR})`);
  assert.ok(hr.length <= maxHR, `Health records (${hr.length}) must be ≤ 18% of animals (${maxHR})`);
  // All must link to valid animals
  const invalidLinks = hr.filter(x => !animalIds.has(x.animalId));
  assert.equal(invalidLinks.length, 0, "All health records must link to valid animalIds");
});

test("simulation dataset: 6 mating rounds exist with correct round keys", () => {
  const mg = ds.matingGroups as any[];
  const seasons = new Set(mg.map(x => x.lambingSeason));
  for (const key of ["R1", "R2", "R3", "R4", "R5", "R6"]) {
    assert.ok(seasons.has(key), `Mating group for round ${key} must exist`);
  }
});

test("simulation dataset: all born-on-farm lambs have valid birth weights in spec range", () => {
  const a = ds.animals as any[];
  const bof = a.filter(x => x.animalSource === "born_on_farm");
  for (const lamb of bof) {
    const bw = Number(lamb.birthWeight);
    assert.ok(bw >= 2.4 && bw <= 5.6, `Birth weight ${bw} for ${lamb.tagId} must be 2.4–5.6 kg`);
  }
});

test("simulation dataset: all animals have valid sex values", () => {
  const a = ds.animals as any[];
  for (const animal of a) {
    assert.ok(animal.sex === "ram" || animal.sex === "ewe", `${animal.tagId} must have sex 'ram' or 'ewe', got '${animal.sex}'`);
  }
});
