/**
 * Export Scope Tests — Task 43
 *
 * Verifies that each PDF export selector picks exactly the right animals,
 * and that supporting utilities behave correctly.
 *
 * We test the pure selector logic extracted from each export function rather
 * than the React component itself (which opens a print window).
 *
 * Selectors under test:
 *   exportFullHerdPDF  → allAnimals.filter(isActiveAnimal)
 *   exportRamsPDF      → allAnimals.filter(a => sex === "ram" && isActiveAnimal(a))
 *   exportCulledPDF    → allAnimals.filter(a => status === "culled")
 *   exportSoldPDF      → allAnimals.filter(a => status === "sold")
 *
 * Supporting utilities:
 *   getRamProgenyMetrics  — must be consistent between exportRamsPDF and individual animal PDF
 *   sanitizePublicNote    — must strip KWANTAM_SIMULATION_* markers
 */

import test from "node:test";
import assert from "node:assert/strict";
import { isActiveAnimal } from "../client/src/lib/herd-counts";
import { getRamProgenyMetrics } from "../client/src/lib/animal-performance";
import { sanitizePublicNote } from "../client/src/lib/export-template";
import type { Animal, BreedingEvent } from "../shared/schema";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** Minimum Animal shape accepted by the selectors under test. */
function makeAnimal(overrides: Partial<Animal> & { id: number; tagId: string }): Animal {
  return {
    farmId: 1,
    sex: "ewe",
    status: "active",
    birthDate: "2022-01-01",
    lambStatus: "moved_to_ewes",
    name: null,
    breed: null,
    classification: null,
    currentWeight: null,
    birthWeight: null,
    weight100Day: null,
    weight270Day: null,
    weaningStatus: null,
    sireId: null,
    damId: null,
    externalSireInfo: null,
    externalDamInfo: null,
    photoUrl: null,
    electronicId: null,
    notes: null,
    createdAt: new Date("2022-01-01"),
    updatedAt: new Date("2022-01-01"),
    ...overrides,
  } as unknown as Animal;
}

/** Mixed herd: active + sold + culled + deceased rams and ewes. */
const MIXED_HERD: Animal[] = [
  makeAnimal({ id: 1, tagId: "RAM-ACTIVE-1",  sex: "ram",  status: "active",   lambStatus: "moved_to_rams" }),
  makeAnimal({ id: 2, tagId: "RAM-ACTIVE-2",  sex: "ram",  status: "active",   lambStatus: "moved_to_rams" }),
  makeAnimal({ id: 3, tagId: "RAM-SOLD",      sex: "ram",  status: "sold",     lambStatus: "moved_to_rams" }),
  makeAnimal({ id: 4, tagId: "RAM-CULLED",    sex: "ram",  status: "culled",   lambStatus: "moved_to_rams" }),
  makeAnimal({ id: 5, tagId: "RAM-DEAD",      sex: "ram",  status: "dead",     lambStatus: "moved_to_rams" }),
  makeAnimal({ id: 6, tagId: "EWE-ACTIVE-1",  sex: "ewe",  status: "active",   lambStatus: "moved_to_ewes" }),
  makeAnimal({ id: 7, tagId: "EWE-SOLD",      sex: "ewe",  status: "sold",     lambStatus: "moved_to_ewes" }),
  makeAnimal({ id: 8, tagId: "EWE-CULLED",    sex: "ewe",  status: "culled",   lambStatus: "moved_to_ewes" }),
  makeAnimal({ id: 9, tagId: "EWE-DECEASED",  sex: "ewe",  status: "deceased", lambStatus: "moved_to_ewes" }),
  makeAnimal({ id: 10, tagId: "EWE-TRANSFERRED", sex: "ewe", status: "transferred", lambStatus: "moved_to_ewes" }),
  makeAnimal({ id: 11, tagId: "EWE-INACTIVE", sex: "ewe",  status: "inactive", lambStatus: "moved_to_ewes" }),
];

// ─── exportFullHerdPDF scope ──────────────────────────────────────────────────

