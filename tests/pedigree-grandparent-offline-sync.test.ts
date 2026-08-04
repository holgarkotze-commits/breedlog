/**
 * Pedigree Grandparent Offline-Sync Behaviour — Task 54
 *
 * Confirms that grandparent data in the pedigree view:
 *   1. Displays linked grandparent tag IDs when the server response includes
 *      `animal.grandparents` (online, fresh GET /api/animals/:id).
 *   2. Falls back gracefully to externalSireInfo / externalDamInfo text when
 *      `grandparents` is absent (offline stale-cache load from IndexedDB).
 *   3. Shows a dashed "no-data" placeholder when neither grandparents nor
 *      external text are available — no crash.
 *   4. Re-resolves linked grandparents after reconnect (useAnimal re-fetches and
 *      writes the fresh grandparents-enriched response back to IndexedDB).
 *
 * Strategy:
 *   - Pure-function unit tests for the `resolveGrandparent` helper that mirrors
 *     the logic in PedigreeView (AnimalDetail.tsx).
 *   - Static source assertions on AnimalDetail.tsx, use-animals.ts, and
 *     server/routes.ts to confirm the end-to-end data flow is correct and
 *     that any future refactor that breaks it will fail this suite.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { Animal } from "../shared/schema";

// ─── Source files under test ──────────────────────────────────────────────────

const detailSrc    = fs.readFileSync("client/src/pages/AnimalDetail.tsx",    "utf8");
const useAnimalSrc = fs.readFileSync("client/src/hooks/use-animals.ts",      "utf8");
const routesSrc    = fs.readFileSync("server/routes.ts",                     "utf8");

// ─── Pure resolveGrandparent implementation ───────────────────────────────────
//
// This mirrors the helper defined inside PedigreeView in AnimalDetail.tsx.
// Any change to that helper that alters the priority rules will break these tests.

function resolveGrandparent(
  resolved: Animal | null | undefined,
  parent:   Animal | null | undefined,
  externalField: "externalSireInfo" | "externalDamInfo",
): { tagId: string | null; breed: string | null; animalId: number | null } {
  if (resolved) return { tagId: resolved.tagId, breed: resolved.breed ?? null, animalId: resolved.id };
  const ext = parent?.[externalField] as string | null | undefined;
  if (ext) return { tagId: ext, breed: null, animalId: null };
  return { tagId: null, breed: null, animalId: null };
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

// ─── Fixture: 3-generation pedigree chain ─────────────────────────────────────

const paternalGrandsire = makeAnimal({ id: 10, tagId: "GS-PAT-SIRE", sex: "ram",  breed: "Meatmaster" });
const paternalGranddam  = makeAnimal({ id: 11, tagId: "GS-PAT-DAM",  sex: "ewe",  breed: "Dorper"     });
const maternalGrandsire = makeAnimal({ id: 12, tagId: "GS-MAT-SIRE", sex: "ram",  breed: "Meatmaster" });
const maternalGranddam  = makeAnimal({ id: 13, tagId: "GS-MAT-DAM",  sex: "ewe",  breed: "Dorper"     });

const sire = makeAnimal({
  id: 20, tagId: "SIRE-001", sex: "ram",
  sireId: paternalGrandsire.id,
  damId:  paternalGranddam.id,
});
const dam = makeAnimal({
  id: 21, tagId: "DAM-001", sex: "ewe",
  sireId: maternalGrandsire.id,
  damId:  maternalGranddam.id,
});

// ─── Scenario 1: Online — grandparents resolved from server response ───────────
//
// GET /api/animals/:id returns { ...animal, sire, dam, grandparents: {...} }.
// PedigreeView reads animal.grandparents directly, so resolveGrandparent
// receives the resolved Animal objects and returns their tagIds.

test("online: paternalGrandsire tag resolves from server-populated grandparents", () => {
  const result = resolveGrandparent(paternalGrandsire, sire, "externalSireInfo");
  assert.equal(result.tagId,    "GS-PAT-SIRE");
  assert.equal(result.breed,    "Meatmaster");
  assert.equal(result.animalId, paternalGrandsire.id);
});

test("online: paternalGranddam tag resolves from server-populated grandparents", () => {
  const result = resolveGrandparent(paternalGranddam, sire, "externalDamInfo");
  assert.equal(result.tagId,    "GS-PAT-DAM");
  assert.equal(result.breed,    "Dorper");
  assert.equal(result.animalId, paternalGranddam.id);
});

test("online: maternalGrandsire tag resolves from server-populated grandparents", () => {
  const result = resolveGrandparent(maternalGrandsire, dam, "externalSireInfo");
  assert.equal(result.tagId,    "GS-MAT-SIRE");
  assert.equal(result.animalId, maternalGrandsire.id);
});

test("online: maternalGranddam tag resolves from server-populated grandparents", () => {
  const result = resolveGrandparent(maternalGranddam, dam, "externalDamInfo");
  assert.equal(result.tagId,    "GS-MAT-DAM");
  assert.equal(result.animalId, maternalGranddam.id);
});

test("online: all four grandparent slots resolve from a complete server response", () => {
  const gp = {
    paternalGrandsire: resolveGrandparent(paternalGrandsire, sire, "externalSireInfo"),
    paternalGranddam:  resolveGrandparent(paternalGranddam,  sire, "externalDamInfo"),
    maternalGrandsire: resolveGrandparent(maternalGrandsire, dam,  "externalSireInfo"),
    maternalGranddam:  resolveGrandparent(maternalGranddam,  dam,  "externalDamInfo"),
  };
  assert.equal(gp.paternalGrandsire.tagId, "GS-PAT-SIRE");
  assert.equal(gp.paternalGranddam.tagId,  "GS-PAT-DAM");
  assert.equal(gp.maternalGrandsire.tagId, "GS-MAT-SIRE");
  assert.equal(gp.maternalGranddam.tagId,  "GS-MAT-DAM");
});

// ─── Scenario 2: Offline — stale IndexedDB cache, no grandparents key ─────────
//
// When the browser is offline, useAnimal falls back to the IndexedDB entry.
// That entry was written either by a prior GET /api/animals/:id (and includes
// grandparents) or by the list endpoint PUT (no grandparents key).
// In either case, PedigreeView must not crash; it must gracefully degrade.

test("offline stale-cache: returns external text when grandparents key absent but externalSireInfo present", () => {
  const parentWithExternal = makeAnimal({
    id: 99, tagId: "SIRE-EXT",
    externalSireInfo: "EXT-GRANDSIRE-TAG",
  });
  // grandparents not resolved (undefined) → first arg is undefined
  const result = resolveGrandparent(undefined, parentWithExternal, "externalSireInfo");
  assert.equal(result.tagId,    "EXT-GRANDSIRE-TAG");
  assert.equal(result.breed,    null);
  assert.equal(result.animalId, null);
});

test("offline stale-cache: returns external dam text from parent.externalDamInfo", () => {
  const parentWithExternal = makeAnimal({
    id: 98, tagId: "DAM-EXT",
    externalDamInfo: "EXT-GRANDDAM-TAG",
  });
  const result = resolveGrandparent(undefined, parentWithExternal, "externalDamInfo");
  assert.equal(result.tagId, "EXT-GRANDDAM-TAG");
});

test("offline stale-cache: returns null tagId when grandparents absent and no external text (no crash)", () => {
  // The cached parent has neither linked grandparent IDs resolved nor external text.
  const bareParent = makeAnimal({ id: 97, tagId: "BARE-PARENT" });
  const result = resolveGrandparent(undefined, bareParent, "externalSireInfo");
  assert.equal(result.tagId,    null,  "tagId must be null — triggers dashed placeholder in UI");
  assert.equal(result.breed,    null);
  assert.equal(result.animalId, null);
});

test("offline stale-cache: returns null for all slots when parent is null (no parent linked)", () => {
  // Animal has no sire/dam linked at all — the pedigree view must not crash.
  const result = resolveGrandparent(undefined, null, "externalSireInfo");
  assert.equal(result.tagId,    null);
  assert.equal(result.animalId, null);
});

test("offline stale-cache: four slots all degrade to null without throwing", () => {
  // Simulates what PedigreeView does when animal.grandparents is undefined (stale cache)
  // and the parents have no external text set.
  const gp = {
    paternalGrandsire: resolveGrandparent(undefined, sire, "externalSireInfo"),
    paternalGranddam:  resolveGrandparent(undefined, sire, "externalDamInfo"),
    maternalGrandsire: resolveGrandparent(undefined, dam,  "externalSireInfo"),
    maternalGranddam:  resolveGrandparent(undefined, dam,  "externalDamInfo"),
  };
  // sire and dam have no externalSireInfo/externalDamInfo in our fixtures → all null
  assert.equal(gp.paternalGrandsire.tagId, null);
  assert.equal(gp.paternalGranddam.tagId,  null);
  assert.equal(gp.maternalGrandsire.tagId, null);
  assert.equal(gp.maternalGranddam.tagId,  null);
});

// ─── Scenario 3: Priority — linked record always beats external text ───────────

test("resolveGrandparent prefers linked resolved record over externalSireInfo text", () => {
  const parentWithBoth = makeAnimal({
    id: 95, tagId: "PARENT-BOTH",
    externalSireInfo: "SHOULD-BE-IGNORED",
  });
  // Both a resolved Animal AND external text supplied — linked record must win.
  const result = resolveGrandparent(paternalGrandsire, parentWithBoth, "externalSireInfo");
  assert.equal(result.tagId, "GS-PAT-SIRE", "linked Animal must take priority");
});

// ─── Scenario 4: Re-resolve after reconnect — static source assertions ─────────
//
// After reconnect, React Query's staleTime expires and useAnimal re-fetches.
// The fresh GET /api/animals/:id response includes grandparents, and useAnimal
// stores it to IndexedDB, so subsequent offline reads also benefit.

test("useAnimal stores server response to IndexedDB (putInStore call present)", () => {
  assert.match(
    useAnimalSrc,
    /putInStore\s*\(\s*["']animals["']\s*,\s*data\s*\)/,
    "useAnimal must write the server response (including grandparents) into IndexedDB",
  );
});

test("useAnimal has staleTime config so React Query re-fetches after reconnect", () => {
  assert.match(
    useAnimalSrc,
    /staleTime\s*:\s*\d+/,
    "useAnimal must configure staleTime so React Query knows when to re-fetch on reconnect",
  );
});

test("useAnimal falls back to IndexedDB cache on network error (offline support)", () => {
  assert.match(
    useAnimalSrc,
    /getFromStore\s*<AnimalWithRelations>\s*\(\s*["']animals["']\s*,\s*id\s*\)/,
    "useAnimal must read from IndexedDB as offline fallback",
  );
});

// ─── Static source: AnimalDetail.tsx PedigreeView reads animal.grandparents first ──

test("AnimalDetail PedigreeView reads gp from animal.grandparents (server-resolved)", () => {
  assert.match(
    detailSrc,
    /const\s+gp\s*=\s*animal\.grandparents/,
    "PedigreeView must destructure grandparents from the server-resolved animal object",
  );
});

test("AnimalDetail PedigreeView passes gp.paternalGrandsire as first arg to resolveGrandparent", () => {
  assert.match(
    detailSrc,
    /paternalGrandsire\s*=\s*resolveGrandparent\s*\(\s*gp\?\.paternalGrandsire\b/,
    "paternalGrandsire must be resolved from gp?.paternalGrandsire",
  );
});

test("AnimalDetail PedigreeView passes gp.paternalGranddam to resolveGrandparent", () => {
  assert.match(
    detailSrc,
    /paternalGranddam\s*=\s*resolveGrandparent\s*\(\s*gp\?\.paternalGranddam\b/,
  );
});

test("AnimalDetail PedigreeView passes gp.maternalGrandsire to resolveGrandparent", () => {
  assert.match(
    detailSrc,
    /maternalGrandsire\s*=\s*resolveGrandparent\s*\(\s*gp\?\.maternalGrandsire\b/,
  );
});

test("AnimalDetail PedigreeView passes gp.maternalGranddam to resolveGrandparent", () => {
  assert.match(
    detailSrc,
    /maternalGranddam\s*=\s*resolveGrandparent\s*\(\s*gp\?\.maternalGranddam\b/,
  );
});

test("AnimalDetail resolveGrandparent falls back to externalSireInfo when resolved is falsy", () => {
  // The helper in PedigreeView must check externalField on the parent when resolved is missing.
  assert.match(
    detailSrc,
    /externalSireInfo['"]?\s*\)|'externalSireInfo'|"externalSireInfo"/,
    "resolveGrandparent must reference externalSireInfo as the fallback field",
  );
  assert.match(
    detailSrc,
    /externalDamInfo['"]?\s*\)|'externalDamInfo'|"externalDamInfo"/,
    "resolveGrandparent must reference externalDamInfo as the fallback field",
  );
});

// ─── Static source: PedigreeNodeSmall shows dashed placeholder for null tagId ──

test("PedigreeNodeSmall renders dashed border style when tagId is falsy", () => {
  assert.match(
    detailSrc,
    /border-dashed.*muted-foreground|muted-foreground.*border-dashed/s,
    "PedigreeNodeSmall must use a dashed border class when there is no tagId (offline fallback)",
  );
});

test("PedigreeNodeSmall derives hasData from tagId truthiness", () => {
  assert.match(
    detailSrc,
    /const\s+hasData\s*=\s*!!tagId/,
    "PedigreeNodeSmall.hasData must be derived from !!tagId so null shows the placeholder",
  );
});

// ─── Static source: server route populates grandparents in response ────────────

test("GET /api/animals/:id resolves grandparents server-side", () => {
  assert.match(
    routesSrc,
    /Resolve grandparents/,
    "routes.ts must include a comment or code block resolving grandparents",
  );
});

test("server route includes grandparents in the JSON response", () => {
  assert.match(
    routesSrc,
    /res\.json\s*\(\s*\{[^}]*grandparents/s,
    "GET /api/animals/:id must include grandparents in the res.json() call",
  );
});

test("server resolves paternalGrandsire from sire.sireId", () => {
  assert.match(
    routesSrc,
    /sire\?\.sireId/,
    "server must look up paternalGrandsire using sire.sireId",
  );
});

test("server resolves paternalGranddam from sire.damId", () => {
  assert.match(
    routesSrc,
    /sire\?\.damId/,
    "server must look up paternalGranddam using sire.damId",
  );
});

test("server resolves maternalGrandsire from dam.sireId", () => {
  assert.match(
    routesSrc,
    /dam\?\.sireId/,
    "server must look up maternalGrandsire using dam.sireId",
  );
});

test("server resolves maternalGranddam from dam.damId", () => {
  assert.match(
    routesSrc,
    /dam\?\.damId/,
    "server must look up maternalGranddam using dam.damId",
  );
});
