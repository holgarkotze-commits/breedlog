import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());

function read(relPath: string) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("field-test version source exists with RC label", () => {
  const src = read("shared/version.ts");
  assert.match(src, /FIELD_TEST_VERSION_LABEL/);
  assert.match(src, /BreedLog Web\/PWA Field Test RC1/);
});

test("settings shows field-test version and issue-reporting link", () => {
  const src = read("client/src/pages/Settings.tsx");
  assert.match(src, /FIELD_TEST_VERSION_LABEL/);
  assert.match(src, /field-test-release-info/);
  assert.match(src, /link-report-field-test-issue/);
  assert.match(src, /mailto:support@breedlog\.app/);
});

test("field-test release documents exist", () => {
  const requiredDocs = [
    "docs/release/field-test-release-notes.md",
    "docs/release/field-test-checklist.md",
    "docs/release/next-upgrade-android-aab-package.md",
    "docs/release/phase-15-web-pwa-field-test-validation.md",
  ];

  for (const rel of requiredDocs) {
    const full = path.join(repoRoot, rel);
    assert.ok(fs.existsSync(full), `${rel} should exist`);
  }
});

test("field-test notes include cache refresh guidance and known blockers", () => {
  const notes = read("docs/release/field-test-release-notes.md");
  assert.match(notes, /open the app while online and use reload\/refresh once/i);
  assert.match(notes, /Known blockers/i);
});

test("phase 14 performance and runtime safety signals remain present", () => {
  const animals = read("client/src/pages/Animals.tsx");
  const health = read("client/src/pages/Health.tsx");
  const settings = read("client/src/pages/Settings.tsx");
  const runtimePages = [
    "client/src/App.tsx",
    "client/src/pages/Animals.tsx",
    "client/src/pages/Analysis.tsx",
    "client/src/pages/Health.tsx",
    "client/src/pages/Settings.tsx",
  ].map(read);

  assert.match(animals, /ANIMALS_INITIAL_VISIBLE_COUNT\s*=\s*50/);
  assert.match(animals, /button-load-more-animals/);
  assert.match(animals, /const PDFExportDialog = lazy\(/);
  assert.match(health, /import\("@\/lib\/health-plan-guide"\)/);
  assert.match(settings, /XLSX blocked in this environment/);
  assert.doesNotMatch(settings, /Export JSON/i);

  for (const src of runtimePages) {
    assert.doesNotMatch(src, /breedlog-simulation/);
  }
});
