import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");
const animals = read("client/src/pages/Animals.tsx");
const lambs = read("client/src/pages/Lambs.tsx");
const template = read("client/src/lib/export-template.ts");

test("canonical template supplies the shared builders and standard page layouts", () => {
  for (const builder of [
    "getCanonicalGroupCSS",
    "getCanonicalPortraitCSS",
    "renderExportHeader",
    "renderExportFooter",
    "wrapExportDocument",
    "openExportPrintDialog",
  ]) {
    assert.match(template, new RegExp(`export function ${builder}`));
  }
  assert.match(template, /GROUP_ROWS_PER_PAGE\s*=\s*20/);
  assert.match(template, /size:\s*A4 landscape/);
  assert.match(template, /size:\s*A4 portrait/);
  assert.match(template, /width:\s*60px/);
  assert.match(template, /#FFC300/);
  assert.match(template, /BREEDLOG/);
});

test("lamb exports retain the complete long-form weight headings", () => {
  for (const label of [
    "Lamb ID",
    "Dam/mother ID",
    "Sire/father ID",
    "100-day weight",
    "270-day/post-wean weight",
  ]) {
    assert.ok(lambs.includes(label), `Missing lamb export label: ${label}`);
  }
  assert.ok(!lambs.includes("100-Day Wt"));
  assert.ok(!lambs.includes("270-Day Wt"));
});

test("full-herd export classifies lambs once and excludes them from adult sections", () => {
  assert.match(animals, /const\s+fullLambIds\s*=\s*new Set\(fullLambs\.map\(a\s*=>\s*a\.id\)\)/);
  assert.match(animals, /fullRams[\s\S]*!fullLambIds\.has\(a\.id\)/);
  assert.match(animals, /fullEwes[\s\S]*!fullLambIds\.has\(a\.id\)/);
});

test("sold and culled register exports keep strict status predicates", () => {
  assert.match(animals, /exportCulledPDF[\s\S]*?status\s*\|\|\s*""\)\.toLowerCase\(\)\s*===\s*"culled"/);
  assert.match(animals, /exportSoldPDF[\s\S]*?status\s*\|\|\s*""\)\.toLowerCase\(\)\s*===\s*"sold"/);
});