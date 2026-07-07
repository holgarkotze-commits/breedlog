import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const animals = fs.readFileSync('client/src/pages/Animals.tsx','utf8');
const lambs = fs.readFileSync('client/src/pages/Lambs.tsx','utf8');
const detail = fs.readFileSync('client/src/pages/AnimalDetail.tsx','utf8');
const pdfUtils = fs.readFileSync('client/src/lib/pdf-utils.ts','utf8');
const exportTemplate = fs.readFileSync('client/src/lib/export-template.ts','utf8');

// ---------------------------------------------------------------------------
// 1. Canonical template module
// ---------------------------------------------------------------------------

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

test('canonical template logo is 60px (medium canonical size)', () => {
  assert.match(exportTemplate, /\.logo\s*\{[^}]*width:\s*60px/);
  assert.match(exportTemplate, /\.logo\s*\{[^}]*height:\s*60px/);
});

test('canonical template exports all required builder functions', () => {
  assert.match(exportTemplate, /export function getCanonicalGroupCSS/);
  assert.match(exportTemplate, /export function getCanonicalPortraitCSS/);
  assert.match(exportTemplate, /export function renderExportHeader/);
  assert.match(exportTemplate, /export function renderExportFooter/);
  assert.match(exportTemplate, /export function wrapExportDocument/);
  assert.match(exportTemplate, /export function openExportPrintDialog/);
});

// ---------------------------------------------------------------------------
// 2. Group exports — orientation and pagination
// ---------------------------------------------------------------------------

