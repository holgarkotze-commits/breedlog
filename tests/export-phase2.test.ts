import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const animals = fs.readFileSync('client/src/pages/Animals.tsx','utf8');
const lambs = fs.readFileSync('client/src/pages/Lambs.tsx','utf8');
const detail = fs.readFileSync('client/src/pages/AnimalDetail.tsx','utf8');
const settings = fs.readFileSync('client/src/pages/Settings.tsx','utf8');
const pdfUtils = fs.readFileSync('client/src/lib/pdf-utils.ts','utf8');

test('group exports are landscape and paginated at 25', () => {
  assert.match(animals, /@page\s*\{\s*size:\s*A4 landscape/);
  assert.match(animals, /const\s+ramsPerPage\s*=\s*25/);
  assert.match(animals, /const\s+ewesPerPage\s*=\s*25/);
  assert.match(animals, /const\s+lambsPerPage\s*=\s*25/);
  assert.match(animals, /const\s+animalsPerPage\s*=\s*25/);
  assert.match(pdfUtils, /GROUP_EXPORT_PAGE_SIZE\s*=\s*25/);
});

test('individual export remains portrait', () => {
  assert.match(detail, /@page\s*\{\s*size:\s*A4 portrait/);
});

test('group exports avoid animal image fields', () => {
  assert.ok(!settings.includes('<img src="${a.photo}"'));
});

test('header and footer styles exist with black footer banner', () => {
  assert.match(animals, /class="header"/);
  assert.match(animals, /class="footer"/);
  assert.match(animals, /linear-gradient\(135deg, #1a1a1a 0%, #2d2d2d 100%\)/);
  assert.match(lambs, /getPDFFooter\(/);
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
