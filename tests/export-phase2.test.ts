import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const animals = fs.readFileSync('client/src/pages/Animals.tsx','utf8');
const lambs = fs.readFileSync('client/src/pages/Lambs.tsx','utf8');
const detail = fs.readFileSync('client/src/pages/AnimalDetail.tsx','utf8');
const pdfUtils = fs.readFileSync('client/src/lib/pdf-utils.ts','utf8');
const exportTemplate = fs.readFileSync('client/src/lib/export-template.ts','utf8');

test('canonical template defines GROUP_ROWS_PER_PAGE = 20', () => {
  assert.match(exportTemplate, /GROUP_ROWS_PER_PAGE\s*=\s*20/);
});

test('canonical template provides landscape CSS function', () => {
  assert.match(exportTemplate, /getCanonicalGroupCSS/);
  assert.match(exportTemplate, /size:\s*A4 landscape/);
});

test('canonical template provides portrait CSS function', () => {
  assert.match(exportTemplate, /getCanonicalPortraitCSS/);
  assert.match(exportTemplate, /size:\s*A4 portrait/);
});

test('canonical template footer uses dark ribbon design', () => {
  assert.match(exportTemplate, /linear-gradient\(135deg, #1a1a1a 0%, #2d2d2d 100%\)/);
  assert.match(exportTemplate, /color:\s*#FFC300/);
  assert.match(exportTemplate, /BREEDLOG/);
  assert.match(exportTemplate, /Professional Livestock Management/);
});

test('canonical footer is absolutely positioned to bottom of page', () => {
  assert.match(exportTemplate, /position:\s*absolute/);
  assert.match(exportTemplate, /bottom:\s*6mm/);
});

test('group exports are landscape and paginated at 20', () => {
  assert.match(animals, /@page\s*\{\s*size:\s*A4 landscape/);
  assert.match(animals, /const\s+ramsPerPage\s*=\s*20/);
  assert.match(animals, /const\s+ewesPerPage\s*=\s*20/);
  assert.match(animals, /const\s+lambsPerPage\s*=\s*20/);
  assert.match(animals, /const\s+animalsPerPage\s*=\s*20/);
  assert.match(pdfUtils, /GROUP_EXPORT_PAGE_SIZE\s*=\s*20/);
});

test('individual export remains portrait', () => {
  assert.match(detail, /@page\s*\{\s*size:\s*A4 portrait/);
});

test('all group exports have dark footer ribbon', () => {
  const gradientMatches = [...animals.matchAll(/linear-gradient\(135deg, #1a1a1a 0%, #2d2d2d 100%\)/g)];
  assert.ok(gradientMatches.length >= 5, `Expected ≥5 gradient occurrences, got ${gradientMatches.length}`);
});

test('group exports have canonical header and footer CSS classes', () => {
  assert.match(animals, /class="header"/);
  assert.match(animals, /class="footer"/);
});

test('export record creation path exists', () => {
  assert.match(animals, /createExportedDoc\.mutate\(/);
});

test('group PDF pages consume stamboek builders', () => {
  assert.match(animals, /buildRamExportRows/);
  assert.match(animals, /buildEweExportRows/);
  assert.match(animals, /buildLambBirthRows/);
  assert.match(animals, /buildLambPerformanceRows/);
  assert.match(animals, /buildCullSoldRows/);
  assert.match(lambs, /buildLambBirthRows/);
  assert.match(lambs, /buildLambPerformanceRows/);
});

test('lambs export uses getPDFFooter utility', () => {
  assert.match(lambs, /getPDFFooter\(/);
});

test('no portrait-dimensioned pages in group exports', () => {
  assert.ok(!animals.includes('min-height: 297mm'), 'Found portrait page height in group exports');
  assert.ok(!animals.includes('width: 210mm'), 'Found A4 portrait width in group exports');
  assert.ok(!animals.includes('width: 190mm'), 'Found reduced portrait width in group exports');
});

test('culled export no longer uses black background', () => {
  assert.ok(!animals.includes('background: #000'), 'Found black background in exports');
});

test('group exports support ≥ 20 rows per page', () => {
  assert.match(exportTemplate, /GROUP_ROWS_PER_PAGE\s*=\s*20/);
  assert.match(animals, /20/);
});
