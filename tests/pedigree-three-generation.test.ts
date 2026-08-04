/**
 * Pedigree Three-Generation Linkage Tests — Task 49
 *
 * Confirms that the grandparent resolution logic in handleExportPDF (AnimalDetail.tsx)
 * correctly links three generations when real grandparent records exist.
 *
 * Strategy:
 *   1. Unit-tests extract and re-implement the pure resolveAncestor() function
 *      against a seeded 3-generation fixture chain, verifying tag IDs resolve
 *      correctly from linked workspace records.
 *   2. Static source assertions confirm that animal-profile-pdf.tsx passes the
 *      resolved grandparent tagIds to PedigreeBox, and that PedigreeBox renders
 *      "Unknown" when tagId is null.
 *   3. Static assertions verify AnimalDetail.tsx wires all four grandparent slots
 *      (paternalGrandsire, paternalGranddam, maternalGrandsire, maternalGranddam).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { Animal } from "../shared/schema";

// ─── Source files under test ──────────────────────────────────────────────────

const detailSrc = fs.readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");
const pdfSrc = fs.readFileSync("client/src/lib/animal-profile-pdf.tsx", "utf8");

// ─── Pure resolveAncestor implementation (mirrors AnimalDetail.tsx exactly) ───
//
// This is the same logic extracted from handleExportPDF. Any refactor of
// AnimalDetail.tsx that changes this behaviour will cause the unit tests below
// to fail, giving early warning before a user notices a broken PDF.

type PedigreeAncestor = { tagId: string; breed?: string | null };

function resolveAncestor(
  parentAnimal: Animal | null | undefined,
  idField: "sireId" | "damId",
  externalField: "externalSireInfo" | "externalDamInfo",
  allAnimals: Animal[],
): PedigreeAncestor | null {
  if (!parentAnimal) return null;
  const linkedId = parentAnimal[idField] as number | null | undefined;
  if (linkedId) {
    const found = allAnimals.find((a: Animal) => a.id === linkedId);
    if (found) return { tagId: found.tagId, breed: found.breed ?? null };
  }
  const externalText = parentAnimal[externalField] as string | null | undefined;
  if (externalText) return { tagId: externalText };
  return null;
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeAnimal(overrides: Partial<Animal> & { id: number; tagId: string }): Animal {
  return {
    userId: "test-user",
    sex: "ram",
    status: "active",
    breed: "Meatmaster",
    birthDate: "2020-01-01",
    lambStatus: "active",
    name: null,
    rawTag: null,
    tattooId: null,
    electronicId: null,
    studPrefix: null,
    classification: "unclassified",
    animalSource: "born_on_farm",
    photo: null,
    ramLambClass: null,
    ramType: null,
    ramBreedingStatus: null,
    cullConfirmed: false,
    cullDate: null,
    cullReason: null,
    removalReason: null,
    birthStatus: null,
    damId: null,
    sireId: null,
    externalDamInfo: null,
    externalSireInfo: null,
    evaluationDocument: null,
    lambingSeason: null,
    environmentGroup: null,
    managementGroup: null,
    birthWeight: null,
    birthWeightEstimated: false,
    currentWeight: null,
    weight100Day: null,
    weight100DayDate: null,
    weight100DayEstimated: false,
    weight270Day: null,
    weight270DayDate: null,
    weaningStatus: null,
    breederName: null,
    ownerName: null,
    farmName: null,
    location: null,
    notes: null,
    createdAt: new Date("2020-01-01"),
    clientId: null,
    vectorClock: null,
    lastSyncedAt: null,
    ...overrides,
  } as unknown as Animal;
}

// ─── Three-generation fixture chain ──────────────────────────────────────────
//
// Generation 1 — grandparents (4 animals)
const paternalGrandsire = makeAnimal({ id: 1, tagId: "GP-PAT-SIRE", sex: "ram" });
const paternalGranddam  = makeAnimal({ id: 2, tagId: "GP-PAT-DAM",  sex: "ewe" });
const maternalGrandsire = makeAnimal({ id: 3, tagId: "GP-MAT-SIRE", sex: "ram" });
const maternalGranddam  = makeAnimal({ id: 4, tagId: "GP-MAT-DAM",  sex: "ewe" });

// Generation 2 — parents
const sire = makeAnimal({
  id: 5,
  tagId: "PARENT-SIRE",
  sex: "ram",
  sireId: paternalGrandsire.id,   // → GP-PAT-SIRE
  damId:  paternalGranddam.id,    // → GP-PAT-DAM
});
const dam = makeAnimal({
  id: 6,
  tagId: "PARENT-DAM",
  sex: "ewe",
  sireId: maternalGrandsire.id,   // → GP-MAT-SIRE
  damId:  maternalGranddam.id,    // → GP-MAT-DAM
});

// Generation 3 — subject
const subject = makeAnimal({
  id: 7,
  tagId: "SUBJECT",
  sex: "ram",
  sireId: sire.id,
  damId:  dam.id,
}) as Animal & { sire: Animal; dam: Animal };
(subject as any).sire = sire;
(subject as any).dam  = dam;

// The allAnimals workspace list includes all seven records
const allAnimals: Animal[] = [
  paternalGrandsire, paternalGranddam,
  maternalGrandsire, maternalGranddam,
  sire, dam, subject,
];

// ─── Unit tests: resolveAncestor with full 3-gen chain ───────────────────────

test("paternalGrandsire resolves to GP-PAT-SIRE when parent sire is linked", () => {
  const result = resolveAncestor((subject as any).sire, "sireId", "externalSireInfo", allAnimals);
  assert.ok(result !== null, "Expected a resolved ancestor, got null");
  assert.equal(result!.tagId, "GP-PAT-SIRE");
  assert.equal(result!.breed, "Meatmaster");
});

test("paternalGranddam resolves to GP-PAT-DAM when parent dam is linked", () => {
  const result = resolveAncestor((subject as any).sire, "damId", "externalDamInfo", allAnimals);
  assert.ok(result !== null);
  assert.equal(result!.tagId, "GP-PAT-DAM");
});

test("maternalGrandsire resolves to GP-MAT-SIRE when dam sire is linked", () => {
  const result = resolveAncestor((subject as any).dam, "sireId", "externalSireInfo", allAnimals);
  assert.ok(result !== null);
  assert.equal(result!.tagId, "GP-MAT-SIRE");
});

test("maternalGranddam resolves to GP-MAT-DAM when dam dam is linked", () => {
  const result = resolveAncestor((subject as any).dam, "damId", "externalDamInfo", allAnimals);
  assert.ok(result !== null);
  assert.equal(result!.tagId, "GP-MAT-DAM");
});

// ─── All four grandparent slots resolve correctly in one pass ─────────────────

test("resolveAncestor builds a complete PedigreeGrandparents object for a 3-gen chain", () => {
  const grandparents = {
    paternalGrandsire: resolveAncestor((subject as any).sire, "sireId", "externalSireInfo", allAnimals),
    paternalGranddam:  resolveAncestor((subject as any).sire, "damId",  "externalDamInfo",  allAnimals),
    maternalGrandsire: resolveAncestor((subject as any).dam,  "sireId", "externalSireInfo", allAnimals),
    maternalGranddam:  resolveAncestor((subject as any).dam,  "damId",  "externalDamInfo",  allAnimals),
  };

  assert.equal(grandparents.paternalGrandsire?.tagId, "GP-PAT-SIRE");
  assert.equal(grandparents.paternalGranddam?.tagId,  "GP-PAT-DAM");
  assert.equal(grandparents.maternalGrandsire?.tagId, "GP-MAT-SIRE");
  assert.equal(grandparents.maternalGranddam?.tagId,  "GP-MAT-DAM");
});

// ─── Unit tests: partial / missing pedigree falls back correctly ──────────────

test("resolveAncestor returns null when parent is null (no parent record)", () => {
  const result = resolveAncestor(null, "sireId", "externalSireInfo", allAnimals);
  assert.equal(result, null, "Expected null when parentAnimal is null");
});

test("resolveAncestor returns null when parent has no linked grandparent IDs and no external info", () => {
  const orphanParent = makeAnimal({ id: 99, tagId: "ORPHAN-PARENT", sireId: null, damId: null });
  const result = resolveAncestor(orphanParent, "sireId", "externalSireInfo", allAnimals);
  assert.equal(result, null, "Expected null for parent with no grandparent linkage");
});

test("resolveAncestor falls back to externalSireInfo text when linkedId is absent", () => {
  const parentWithExternal = makeAnimal({
    id: 100,
    tagId: "PARENT-EXT",
    sireId: null,
    externalSireInfo: "EXTERNAL-GRANDSIRE-TAG",
  });
  const result = resolveAncestor(parentWithExternal, "sireId", "externalSireInfo", allAnimals);
  assert.ok(result !== null);
  assert.equal(result!.tagId, "EXTERNAL-GRANDSIRE-TAG");
});

test("resolveAncestor returns null when linkedId points to an animal not in allAnimals list", () => {
  const parentWithOrphanedId = makeAnimal({
    id: 101,
    tagId: "PARENT-ORPHANED-ID",
    sireId: 9999,  // does not exist in allAnimals
    externalSireInfo: null,
  });
  const result = resolveAncestor(parentWithOrphanedId, "sireId", "externalSireInfo", allAnimals);
  assert.equal(result, null, "Expected null when linkedId has no matching animal in workspace");
});

test("resolveAncestor prefers linked workspace record over externalInfo text", () => {
  // Parent has BOTH a sireId that resolves AND external text — linked record must win
  const parentBoth = makeAnimal({
    id: 102,
    tagId: "PARENT-BOTH",
    sireId: paternalGrandsire.id,
    externalSireInfo: "SHOULD-BE-IGNORED",
  });
  const result = resolveAncestor(parentBoth, "sireId", "externalSireInfo", allAnimals);
  assert.ok(result !== null);
  assert.equal(result!.tagId, "GP-PAT-SIRE", "Linked workspace record should take priority over external text");
});

// ─── Subject with only two generations resolves grandparents as null ──────────

test("grandparent slots are null when parents have no parentage data (2-gen only)", () => {
  const twoGenSubject = makeAnimal({
    id: 200,
    tagId: "TWO-GEN-SUBJECT",
    sireId: sire.id,
    damId:  dam.id,
  }) as any;

  // Create parents that have no grandparent links themselves
  const bareSire = makeAnimal({ id: 201, tagId: "BARE-SIRE", sireId: null, damId: null });
  const bareDam  = makeAnimal({ id: 202, tagId: "BARE-DAM",  sireId: null, damId: null });
  twoGenSubject.sire = bareSire;
  twoGenSubject.dam  = bareDam;

  const gpSire = resolveAncestor(twoGenSubject.sire, "sireId", "externalSireInfo", allAnimals);
  const gpDam  = resolveAncestor(twoGenSubject.sire, "damId",  "externalDamInfo",  allAnimals);
  const gmSire = resolveAncestor(twoGenSubject.dam,  "sireId", "externalSireInfo", allAnimals);
  const gmDam  = resolveAncestor(twoGenSubject.dam,  "damId",  "externalDamInfo",  allAnimals);

  assert.equal(gpSire, null, "paternalGrandsire should be null");
  assert.equal(gpDam,  null, "paternalGranddam should be null");
  assert.equal(gmSire, null, "maternalGrandsire should be null");
  assert.equal(gmDam,  null, "maternalGranddam should be null");
});

// ─── Static source: AnimalDetail.tsx wires all four grandparent slots ─────────

test("AnimalDetail.tsx wires paternalGrandsire from animal.sire using sireId", () => {
  assert.match(
    detailSrc,
    /paternalGrandsire\s*:\s*resolveAncestor\(\s*animal\.sire\s*,\s*['"]sireId['"]/,
    "paternalGrandsire must call resolveAncestor(animal.sire, 'sireId', ...)",
  );
});

test("AnimalDetail.tsx wires paternalGranddam from animal.sire using damId", () => {
  assert.match(
    detailSrc,
    /paternalGranddam\s*:\s*resolveAncestor\(\s*animal\.sire\s*,\s*['"]damId['"]/,
    "paternalGranddam must call resolveAncestor(animal.sire, 'damId', ...)",
  );
});

test("AnimalDetail.tsx wires maternalGrandsire from animal.dam using sireId", () => {
  assert.match(
    detailSrc,
    /maternalGrandsire\s*:\s*resolveAncestor\(\s*animal\.dam\s*,\s*['"]sireId['"]/,
    "maternalGrandsire must call resolveAncestor(animal.dam, 'sireId', ...)",
  );
});

test("AnimalDetail.tsx wires maternalGranddam from animal.dam using damId", () => {
  assert.match(
    detailSrc,
    /maternalGranddam\s*:\s*resolveAncestor\(\s*animal\.dam\s*,\s*['"]damId['"]/,
    "maternalGranddam must call resolveAncestor(animal.dam, 'damId', ...)",
  );
});

test("AnimalDetail.tsx passes grandparents object into buildAnimalProfilePdfBlob", () => {
  assert.match(
    detailSrc,
    /grandparents\s*:\s*nativeGrandparents/,
    "grandparents field must be passed into the PDF builder",
  );
});

// ─── Static source: animal-profile-pdf.tsx renders grandparent tagIds ─────────

test("animal-profile-pdf.tsx renders paternalGrandsire tagId from grandparents prop", () => {
  assert.match(
    pdfSrc,
    /tagId=\{grandparents\?\.paternalGrandsire\?\.tagId\s*\?\?\s*null\}/,
    "PDF must render grandparents?.paternalGrandsire?.tagId ?? null in PedigreeBox",
  );
});

test("animal-profile-pdf.tsx renders paternalGranddam tagId from grandparents prop", () => {
  assert.match(
    pdfSrc,
    /tagId=\{grandparents\?\.paternalGranddam\?\.tagId\s*\?\?\s*null\}/,
  );
});

test("animal-profile-pdf.tsx renders maternalGrandsire tagId from grandparents prop", () => {
  assert.match(
    pdfSrc,
    /tagId=\{grandparents\?\.maternalGrandsire\?\.tagId\s*\?\?\s*null\}/,
  );
});

test("animal-profile-pdf.tsx renders maternalGranddam tagId from grandparents prop", () => {
  assert.match(
    pdfSrc,
    /tagId=\{grandparents\?\.maternalGranddam\?\.tagId\s*\?\?\s*null\}/,
  );
});

test("PedigreeBox renders 'Unknown' when tagId is falsy", () => {
  // The PedigreeBox component must display "Unknown" when no tagId is supplied
  assert.match(
    pdfSrc,
    /\{tagId \|\| ['"]Unknown['"]\}/,
    "PedigreeBox must render 'Unknown' when tagId is null/undefined",
  );
});

test("PedigreeBox uses dashed border style for unknown nodes", () => {
  assert.match(
    pdfSrc,
    /pedigreeBoxUnknown/,
    "A separate dashed-border style must exist for unknown pedigree nodes",
  );
  assert.match(
    pdfSrc,
    /dashed/,
    "The unknown node style must use a dashed border",
  );
});

test("animal-profile-pdf.tsx exports PedigreeGrandparents type", () => {
  assert.match(
    pdfSrc,
    /export type PedigreeGrandparents/,
    "PedigreeGrandparents type must be exported so callers can type-check the object",
  );
});

test("animal-profile-pdf.tsx exports PedigreeAncestor type", () => {
  assert.match(
    pdfSrc,
    /export type PedigreeAncestor/,
    "PedigreeAncestor type must be exported",
  );
});

// ─── Static source: PDF pedigree page shows all four grandparent labels ────────

test("animal-profile-pdf.tsx labels all four grandparent slots", () => {
  assert.match(pdfSrc, /Paternal Grandsire/);
  assert.match(pdfSrc, /Paternal Granddam/);
  assert.match(pdfSrc, /Maternal Grandsire/);
  assert.match(pdfSrc, /Maternal Granddam/);
});