test("exportFullHerdPDF: only isActiveAnimal() animals are included", () => {
  // This replicates the exact filter used in exportFullHerdPDF:
  //   const activeAnimals = allAnimals.filter(isActiveAnimal);
  const activeAnimals = MIXED_HERD.filter(isActiveAnimal);

  const ids = activeAnimals.map(a => a.tagId);
  assert.ok(ids.includes("RAM-ACTIVE-1"), "active ram 1 must be included");
  assert.ok(ids.includes("RAM-ACTIVE-2"), "active ram 2 must be included");
  assert.ok(ids.includes("EWE-ACTIVE-1"), "active ewe must be included");

  assert.ok(!ids.includes("RAM-SOLD"),       "sold ram must NOT appear in full-herd PDF");
  assert.ok(!ids.includes("RAM-CULLED"),     "culled ram must NOT appear in full-herd PDF");
  assert.ok(!ids.includes("RAM-DEAD"),       "dead ram must NOT appear in full-herd PDF");
  assert.ok(!ids.includes("EWE-SOLD"),       "sold ewe must NOT appear in full-herd PDF");
  assert.ok(!ids.includes("EWE-CULLED"),     "culled ewe must NOT appear in full-herd PDF");
  assert.ok(!ids.includes("EWE-DECEASED"),   "deceased ewe must NOT appear in full-herd PDF");
  assert.ok(!ids.includes("EWE-TRANSFERRED"),"transferred ewe must NOT appear in full-herd PDF");
  assert.ok(!ids.includes("EWE-INACTIVE"),   "inactive ewe must NOT appear in full-herd PDF");

  assert.equal(activeAnimals.length, 3, "exactly 3 active animals in fixture");
});

// ─── exportRamsPDF scope ──────────────────────────────────────────────────────

test("exportRamsPDF: only active rams are included — sold/culled/dead rams excluded", () => {
  // Replicates the exact filter in exportRamsPDF:
  //   const rams = allAnimals.filter(a => a.sex?.toLowerCase() === "ram" && isActiveAnimal(a));
  const rams = MIXED_HERD.filter(
    a => a.sex?.toLowerCase() === "ram" && isActiveAnimal(a)
  );

  const ids = rams.map(a => a.tagId);
  assert.ok(ids.includes("RAM-ACTIVE-1"), "active ram 1 must be included");
  assert.ok(ids.includes("RAM-ACTIVE-2"), "active ram 2 must be included");

  assert.ok(!ids.includes("RAM-SOLD"),   "sold ram must NOT appear in rams register PDF");
  assert.ok(!ids.includes("RAM-CULLED"), "culled ram must NOT appear in rams register PDF");
  assert.ok(!ids.includes("RAM-DEAD"),   "dead ram must NOT appear in rams register PDF");

  // Ewes must never appear in the rams export
  const eweTags = ids.filter(id => id.startsWith("EWE"));
  assert.equal(eweTags.length, 0, "no ewes should appear in rams register PDF");

  assert.equal(rams.length, 2, "exactly 2 active rams in fixture");
});

test("exportRamsPDF: all returned animals pass isActiveAnimal()", () => {
  const rams = MIXED_HERD.filter(
    a => a.sex?.toLowerCase() === "ram" && isActiveAnimal(a)
  );
  for (const ram of rams) {
    assert.ok(isActiveAnimal(ram), `${ram.tagId} passes isActiveAnimal() check`);
  }
});

// ─── exportCulledPDF scope ────────────────────────────────────────────────────

test("exportCulledPDF: only status === 'culled' animals are included", () => {
  // Replicates the exact filter in exportCulledPDF:
  //   const culledAnimals = allAnimals.filter(a => (a.status || '').toLowerCase() === 'culled');
  const culledAnimals = MIXED_HERD.filter(
    a => (a.status || "").toLowerCase() === "culled"
  );

  const ids = culledAnimals.map(a => a.tagId);
  assert.ok(ids.includes("RAM-CULLED"), "culled ram must be included");
  assert.ok(ids.includes("EWE-CULLED"), "culled ewe must be included");

  assert.ok(!ids.includes("RAM-ACTIVE-1"), "active ram must NOT appear in culled PDF");
  assert.ok(!ids.includes("EWE-ACTIVE-1"), "active ewe must NOT appear in culled PDF");
  assert.ok(!ids.includes("RAM-SOLD"),     "sold ram must NOT appear in culled PDF");
  assert.ok(!ids.includes("EWE-SOLD"),     "sold ewe must NOT appear in culled PDF");
  assert.ok(!ids.includes("RAM-DEAD"),     "dead ram must NOT appear in culled PDF");
  assert.ok(!ids.includes("EWE-DECEASED"), "deceased ewe must NOT appear in culled PDF");

  assert.equal(culledAnimals.length, 2, "exactly 2 culled animals in fixture");
});

