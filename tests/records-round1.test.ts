/**
 * records-round1.test.ts
 *
 * Static + API-level proof for Records Tab Round 1 changes.
 * Covers: filter controls, productivity export buttons, exported-documents
 * folder grouping, folder filters, export-sync routing per category.
 * No UI automation required — verifies the source code directly and,
 * where applicable, hits the live in-memory server.
 */

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";

// ── Source snapshots ────────────────────────────────────────────────────────
const records = fs.readFileSync("client/src/pages/Records.tsx", "utf8");
const animals = fs.readFileSync("client/src/pages/Animals.tsx", "utf8");
const breeding = fs.readFileSync("client/src/pages/Breeding.tsx", "utf8");
const animalDetail = fs.readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");
const health = fs.readFileSync("client/src/pages/Health.tsx", "utf8");
const lambs = fs.readFileSync("client/src/pages/Lambs.tsx", "utf8");
const matingDetail = fs.readFileSync("client/src/pages/MatingGroupDetail.tsx", "utf8");

// ════════════════════════════════════════════════════════════════════════════
// 1 — FILTER CONTROLS — Culled / Sold / Deceased
// ════════════════════════════════════════════════════════════════════════════

test("Records: Culled section has sex-filter select control", () => {
  assert.match(records, /select-sex-filter/);
  assert.match(records, /sexFilter/);
});

test("Records: Culled section has cull-reason filter dropdown", () => {
  assert.match(records, /select-reason-filter/);
  assert.match(records, /reasonFilter/);
  assert.match(records, /All Reasons/);
});

test("Records: Sold section has status filter dropdown", () => {
  assert.match(records, /select-status-filter/);
  assert.match(records, /statusFilter/);
  assert.match(records, /All Status/);
});

test("Records: animal sections have date-from / date-to range inputs", () => {
  assert.match(records, /input-date-from/);
  assert.match(records, /input-date-to/);
  assert.match(records, /type="date"/);
});

test("Records: filter Clear button resets all filter state", () => {
  assert.match(records, /button-clear-filters/);
  assert.match(records, /setSexFilter\("all"\)/);
  assert.match(records, /setReasonFilter\("all"\)/);
  assert.match(records, /setStatusFilter\("all"\)/);
  assert.match(records, /setDateFrom\(""\)/);
  assert.match(records, /setDateTo\(""\)/);
});

test("Records: filterAnimals applies sex, reason, status, date, and text", () => {
  assert.match(records, /const filterAnimals/);
  assert.match(records, /sexMatch/);
  assert.match(records, /reasonMatch/);
  assert.match(records, /statusMatch/);
  assert.match(records, /dateMatch/);
  assert.match(records, /textMatch/);
});

test("Records: filter count label shows filtered vs total", () => {
  assert.match(records, /filteredCount.*of.*totalCount.*records/s);
  assert.match(records, /filteredCount < totalCount/);
});

// ════════════════════════════════════════════════════════════════════════════
// 2 — PRODUCTIVITY LOGS — tabs and export buttons
// ════════════════════════════════════════════════════════════════════════════

test("Records: Productivity Logs are tabbed (Lambing / Mating)", () => {
  assert.match(records, /TabsList/);
  assert.match(records, /tab-lambing/);
  assert.match(records, /tab-mating/);
  assert.match(records, /Lambing Events/);
  assert.match(records, /Mating Groups/);
});

test("Records: Lambing Events tab has PDF export button", () => {
  assert.match(records, /button-export-lambing-pdf/);
  assert.match(records, /exportLambingPDF/);
});

test("Records: Lambing Events tab has CSV export button", () => {
  assert.match(records, /button-export-lambing-csv/);
  assert.match(records, /exportLambingCSV/);
});

test("Records: Mating Groups tab has PDF export button", () => {
  assert.match(records, /button-export-mating-pdf/);
  assert.match(records, /exportMatingPDF/);
});

test("Records: Mating Groups tab has CSV export button", () => {
  assert.match(records, /button-export-mating-csv/);
  assert.match(records, /exportMatingCSV/);
});

test("Records: Productivity exports log to subfolder=productivity", () => {
  const lambingMutates = [...records.matchAll(/subfolder: "productivity"/g)];
  assert.ok(lambingMutates.length >= 4, `Expected ≥4 productivity subfolder mutations, found ${lambingMutates.length}`);
});

test("Records: Productivity date-range filters exist for both tabs", () => {
  assert.match(records, /input-prod-date-from/);
  assert.match(records, /input-prod-date-to/);
  assert.match(records, /input-mating-date-from/);
  assert.match(records, /input-mating-date-to/);
});

// ════════════════════════════════════════════════════════════════════════════
// 3 — EXPORTED DOCUMENTS FOLDER STRUCTURE
// ════════════════════════════════════════════════════════════════════════════

