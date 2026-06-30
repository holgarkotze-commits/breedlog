import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import { buildBreedLogSimulationDataset } from "../shared/breedlog-simulation";
import {
  BREEDLOG_CSV_HEADERS,
  buildBreedLogCsvRows,
  buildBreedLogCsvContent,
  parseBreedLogCsvRecords,
  buildBreedLogImportTemplateCsv,
} from "../shared/import-export";

function parseCsv(csvText: string): Record<string, string>[] {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

test("CSV export uses required BreedLog headers and field mapping", () => {
  const dataset = buildBreedLogSimulationDataset();
  const rows = buildBreedLogCsvRows(dataset.animals, dataset.farmMetadata?.studPrefix || "KW");
  const csv = buildBreedLogCsvContent(rows);

  const [headerLine] = csv.split("\n");
  assert.deepEqual(headerLine.split(","), [...BREEDLOG_CSV_HEADERS]);

  const parsedRows = parseCsv(csv);
  assert.ok(parsedRows.length > 0);

  const one = parsedRows.find((row) => row.displayTag === "KW22001")!;
  assert.equal(one.rawTag, "22001");
  assert.equal(one.studPrefix, "KW");
  assert.equal(one.sex, "ram");
  assert.equal(one.birthDate.startsWith("2022-"), true);
  assert.equal(one.birthWeightEstimated, "true"); // founders have estimated birth weights
  assert.equal(one.weaningWeightEstimated, "false");
});

test("CSV export escapes quotes, commas and line breaks", () => {
  const dataset = buildBreedLogSimulationDataset();
  const animal = { ...dataset.animals[0], name: 'Doe "A", Prime', notes: "line1\nline2,quoted" };
  const csv = buildBreedLogCsvContent(buildBreedLogCsvRows([animal], "KW"));

  assert.match(csv, /"Doe ""A"", Prime"/);
  assert.match(csv, /"line1\nline2,quoted"/);

  const rows = parseCsv(csv);
  assert.equal(rows[0].name, 'Doe "A", Prime');
  assert.equal(rows[0].notes, "line1\nline2,quoted");
});

test("CSV import normalizes tags, blocks duplicates and validates weights/dates", () => {
  const existing = buildBreedLogSimulationDataset().animals.slice(0, 2);
  const csv = [
    BREEDLOG_CSV_HEADERS.join(","),
    '"24-001","KW","KW24-001","A","ewe","active","commercial","born on farm","2024-01-01","single","4.00","false","2024-04-10","28.00","true","40.00","","","","","LineA","25A","EID-1","","ok"',
    '"KW24-001","KW","KW24-001","A2","ewe","active","commercial","bought in","2024-01-02","single","4.00","false","","","false","","","","","","LineA","25A","EID-2","","dup-tag"',
    '"24-002","KW","KW24-002","B","ewe","active","commercial","unknown","bad-date","single","bad-weight","false","","","false","","","","","","LineB","25A","EID-1","","bad"',
  ].join("\n");

  const parsed = parseBreedLogCsvRecords(parseCsv(csv), existing, "KW");
  assert.equal(parsed.rowsToCreate.length, 1);
  assert.equal(parsed.rowsToCreate[0].tagId, "KW24-001");
  assert.equal(parsed.rowsToCreate[0].rawTag, "24-001");
  assert.equal(parsed.rowsToCreate[0].birthWeightEstimated, false);
  assert.equal(parsed.rowsToCreate[0].weight100DayEstimated, true);
  assert.ok(parsed.duplicates >= 1);
  assert.ok(parsed.validationErrors.some((err) => err.includes("birthDate")));
  assert.ok(parsed.validationErrors.some((err) => err.includes("birthWeightKg")));
});

test("CSV roundtrip works for Phase 9 simulation and re-import is duplicate-safe", () => {
  const dataset = buildBreedLogSimulationDataset();
  const exportRows = buildBreedLogCsvRows(dataset.animals, dataset.farmMetadata?.studPrefix || "KW");
  const csv = buildBreedLogCsvContent(exportRows);
  const parsedRows = parseCsv(csv);

  const firstImport = parseBreedLogCsvRecords(parsedRows, [], dataset.farmMetadata?.studPrefix || "KW");
  assert.equal(firstImport.rowsToCreate.length, dataset.animals.length);

  const secondImport = parseBreedLogCsvRecords(parsedRows, dataset.animals, dataset.farmMetadata?.studPrefix || "KW");
  assert.equal(secondImport.rowsToCreate.length, 0);
  assert.ok(secondImport.duplicates > 0);

  const sireRows = parsedRows.filter((row) => ["KW22001", "KW22002"].includes(row.displayTag));
  assert.equal(sireRows.length, 2);
});

test("Import template matches parser headers", () => {
  const template = buildBreedLogImportTemplateCsv();
  const header = template.trim().split("\n")[0].split(",");
  assert.deepEqual(header, [...BREEDLOG_CSV_HEADERS]);
});

test("Settings does not expose JSON as normal export and marks XLSX as blocked", () => {
  const settings = fs.readFileSync("client/src/pages/Settings.tsx", "utf8");
  assert.doesNotMatch(settings, /JSON export/i);
  assert.match(settings, /XLSX \(Blocked\)/);
  assert.match(settings, /button-download-import-template/);
});

test("PDF export structure keeps header/footer placement guards", () => {
  const settings = fs.readFileSync("client/src/pages/Settings.tsx", "utf8");
  assert.match(settings, /class="header"/);
  assert.match(settings, /class="footer"/);
  assert.match(settings, /position: absolute; bottom: 5mm/);
  assert.match(settings, /padding-bottom: 30mm/);
});

test("XLSX blocker doc exists with attempted package command and error", () => {
  const doc = fs.readFileSync("docs/release/xlsx-import-export-handoff.md", "utf8");
  assert.match(doc, /npm install xlsx --save-exact/);
  assert.match(doc, /E403/);
  assert.match(doc, /CSV is the active and supported spreadsheet format/i);
});

test("CSV sire/dam lookup resolves parent tag IDs from full herd, not just exported subset (fix1)", () => {
  const dataset = buildBreedLogSimulationDataset();
  const allAnimals = dataset.animals;

  // Find a young animal (born 2024+) whose sireId points to a founder ram
  const youngWithSire = allAnimals.find(
    (a) => a.sireId !== null && a.birthDate && a.birthDate.slice(0, 4) >= "2024"
  );
  if (!youngWithSire) return; // safety: skip if dataset changes

  const sire = allAnimals.find((a) => a.id === youngWithSire.sireId);
  if (!sire) return;

  // Export only the young animal — sire is NOT in the exported subset
  const rowsNoLookup = buildBreedLogCsvRows([youngWithSire]);
  assert.equal(
    rowsNoLookup[0].sire,
    String(youngWithSire.sireId),
    "without full-herd lookup, sire falls back to raw DB ID"
  );

  // With full herd: sire tag ID resolved correctly
  const rowsWithLookup = buildBreedLogCsvRows([youngWithSire], undefined, allAnimals);
  assert.equal(
    rowsWithLookup[0].sire,
    sire.tagId,
    "with full-herd lookup, sire shows tag ID not raw DB ID"
  );
});

test("CSV export prefers ramType over classification for rams (fix4)", () => {
  const dataset = buildBreedLogSimulationDataset();
  const baseRam = dataset.animals.find((a) => a.sex === "ram")!;
  const ram = { ...baseRam, ramType: "stud_ram" as const, classification: "commercial" };

  const rows = buildBreedLogCsvRows([ram]);
  assert.equal(
    rows[0].classification,
    "stud_ram",
    "ramType must take precedence over classification in CSV export"
  );
});

test("Dashboard birth year uses string slice to avoid timezone shifts (fix5)", () => {
  const src = fs.readFileSync("client/src/pages/Dashboard.tsx", "utf8");
  assert.ok(
    src.includes("birthDate.slice(0, 4)") || src.includes("birthDate.slice(0,4)"),
    "Dashboard.tsx must use birthDate.slice(0, 4) for year comparison, not new Date().getFullYear()"
  );
  assert.doesNotMatch(
    src,
    /filter\(a => a\.birthDate && new Date\(a\.birthDate\)\.getFullYear\(\) === currentYear\)/,
    "Dashboard.tsx must not use new Date(a.birthDate).getFullYear() for the lambsThisYear metric"
  );
});