test("exportCulledPDF: sold and deceased animals are NOT cross-contaminating culled PDF", () => {
  const herd: Animal[] = [
    makeAnimal({ id: 1, tagId: "A-CULLED",   status: "culled",   lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 2, tagId: "A-SOLD",     status: "sold",     lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 3, tagId: "A-DECEASED", status: "deceased", lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 4, tagId: "A-ACTIVE",   status: "active",   lambStatus: "moved_to_ewes" }),
  ];

  const culled = herd.filter(a => (a.status || "").toLowerCase() === "culled");
  assert.equal(culled.length, 1);
  assert.equal(culled[0].tagId, "A-CULLED");
});

// ─── exportSoldPDF scope ──────────────────────────────────────────────────────

test("exportSoldPDF: only status === 'sold' animals are included", () => {
  // Replicates the exact filter in exportSoldPDF:
  //   const soldAnimals = allAnimals.filter(a => (a.status || '').toLowerCase() === 'sold');
  const soldAnimals = MIXED_HERD.filter(
    a => (a.status || "").toLowerCase() === "sold"
  );

  const ids = soldAnimals.map(a => a.tagId);
  assert.ok(ids.includes("RAM-SOLD"), "sold ram must be included");
  assert.ok(ids.includes("EWE-SOLD"), "sold ewe must be included");

  assert.ok(!ids.includes("RAM-ACTIVE-1"), "active ram must NOT appear in sold PDF");
  assert.ok(!ids.includes("EWE-ACTIVE-1"), "active ewe must NOT appear in sold PDF");
  assert.ok(!ids.includes("RAM-CULLED"),   "culled ram must NOT appear in sold PDF");
  assert.ok(!ids.includes("EWE-CULLED"),   "culled ewe must NOT appear in sold PDF");
  assert.ok(!ids.includes("RAM-DEAD"),     "dead ram must NOT appear in sold PDF");
  assert.ok(!ids.includes("EWE-DECEASED"), "deceased ewe must NOT appear in sold PDF");

  assert.equal(soldAnimals.length, 2, "exactly 2 sold animals in fixture");
});

test("exportSoldPDF: culled and deceased animals are NOT cross-contaminating sold PDF", () => {
  const herd: Animal[] = [
    makeAnimal({ id: 1, tagId: "A-SOLD",     status: "sold",     lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 2, tagId: "A-CULLED",   status: "culled",   lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 3, tagId: "A-DECEASED", status: "deceased", lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 4, tagId: "A-ACTIVE",   status: "active",   lambStatus: "moved_to_ewes" }),
  ];

  const sold = herd.filter(a => (a.status || "").toLowerCase() === "sold");
  assert.equal(sold.length, 1);
  assert.equal(sold[0].tagId, "A-SOLD");
});

// ─── Export scope mutual exclusivity ─────────────────────────────────────────

test("active-herd and culled/sold sets are mutually exclusive", () => {
  const active  = MIXED_HERD.filter(isActiveAnimal).map(a => a.tagId);
  const culled  = MIXED_HERD.filter(a => (a.status || "").toLowerCase() === "culled").map(a => a.tagId);
  const sold    = MIXED_HERD.filter(a => (a.status || "").toLowerCase() === "sold").map(a => a.tagId);

  const activeSet = new Set(active);

  for (const id of culled) {
    assert.ok(!activeSet.has(id), `culled animal ${id} must not be in the active set`);
  }
  for (const id of sold) {
    assert.ok(!activeSet.has(id), `sold animal ${id} must not be in the active set`);
  }
});