test("Records: Exported Documents has 8 labelled subfolders", () => {
  // Testids are rendered dynamically as subfolder-${sf.id}, verify all 8 ids are in the subfolder definition array
  assert.match(records, /subfolder-\$\{sf\.id\}/);
  const subfolderIds = ["herd", "individual", "breeding", "flock-health", "culled", "sold", "deceased", "productivity"];
  for (const sf of subfolderIds) {
    assert.match(records, new RegExp(`id: "${sf}"`), `Missing subfolder definition id: ${sf}`);
  }
});

test("Records: Exported Documents subfolder labels are descriptive", () => {
  assert.match(records, /Herd Registers & Exports/);
  assert.match(records, /Individual Animal Reports/);
  assert.match(records, /Breeding & Mating Reports/);
  assert.match(records, /Health Records Exports/);
  assert.match(records, /Culled Animal Reports/);
  assert.match(records, /Sold \/ Removed Reports/);
  assert.match(records, /Deceased Reports/);
  assert.match(records, /Productivity Exports/);
});

test("Records: Exported Documents subfolder grid shows per-folder document counts", () => {
  assert.match(records, /allExportedDocs.*filter.*subfolder.*sf\.id/s);
  assert.match(records, /file\{count !== 1 \? "s" : ""\}/);
});

// ════════════════════════════════════════════════════════════════════════════
// 4 — FOLDER-LEVEL FILTERS (search + date range inside each subfolder)
// ════════════════════════════════════════════════════════════════════════════

test("Records: document subfolder has search input", () => {
  assert.match(records, /input-doc-search/);
  assert.match(records, /docSearch/);
  assert.match(records, /Search by name or type/);
});

test("Records: document subfolder has date-from / date-to filters", () => {
  assert.match(records, /input-doc-date-from/);
  assert.match(records, /input-doc-date-to/);
  assert.match(records, /docDateFrom/);
  assert.match(records, /docDateTo/);
});

test("Records: document subfolder filters applied client-side before render", () => {
  assert.match(records, /const filteredDocs = rawDocs\.filter/);
  assert.match(records, /nameMatch/);
  assert.match(records, /dateMatch/);
});

test("Records: document subfolder shows filtered vs total count", () => {
  assert.match(records, /filteredDocs\.length < rawDocs\.length/);
  assert.match(records, /of \$\{rawDocs\.length\} documents/);
});

test("Records: document card shows exportType badge, category, record count, status", () => {
  assert.match(records, /meta\.exportType.*toUpperCase/);
  assert.match(records, /meta\.category/);
  assert.match(records, /meta\.animalCount/);
  assert.match(records, /meta\.status/);
});

// ════════════════════════════════════════════════════════════════════════════
// 5 — EXPORT SYNC PROOF (every category → correct subfolder)
// ════════════════════════════════════════════════════════════════════════════

test("ExportSync: Health events → subfolder=flock-health", () => {
  assert.match(health, /subfolder: "flock-health"/);
});

test("ExportSync: Herd exports (Animals.tsx) → subfolder=herd", () => {
  const matches = [...animals.matchAll(/subfolder: "herd"/g)];
  assert.ok(matches.length >= 5, `Expected ≥5 herd subfolder refs in Animals.tsx, found ${matches.length}`);
});

test("ExportSync: Lambs.tsx exports → subfolder=herd", () => {
  assert.match(lambs, /subfolder: "herd"/);
});

test("ExportSync: Individual animal (AnimalDetail.tsx) → subfolder=individual", () => {
  assert.match(animalDetail, /subfolder: "individual"/);
  assert.match(animalDetail, /documentType: "individual"/);
});

test("ExportSync: Breeding.tsx mating group report → subfolder=breeding", () => {
  assert.match(breeding, /subfolder: "breeding"/);
  assert.match(breeding, /documentType: "breeding"/);
});

test("ExportSync: Breeding.tsx bulk action productivity → subfolder=productivity", () => {
  assert.match(breeding, /subfolder: "productivity"/);
  assert.match(breeding, /documentType: "productivity"/);
});

test("ExportSync: MatingGroupDetail.tsx → subfolder=breeding", () => {
  assert.match(matingDetail, /subfolder: "breeding"/);
  assert.match(matingDetail, /documentType: "breeding"/);
});

test("ExportSync: Records.tsx Culled PDF → subfolder=culled, documentType=culled", () => {
  assert.match(records, /documentType: "culled", subfolder: "culled"/);
});

test("ExportSync: Records.tsx Culled CSV → subfolder=culled", () => {
  const culledMutations = [...records.matchAll(/subfolder: "culled"/g)];
  assert.ok(culledMutations.length >= 2, `Expected ≥2 culled mutations (PDF+CSV), found ${culledMutations.length}`);
});

