import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());

function read(relPath: string) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("Animals page uses windowed rendering with limited initial count and load-more step", () => {
  const src = read("client/src/pages/Animals.tsx");
  assert.match(src, /ANIMALS_INITIAL_VISIBLE_COUNT\s*=\s*50/);
  assert.match(src, /ANIMALS_LOAD_MORE_STEP\s*=\s*50/);
  assert.match(src, /slice\(0, visibleAnimalsCount\)/);
  assert.match(src, /button-load-more-animals/);
});

test("Animals page resets visible window when search/filter/view changes", () => {
  const src = read("client/src/pages/Animals.tsx");
  assert.match(src, /setVisibleAnimalsCount\(ANIMALS_INITIAL_VISIBLE_COUNT\)/);
  assert.match(src, /\[search, statusFilter, classificationFilter, sexFilter, ageFilter, viewMode\]/);
});

test("Animals page lazy-loads PDF export dialog and avoids eager PDF dialog import", () => {
  const src = read("client/src/pages/Animals.tsx");
  assert.match(src, /const PDFExportDialog = lazy\(/);
  assert.doesNotMatch(src, /import\s*\{\s*PDFExportDialog\s*,\s*usePDFExportDialog\s*\}\s*from\s*["']@\/components\/PDFExportDialog["']/);
  assert.match(src, /<Suspense fallback=\{null\}>/);
});

test("Simulation dataset is not imported by runtime app shell/pages", () => {
  const files = [
    "client/src/App.tsx",
    "client/src/pages/Animals.tsx",
    "client/src/pages/Analysis.tsx",
    "client/src/pages/Health.tsx",
    "client/src/pages/Settings.tsx",
  ];

  for (const file of files) {
    const src = read(file);
    assert.doesNotMatch(src, /breedlog-simulation/);
  }
});

test("Health page keeps health-plan guide dynamic import and no eager runtime constant import", () => {
  const src = read("client/src/pages/Health.tsx");
  assert.match(src, /import\("@\/lib\/health-plan-guide"\)/);
  assert.doesNotMatch(src, /import\s*\{[^}]*HEALTH_PLAN_(?:DISCLAIMER|TOPICS)[^}]*\}\s*from\s*["']@\/lib\/health-plan-guide["']/);
});

test("Settings keeps JSON export hidden and XLSX blocked messaging visible", () => {
  const src = read("client/src/pages/Settings.tsx");
  assert.match(src, /XLSX blocked in this environment/);
  assert.doesNotMatch(src, /Export JSON/i);
});

test("Phase 14 performance hardening report exists", () => {
  const docPath = path.join(repoRoot, "docs/release/mobile-performance-hardening.md");
  assert.ok(fs.existsSync(docPath));
  const doc = fs.readFileSync(docPath, "utf8");
  assert.match(doc, /Animals page rendering strategy/);
  assert.match(doc, /Health Plan lazy-load status/);
  assert.match(doc, /Simulation dataset runtime status/);
});