test("culled and sold sets do not overlap", () => {
  const culled = new Set(
    MIXED_HERD.filter(a => (a.status || "").toLowerCase() === "culled").map(a => a.tagId)
  );
  const sold = MIXED_HERD.filter(a => (a.status || "").toLowerCase() === "sold").map(a => a.tagId);

  for (const id of sold) {
    assert.ok(!culled.has(id), `animal ${id} cannot be in both culled and sold sets`);
  }
});

// ─── getRamProgenyMetrics consistency ────────────────────────────────────────

test("getRamProgenyMetrics: totalProgeny counts all animals with matching sireId", () => {
  const ram = makeAnimal({ id: 10, tagId: "RAM-SIRE", sex: "ram", lambStatus: "moved_to_rams" });

  const progeny: Animal[] = [
    makeAnimal({ id: 20, tagId: "PROG-1", sex: "ewe",  sireId: 10, birthWeight: "4.2", weight100Day: "22", weight270Day: "38", lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 21, tagId: "PROG-2", sex: "ram",  sireId: 10, birthWeight: "4.8", weight100Day: "25", weight270Day: "41", lambStatus: "moved_to_rams" }),
    makeAnimal({ id: 22, tagId: "PROG-3", sex: "ewe",  sireId: 10, birthWeight: "3.9", lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 30, tagId: "UNRELATED", sex: "ewe", sireId: 99, lambStatus: "moved_to_ewes" }),
  ];

  const allAnimals = [ram, ...progeny];
  const breedingEvents: BreedingEvent[] = [];

  const metrics = getRamProgenyMetrics(ram.id, allAnimals, breedingEvents);

  assert.equal(metrics.totalProgeny, 3, "only animals with sireId === ram.id count as progeny");
  assert.equal(metrics.maleProgeny, 1, "one male progeny");
  assert.equal(metrics.femaleProgeny, 2, "two female progeny");
});

test("getRamProgenyMetrics: returns the same value on consecutive calls (deterministic)", () => {
  const ram = makeAnimal({ id: 10, tagId: "RAM-SIRE", sex: "ram", lambStatus: "moved_to_rams" });

  const progeny: Animal[] = [
    makeAnimal({ id: 20, tagId: "P1", sex: "ewe", sireId: 10, birthWeight: "4.0", weight100Day: "20", lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 21, tagId: "P2", sex: "ram", sireId: 10, birthWeight: "5.0", weight100Day: "26", lambStatus: "moved_to_rams" }),
  ];

  const breedingEvents: BreedingEvent[] = [
    { id: 1, farmId: 1, ramId: 10, eweId: 100, matingDate: "2023-01-01", lambingDate: "2023-06-01", lambCount: 1, createdAt: new Date(), updatedAt: new Date() } as unknown as BreedingEvent,
    { id: 2, farmId: 1, ramId: 10, eweId: 101, matingDate: "2023-02-01", lambingDate: "2023-07-01", lambCount: 2, createdAt: new Date(), updatedAt: new Date() } as unknown as BreedingEvent,
  ];

  const allAnimals = [ram, ...progeny];

  const first  = getRamProgenyMetrics(ram.id, allAnimals, breedingEvents);
  const second = getRamProgenyMetrics(ram.id, allAnimals, breedingEvents);

  assert.deepEqual(first, second, "getRamProgenyMetrics must be deterministic");
});

test("getRamProgenyMetrics: avgProgeny100Day matches manual average", () => {
  const ram = makeAnimal({ id: 10, tagId: "RAM-SIRE", sex: "ram", lambStatus: "moved_to_rams" });

  const progeny: Animal[] = [
    makeAnimal({ id: 20, tagId: "P1", sex: "ewe", sireId: 10, weight100Day: "22.0", lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 21, tagId: "P2", sex: "ewe", sireId: 10, weight100Day: "24.0", lambStatus: "moved_to_ewes" }),
    makeAnimal({ id: 22, tagId: "P3", sex: "ewe", sireId: 10, weight100Day: "20.0", lambStatus: "moved_to_ewes" }),
  ];

  const allAnimals = [ram, ...progeny];
  const metrics = getRamProgenyMetrics(ram.id, allAnimals, []);

  // (22 + 24 + 20) / 3 = 22 (rounded to 1 decimal)
  assert.equal(metrics.avgProgeny100Day, 22, "average 100-day weight must equal manual calculation");
});