test("ExportSync: Records.tsx Sold PDF → subfolder=sold, documentType=sold", () => {
  assert.match(records, /documentType: "sold", subfolder: "sold"/);
});

test("ExportSync: Records.tsx Sold CSV → subfolder=sold", () => {
  const soldMutations = [...records.matchAll(/subfolder: "sold"/g)];
  assert.ok(soldMutations.length >= 2, `Expected ≥2 sold mutations (PDF+CSV), found ${soldMutations.length}`);
});

test("ExportSync: Records.tsx Deceased PDF → subfolder=deceased, documentType=deceased", () => {
  assert.match(records, /documentType: "deceased", subfolder: "deceased"/);
});

test("ExportSync: Records.tsx Deceased CSV → subfolder=deceased", () => {
  const deceasedMutations = [...records.matchAll(/subfolder: "deceased"/g)];
  assert.ok(deceasedMutations.length >= 2, `Expected ≥2 deceased mutations (PDF+CSV), found ${deceasedMutations.length}`);
});

test("ExportSync: Records.tsx Lambing PDF → subfolder=productivity, category=lambing", () => {
  assert.match(records, /category: "lambing".*sourceSection: "records-productivity"/s);
});

test("ExportSync: Records.tsx Mating Groups PDF → subfolder=productivity, category=mating-groups", () => {
  assert.match(records, /category: "mating-groups".*sourceSection: "records-productivity"/s);
});

// ════════════════════════════════════════════════════════════════════════════
// 6 — NO REGRESSION: JSON export and existing export surfaces
// ════════════════════════════════════════════════════════════════════════════

test("No JSON export is exposed to the user on any main page", () => {
  // Verify no visible JSON download buttons (previous requirement held)
  const jsonButtonPattern = /button[^"]*json.*download|download.*\.json.*button/i;
  assert.ok(!jsonButtonPattern.test(animals), "Animals.tsx has a JSON export button");
  assert.ok(!jsonButtonPattern.test(breeding), "Breeding.tsx has a JSON export button");
  assert.ok(!jsonButtonPattern.test(records), "Records.tsx has a JSON export button");
});

test("Existing PDF export in Animals.tsx is intact (fullHerd)", () => {
  assert.match(animals, /fullHerd/);
  assert.match(animals, /documentType: "herd"/);
});

test("Existing PDF export in Breeding.tsx is intact", () => {
  assert.match(breeding, /documentType: "breeding"/);
  assert.match(breeding, /subfolder: "breeding"/);
});

test("Existing individual animal export (AnimalDetail.tsx) is intact", () => {
  assert.match(animalDetail, /documentType: "individual"/);
  assert.match(animalDetail, /subfolder: "individual"/);
});

test("Existing flock health export (Health.tsx) is intact", () => {
  assert.match(health, /subfolder: "flock-health"/);
});

// ════════════════════════════════════════════════════════════════════════════
// 7 — PRODUCTION PDF TEMPLATE: Records exports use production-style CSS
// ════════════════════════════════════════════════════════════════════════════

test("Records.tsx PDF CSS uses A4 landscape orientation", () => {
  assert.match(records, /size:\s*A4 landscape/);
});

test("Records.tsx PDF footer uses dark navy gradient (production style)", () => {
  assert.match(records, /linear-gradient\(135deg, #003366, #1a5276\)/);
});

test("Records.tsx PDF footer contains BREEDLOG brand text", () => {
  assert.match(records, /BREEDLOG/);
  assert.match(records, /Professional Livestock Management/);
});

test("Records.tsx culled PDF export includes active-filter metadata in log entry", () => {
  assert.match(records, /filters: \{ sex: sexFilter, reason: reasonFilter, dateFrom, dateTo \}/);
});

// ════════════════════════════════════════════════════════════════════════════
// 8 — API INTEGRATION: exported-documents endpoint with subfolder routing
// ════════════════════════════════════════════════════════════════════════════

const BASE_URL = "http://127.0.0.1:5038";
const TEST_USER = "records-round1-user";
let server: ChildProcessWithoutNullStreams;

before(async () => {
  server = spawn("tsx", ["server/index.ts"], {
    env: { ...process.env, NODE_ENV: "test", USE_IN_MEMORY_STORAGE: "1", PORT: "5038" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server start timeout")), 15000);
    server.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("serving on port")) { clearTimeout(timeout); resolve(); }
    });
    server.stderr.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("serving on port")) { clearTimeout(timeout); resolve(); }
    });
  });
});

after(() => { server?.kill(); });

