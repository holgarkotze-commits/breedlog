import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");
const pages = {
  Animals: ["client/src/pages/Animals.tsx", "getCanonicalGroupCSS"],
  Lambs: ["client/src/pages/Lambs.tsx", "getCanonicalGroupCSS"],
  Records: ["client/src/pages/Records.tsx", "getCanonicalGroupCSS"],
  HealthEventDetail: ["client/src/pages/HealthEventDetail.tsx", "getCanonicalPortraitCSS"],
  Analysis: ["client/src/pages/Analysis.tsx", "getCanonicalGroupCSS"],
  Genetics: ["client/src/pages/Genetics.tsx", "getCanonicalGroupCSS"],
  Settings: ["client/src/pages/Settings.tsx", "getCanonicalGroupCSS"],
  Breeding: ["client/src/pages/Breeding.tsx", "getCanonicalGroupCSS"],
  MatingGroupDetail: ["client/src/pages/MatingGroupDetail.tsx", "getCanonicalGroupCSS"],
  BreedingEventDetail: ["client/src/pages/BreedingEventDetail.tsx", "getCanonicalPortraitCSS"],
} as const;

const helpers = [
  "renderExportHeader",
  "renderExportFooter",
  "wrapExportDocument",
  "openExportPrintDialog",
];
const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("every HTML report surface is routed through the canonical document contract", () => {
  for (const [surface, [path, css]] of Object.entries(pages)) {
    const source = read(path);
    assert.match(source, new RegExp(`\\b${css}\\s*\\(`), `${surface} must select its canonical page CSS`);
    for (const helper of helpers) {
      assert.match(source, new RegExp(`\\b${helper}\\s*\\(`), `${surface} must use ${helper}`);
    }
  }
});

test("standardized HTML report pages do not restore bespoke popup/print paths", () => {
  for (const [surface, [path]] of Object.entries(pages)) {
    const source = read(path);
    assert.doesNotMatch(source, /\bdocument\.write\s*\(/, `${surface} must use wrapExportDocument`);
    assert.doesNotMatch(source, /\bwindow\.open\s*\(/, `${surface} must use openExportPrintDialog`);
    assert.doesNotMatch(source, /\bprintWindow\b/, `${surface} must not maintain a second print path`);
  }
});

test("Animal Detail delegates to the PDF document and exposes no Word export", () => {
  const detail = read("client/src/pages/AnimalDetail.tsx");
  const profile = read("client/src/lib/animal-profile-pdf.tsx");

  assert.match(detail, /buildAnimalProfilePdfBlob/);
  assert.doesNotMatch(detail, /\b(?:exportWord|application\/msword|\bWord\b)/i);
  // The sole direct popup is intentionally opened synchronously for the PDF blob preview.
  assert.match(detail, /const\s+previewWindow\s*=\s*window\.open\(/);
  assert.doesNotMatch(withoutComments(detail), /\bdocument\.write\s*\(/);

  assert.match(profile, /from\s+"@react-pdf\/renderer"/);
  assert.match(profile, /<Page\s+size="A4"/);
   // Header mirrors the canonical logo / centred farm / page-date layout.
  assert.match(profile, /header:\s*\{[\s\S]*?top:\s*24,[\s\S]*?left:\s*32,[\s\S]*?right:\s*32,/);
   assert.match(profile, /headerLeft:\s*\{[\s\S]*?width:\s*60,[\s\S]*?height:\s*60,/);
   assert.match(profile, /logo:\s*\{[\s\S]*?width:\s*60,[\s\S]*?height:\s*60,/);
   assert.match(profile, /headerCenter:[\s\S]*?textAlign:\s*"center"/);
   assert.match(profile, /headerRight:[\s\S]*?width:\s*82/);
   assert.match(profile, /paddingTop:\s*108/);
   assert.match(profile, /paddingBottom:\s*96/);
  assert.match(profile, /#FFC300/);
   // Both document pages use the canonical dark footer ribbon, not a bespoke line footer.
   assert.match(profile, /footer:\s*\{[\s\S]*?backgroundColor:\s*"#1a1a1a"[\s\S]*?borderTop:\s*"2 solid #FFC300"/);
   assert.match(profile, /footerBrand:[\s\S]*?color:\s*"#ffffff"/);
   assert.match(profile, /footerTagline:[\s\S]*?color:\s*"#FFC300"/);
   assert.match(profile, /Professional Livestock Management/);
   assert.match(profile, /<CanonicalFooter\b/g);
  assert.match(profile, /BREEDLOG/);
  assert.match(profile, /pageNumber,\s*totalPages/);
});

test("Breeding offers PDF and CSV, never a Word export", () => {
  const source = read("client/src/pages/Breeding.tsx");
  assert.match(source, /Export as PDF/);
  assert.match(source, /Export as CSV/);
  assert.doesNotMatch(source, /\b(?:exportWord|application\/msword|\bWord\b)/i);
});

test("mating-group exports preserve current status and unresolved stored members", () => {
  const source = read("client/src/pages/MatingGroupDetail.tsx");
  assert.match(source, /status:\s*ewe\.unavailable\s*\?\s*["']unavailable["']\s*:\s*ewe\.status\s*\|\|\s*["']{2}/i);
  assert.match(source, /Unavailable animal #\$\{id\}/);
  assert.match(source, /status:\s*["']unavailable["']/);
  assert.match(source, /eweCount:\s*\(group\.eweIds\s*\|\|\s*\[\]\)\.length/);
  assert.match(source, /Current status/);
  assert.ok(
    !/g\.ewes\.map\([\s\S]*?\[\s*ewe\.tagId[\s\S]*?["']Active["']/.test(source),
    "CSV rows must use the resolved animal status rather than a hard-coded Active value",
  );
});