test("getRamProgenyMetrics: lambingRate is null when matingEvents is zero", () => {
  const ram = makeAnimal({ id: 10, tagId: "RAM-ONLY", sex: "ram", lambStatus: "moved_to_rams" });
  const allAnimals = [ram];
  const metrics = getRamProgenyMetrics(ram.id, allAnimals, []);

  assert.equal(metrics.lambingRate, null, "lambingRate must be null when there are no mating events");
  assert.equal(metrics.matingEvents, 0);
  assert.equal(metrics.totalProgeny, 0);
});

// ─── sanitizePublicNote ───────────────────────────────────────────────────────

test("sanitizePublicNote: strips KWANTAM_SIMULATION_* markers", () => {
  const raw = "Good growth rate. KWANTAM_SIMULATION_2023 Note from farmer.";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("KWANTAM_SIMULATION_"), "KWANTAM_SIMULATION_* must be removed");
  assert.ok(cleaned.includes("Good growth rate."), "genuine user text must be preserved");
  assert.ok(cleaned.includes("Note from farmer."), "trailing user text must be preserved");
});

test("sanitizePublicNote: strips SIMULATION_YYYY_TO_YYYY_VN markers", () => {
  const raw = "Healthy animal. SIMULATION_2022_TO_2023_V1 Vaccinated.";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("SIMULATION_2022_TO_2023_V1"), "SIMULATION year-range marker must be removed");
  assert.ok(cleaned.includes("Healthy animal."), "user prefix must be preserved");
  assert.ok(cleaned.includes("Vaccinated."), "user suffix must be preserved");
});

test("sanitizePublicNote: strips __SEED_ markers", () => {
  const raw = "__SEED_FIELD_TEST_001 Weight recorded at weaning.";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("__SEED_"), "__SEED_ markers must be removed");
  assert.ok(cleaned.includes("Weight recorded at weaning."), "user text must be preserved");
});

test("sanitizePublicNote: strips [DEBUG:...] markers", () => {
  const raw = "Lame on right front leg. [DEBUG: injected by simulation engine]";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("[DEBUG:"), "[DEBUG:...] marker must be removed");
  assert.ok(cleaned.includes("Lame on right front leg."), "user text must be preserved");
});

test("sanitizePublicNote: strips [IMPORT_CONTROL:...] markers", () => {
  const raw = "Purchased at auction. [IMPORT_CONTROL:batch=42]";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("[IMPORT_CONTROL:"), "[IMPORT_CONTROL:...] marker must be removed");
  assert.ok(cleaned.includes("Purchased at auction."), "user text must be preserved");
});

test("sanitizePublicNote: strips __INTERNAL* markers", () => {
  const raw = "Border collie herding injury. __INTERNALFLAG_SKIP_EXPORT";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("__INTERNAL"), "__INTERNAL* marker must be removed");
  assert.ok(cleaned.includes("Border collie herding injury."), "user text must be preserved");
});

test("sanitizePublicNote: preserves a clean genuine note unchanged", () => {
  const genuine = "Excellent temperament. Good conformation score 8/10.";
  const cleaned = sanitizePublicNote(genuine);
  assert.equal(cleaned, genuine, "notes without internal markers must pass through unchanged");
});

test("sanitizePublicNote: returns empty string for null/undefined/empty input", () => {
  assert.equal(sanitizePublicNote(null), "", "null must return empty string");
  assert.equal(sanitizePublicNote(undefined), "", "undefined must return empty string");
  assert.equal(sanitizePublicNote(""), "", "empty string must return empty string");
});

test("sanitizePublicNote: strips multiple marker types from same note", () => {
  const raw = "Dam is healthy. KWANTAM_SIMULATION_PHASE5 [DEBUG: test data] Good weight gain. __SEED_X";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("KWANTAM_SIMULATION_"), "KWANTAM marker removed");
  assert.ok(!cleaned.includes("[DEBUG:"), "DEBUG marker removed");
  assert.ok(!cleaned.includes("__SEED_"), "SEED marker removed");
  assert.ok(cleaned.includes("Dam is healthy."), "user prefix preserved");
  assert.ok(cleaned.includes("Good weight gain."), "user middle text preserved");
});