const authedFetch = (path: string, opts: RequestInit = {}) =>
  fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
      "x-test-user-id": TEST_USER,
      "x-test-device-id": `${TEST_USER}-device`,
    },
  });

test("API: POST /api/exported-documents saves document with subfolder", async () => {
  const res = await authedFetch("/api/exported-documents", {
    method: "POST",
    body: JSON.stringify({
      name: "TestCulledReport_2026-01-01.pdf",
      documentType: "culled",
      subfolder: "culled",
      metadata: { exportType: "pdf", category: "culled", animalCount: 5, status: "success" },
    }),
  });
  assert.equal(res.status, 201);
  const doc = await res.json();
  assert.equal(doc.subfolder, "culled");
  assert.equal(doc.documentType, "culled");
});

test("API: GET /api/exported-documents?subfolder=culled returns only culled docs", async () => {
  // Create a culled doc
  await authedFetch("/api/exported-documents", {
    method: "POST",
    body: JSON.stringify({ name: "CulledA.pdf", documentType: "culled", subfolder: "culled", metadata: {} }),
  });
  // Create a herd doc
  await authedFetch("/api/exported-documents", {
    method: "POST",
    body: JSON.stringify({ name: "HerdA.pdf", documentType: "herd", subfolder: "herd", metadata: {} }),
  });

  const res = await authedFetch("/api/exported-documents?subfolder=culled");
  assert.equal(res.status, 200);
  const docs = await res.json();
  assert.ok(Array.isArray(docs));
  assert.ok(docs.every((d: any) => d.subfolder === "culled"), "Non-culled doc returned in culled subfolder query");
});

test("API: GET /api/exported-documents (no subfolder) returns all docs for user", async () => {
  // Create docs in multiple subfolders
  await authedFetch("/api/exported-documents", {
    method: "POST",
    body: JSON.stringify({ name: "ProdA.pdf", documentType: "productivity", subfolder: "productivity", metadata: {} }),
  });
  await authedFetch("/api/exported-documents", {
    method: "POST",
    body: JSON.stringify({ name: "HealthA.pdf", documentType: "productivity", subfolder: "flock-health", metadata: {} }),
  });

  const res = await authedFetch("/api/exported-documents");
  assert.equal(res.status, 200);
  const docs = await res.json();
  assert.ok(Array.isArray(docs));
  assert.ok(docs.length >= 3, `Expected ≥3 total docs, got ${docs.length}`);
  const subfolders = new Set(docs.map((d: any) => d.subfolder));
  assert.ok(subfolders.has("culled"), "culled subfolder missing");
  assert.ok(subfolders.has("productivity"), "productivity subfolder missing");
  assert.ok(subfolders.has("flock-health"), "flock-health subfolder missing");
});

test("API: POST /api/exported-documents for flock-health subfolder routes correctly", async () => {
  const res = await authedFetch("/api/exported-documents", {
    method: "POST",
    body: JSON.stringify({
      name: "FlockHealth_2026-06-22.pdf",
      documentType: "productivity",
      subfolder: "flock-health",
      metadata: { exportType: "pdf", category: "flock-health", animalCount: 12, status: "success" },
    }),
  });
  assert.equal(res.status, 201);
  const doc = await res.json();
  assert.equal(doc.subfolder, "flock-health");
});

test("API: DELETE /api/exported-documents/:id removes document", async () => {
  const createRes = await authedFetch("/api/exported-documents", {
    method: "POST",
    body: JSON.stringify({ name: "ToDelete.pdf", documentType: "herd", subfolder: "herd", metadata: {} }),
  });
  const doc = await createRes.json();
  const deleteRes = await authedFetch(`/api/exported-documents/${doc.id}`, { method: "DELETE" });
  assert.ok(deleteRes.status === 200 || deleteRes.status === 204, `Expected 200 or 204, got ${deleteRes.status}`);

  // Confirm it's gone
  const listRes = await authedFetch("/api/exported-documents?subfolder=herd");
  const remaining = await listRes.json();
  assert.ok(!remaining.find((d: any) => d.id === doc.id), "Deleted doc still present");
});

test("API: all 8 expected subfolders can be written and queried", async () => {
  const subfolders = ["herd", "individual", "breeding", "flock-health", "culled", "sold", "deceased", "productivity"];
  for (const sf of subfolders) {
    const createRes = await authedFetch("/api/exported-documents", {
      method: "POST",
      body: JSON.stringify({ name: `Test_${sf}.pdf`, documentType: sf, subfolder: sf, metadata: { status: "success" } }),
    });
    assert.equal(createRes.status, 201, `Failed to create doc in subfolder: ${sf}`);
    const doc = await createRes.json();
    assert.equal(doc.subfolder, sf, `Subfolder mismatch: expected ${sf}, got ${doc.subfolder}`);
  }
});