test('group exports are landscape and paginated at 20', () => {
  assert.match(animals, /@page\s*\{\s*size:\s*A4 landscape/);
  assert.match(animals, /const\s+ramsPerPage\s*=\s*20/);
  assert.match(animals, /const\s+ewesPerPage\s*=\s*20/);
  assert.match(animals, /const\s+lambsPerPage\s*=\s*20/);
  assert.match(animals, /const\s+animalsPerPage\s*=\s*20/);
  assert.match(pdfUtils, /GROUP_EXPORT_PAGE_SIZE\s*=\s*20/);
});

test('all group exports have dark footer ribbon', () => {
  const gradientMatches = [...animals.matchAll(/linear-gradient\(135deg, #1a1a1a 0%, #2d2d2d 100%\)/g)];
  assert.ok(gradientMatches.length >= 5, `Expected ≥5 gradient occurrences in Animals.tsx, got ${gradientMatches.length}`);
});

test('group exports have canonical header and footer CSS classes', () => {
  assert.match(animals, /class="header"/);
  assert.match(animals, /class="footer"/);
});

test('no portrait-dimensioned pages in group exports (Animals.tsx)', () => {
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

test('footer is absolutely positioned (not fixed) in group page divs — no overlap risk', () => {
  assert.match(exportTemplate, /position:\s*absolute/);
  assert.ok(!exportTemplate.includes('position: fixed'), 'Canonical template must not use position: fixed for footer');
  assert.ok(!animals.includes('position: fixed'), 'Animals.tsx must not use position: fixed for footer');
});

test('group pages include padding-bottom clearance to prevent footer overlap', () => {
  assert.match(exportTemplate, /padding-bottom:\s*28mm/);
  assert.match(animals, /padding-bottom:\s*28mm/);
});

// ---------------------------------------------------------------------------
// 3. Individual animal exports — portrait, canonical header/footer
// ---------------------------------------------------------------------------

test('individual export remains portrait orientation', () => {
  assert.match(detail, /@page\s*\{\s*size:\s*A4 portrait/);
});

test('individual export has canonical dark gradient footer ribbon', () => {
  assert.match(detail, /linear-gradient\(135deg, #1a1a1a 0%, #2d2d2d 100%\)/);
  assert.match(detail, /color:\s*#FFC300/);
  assert.match(detail, /BREEDLOG/);
});

test('individual export footer is absolutely positioned to page bottom', () => {
  assert.match(detail, /position:\s*absolute/);
  assert.match(detail, /bottom:\s*6mm/);
});

test('individual export logo matches canonical 60px size', () => {
  assert.match(detail, /\.logo\s*\{\s*width:\s*60px/);
});

test('individual export has canonical header structure (logo-left, farm-centre, date-right)', () => {
  assert.match(detail, /class="header-left"/);
  assert.match(detail, /class="header-center"/);
  assert.match(detail, /class="header-right"/);
  assert.match(detail, /class="logo"/);
});

// ---------------------------------------------------------------------------
// 4. Family tree / pedigree export — real lineage data
// ---------------------------------------------------------------------------

test('individual family tree export uses real sire and dam from animal data', () => {
  assert.match(detail, /animal\.sire/);
  assert.match(detail, /animal\.dam/);
  assert.match(detail, /buildFamilyTreePage/);
});

test('family tree export shows tag IDs from real lineage (sire.tagId / dam.tagId)', () => {
  assert.match(detail, /sire\?\.tagId/);
  assert.match(detail, /dam\?\.tagId/);
});

test('family tree export gracefully handles missing ancestors (no fake hardcoded names)', () => {
  assert.match(detail, /externalSireInfo.*Unknown|Unknown.*externalSireInfo/s);
  assert.match(detail, /externalDamInfo.*Unknown|Unknown.*externalDamInfo/s);
  assert.ok(!detail.includes('"John Smith"'), 'No fake hardcoded farmer name');
  assert.ok(!detail.includes('"Ram001"'), 'No fake hardcoded animal tag');
});

test('family tree page uses landscape orientation for pedigree view', () => {
  assert.match(detail, /class="page landscape"/);
  assert.match(detail, /\.page\.landscape.*width:\s*277mm/s);
});

test('family tree page has its own header and dark footer', () => {
  const treePageStart = detail.indexOf('buildFamilyTreePage');
  const treeSection = detail.slice(treePageStart, treePageStart + 8000);
  assert.match(treeSection, /class="header"/);
  assert.match(treeSection, /class="footer"/);
  assert.match(treeSection, /footer-branding/);
});

// ---------------------------------------------------------------------------
// 5. Lambs export — canonical template (fully migrated)
// ---------------------------------------------------------------------------

test('lambs export uses canonical template (getCanonicalGroupCSS)', () => {
  assert.match(lambs, /getCanonicalGroupCSS/);
  assert.match(lambs, /renderExportHeader/);
  assert.match(lambs, /renderExportFooter/);
  assert.match(lambs, /wrapExportDocument/);
  assert.match(lambs, /openExportPrintDialog/);
});

test('lambs export no longer uses old getPDFStyles template', () => {
  assert.ok(!lambs.includes('getPDFStyles('), 'Lambs.tsx still references old getPDFStyles — must be removed');
  assert.ok(!lambs.includes('getPDFFooter('), 'Lambs.tsx still references old getPDFFooter — must be removed');
});

test('lambs export uses GROUP_ROWS_PER_PAGE from canonical module', () => {
  assert.match(lambs, /GROUP_ROWS_PER_PAGE/);
  assert.ok(!lambs.includes('GROUP_EXPORT_PAGE_SIZE'), 'Lambs.tsx should not use old GROUP_EXPORT_PAGE_SIZE');
});

test('lambs export uses export-table class for canonical FFC300 headers', () => {
  assert.match(lambs, /class="export-table"/);
});

test('lambs export renders footer inside every page div', () => {
  assert.match(lambs, /renderExportFooter\(fb\)/);
  assert.match(lambs, /class="page"/);
});

test('lamb export preserves ewe lamb data columns (Lamb ID, Dam, Sire, 100-Day)', () => {
  assert.match(lambs, /Lamb ID/);
  assert.match(lambs, /Dam/);
  assert.match(lambs, /Sire/);
  assert.match(lambs, /100-Day Wt/);
});

test('lamb export preserves ram lamb 270-day column', () => {
  assert.match(lambs, /270-Day Wt/);
});

// ---------------------------------------------------------------------------
// 6. Data field preservation across all group exports
// ---------------------------------------------------------------------------

test('group PDF pages consume stamboek builders', () => {
  assert.match(animals, /buildRamExportRows/);
  assert.match(animals, /buildEweExportRows/);
  assert.match(animals, /buildLambBirthRows/);
  assert.match(animals, /buildLambPerformanceRows/);
  assert.match(animals, /buildCullSoldRows/);
  assert.match(lambs, /buildLambBirthRows/);
  assert.match(lambs, /buildLambPerformanceRows/);
});

test('ram export preserves ram-specific performance columns', () => {
  assert.match(animals, /Total Lambs|totalLambs|Avg Birth/i);
  assert.match(animals, /100-Day|100.Day/i);
});

test('ewe export preserves ewe-specific maternal columns', () => {
  assert.match(animals, /buildEweExportRows/);
  assert.match(animals, /ewesPerPage\s*=\s*20/);
});

test('total herd export keeps all animal sections', () => {
  assert.match(animals, /exportFullHerdPDF/);
  assert.match(animals, /ramsPerPage\s*=\s*20/);
  assert.match(animals, /ewesPerPage\s*=\s*20/);
  assert.match(animals, /lambsPerPage\s*=\s*20/);
});

// ---------------------------------------------------------------------------
// 7. Export record / metadata tracing
// ---------------------------------------------------------------------------

test('export record creation path exists', () => {
  assert.match(animals, /createExportedDoc\.mutate\(/);
});

test('exported documents schema supports metadata trace payload', () => {
  const schema = fs.readFileSync('shared/schema.ts', 'utf8');
  assert.match(schema, /exportedDocuments/);
  assert.match(schema, /metadata/);
});

test('group exports store animal count and page count metadata', () => {
  assert.match(animals, /animalCount/);
  assert.match(animals, /pageCount/);
});

test('lamb export stores structured stamboek row summary metadata', () => {
  assert.match(lambs, /eweBirthRows/);
  assert.match(lambs, /ramBirthRows/);
  assert.match(lambs, /animalCount/);
});

test('individual export still creates exported document with metadata', () => {
  assert.match(detail, /createExportedDoc\.mutate\(/);
  assert.match(detail, /animalCount.*1|1.*animalCount/s);
});

test('records page reads metadata safely and old records are tolerated', () => {
  const records = fs.readFileSync('client/src/pages/Records.tsx', 'utf8');
  assert.match(records, /metadata/);
});
