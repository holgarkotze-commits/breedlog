/**
 * records-health-exports.test.ts
 *
 * Focused regression suite confirming Records-tab and Health-tab PDF exports
 * have been migrated to the canonical BreedLog export template.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Source file content ──────────────────────────────────────────────────────

const recordsSrc    = fs.readFileSync("client/src/pages/Records.tsx", "utf8");
const healthSrc     = fs.readFileSync("client/src/pages/HealthEventDetail.tsx", "utf8");
const templateSrc   = fs.readFileSync("client/src/lib/export-template.ts", "utf8");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function between(src: string, startMark: string, endMark: string): string {
  const s = src.indexOf(startMark);
  if (s === -1) return "";
  const e = src.indexOf(endMark, s);
  return e === -1 ? src.slice(s) : src.slice(s, e);
}

// ─── 1. export-template.ts — canonical footer constants ─────────────────────

test("canonical template footer position bottom is 6mm (not 4mm)", () => {
  // Check the positioned footer uses bottom: 6mm
  assert.match(templateSrc, /position:\s*absolute[^}]*bottom:\s*6mm|bottom:\s*6mm[^}]*position:\s*absolute/);
  // The old incorrect value was bottom: 4mm as a positioning property;
  // margin-bottom: 4mm and padding: 4mm are unrelated spacing properties that are fine
  // Check that no standalone "bottom: Xmm" positioning property uses 4mm
  // by ensuring the footer's "bottom:" value is 6mm
  const footerMatch = templateSrc.match(/\.footer\s*\{[^}]+\}/);
  if (footerMatch) {
    assert.match(footerMatch[0], /bottom:\s*6mm/);
    assert.doesNotMatch(footerMatch[0], /;\s*bottom:\s*4mm|^\s*bottom:\s*4mm/);
  }
});

test("canonical template page padding-bottom is 28mm (not 30mm)", () => {
  assert.match(templateSrc, /padding-bottom:\s*28mm/);
  assert.doesNotMatch(templateSrc, /padding-bottom:\s*30mm/);
});

test("canonical template exports getCanonicalGroupCSS", () => {
  assert.match(templateSrc, /export\s+function\s+getCanonicalGroupCSS/);
});

test("canonical template exports getCanonicalPortraitCSS", () => {
  assert.match(templateSrc, /export\s+function\s+getCanonicalPortraitCSS/);
});

test("canonical template exports renderExportHeader", () => {
  assert.match(templateSrc, /export\s+function\s+renderExportHeader/);
});

test("canonical template exports renderExportFooter", () => {
  assert.match(templateSrc, /export\s+function\s+renderExportFooter/);
});

test("canonical template exports wrapExportDocument", () => {
  assert.match(templateSrc, /export\s+function\s+wrapExportDocument/);
});

test("canonical template exports openExportPrintDialog", () => {
  assert.match(templateSrc, /export\s+function\s+openExportPrintDialog/);
});

test("canonical template exports GROUP_ROWS_PER_PAGE = 20", () => {
  assert.match(templateSrc, /GROUP_ROWS_PER_PAGE\s*=\s*20/);
});

test("canonical template contains dark gradient footer", () => {
  assert.match(templateSrc, /linear-gradient\(135deg/);
});

test("canonical template does not contain simulation markers", () => {
  assert.ok(!templateSrc.includes("__SIM__"), "Must not have __SIM__ marker");
  assert.ok(!templateSrc.includes("U2A2ZAVQ"), "Must not have master code");
});

// ─── 2. Records.tsx — imports canonical template ──────────────────────────────

test("Records.tsx imports getCanonicalGroupCSS from export-template", () => {
  assert.match(recordsSrc, /getCanonicalGroupCSS/);
});

test("Records.tsx imports renderExportHeader from export-template", () => {
  assert.match(recordsSrc, /renderExportHeader/);
});

test("Records.tsx imports renderExportFooter from export-template", () => {
  assert.match(recordsSrc, /renderExportFooter/);
});

test("Records.tsx imports wrapExportDocument from export-template", () => {
  assert.match(recordsSrc, /wrapExportDocument/);
});

test("Records.tsx imports openExportPrintDialog from export-template", () => {
  assert.match(recordsSrc, /openExportPrintDialog/);
});

test("Records.tsx imports sanitizePublicNote from export-template", () => {
  assert.match(recordsSrc, /sanitizePublicNote/);
});

test("Records.tsx imports GROUP_ROWS_PER_PAGE for pagination", () => {
  assert.match(recordsSrc, /GROUP_ROWS_PER_PAGE/);
});

test("Records.tsx uses PDFExportDialog component", () => {
  assert.match(recordsSrc, /PDFExportDialog/);
});

test("Records.tsx uses usePDFExportDialog hook", () => {
  assert.match(recordsSrc, /usePDFExportDialog/);
});

// ─── 3. Records.tsx — old helpers removed ────────────────────────────────────

test("Records.tsx does not define its own openPrintWindow function", () => {
  assert.doesNotMatch(recordsSrc, /const openPrintWindow/);
});

test("Records.tsx does not define its own makeHeader function", () => {
  assert.doesNotMatch(recordsSrc, /const makeHeader/);
});

test("Records.tsx does not define its own makeFooter function", () => {
  assert.doesNotMatch(recordsSrc, /const makeFooter/);
});

test("Records.tsx does not define PDF_CSS local variable", () => {
  assert.doesNotMatch(recordsSrc, /const PDF_CSS/);
});

test("Records.tsx does not call window.open directly", () => {
  assert.doesNotMatch(recordsSrc, /window\.open\(/);
});

// ─── 4. Records.tsx — all 5 PDF export functions present ─────────────────────

test("Records.tsx defines exportCulledPDF", () => {
  assert.match(recordsSrc, /const exportCulledPDF/);
});

test("Records.tsx defines exportSoldPDF", () => {
  assert.match(recordsSrc, /const exportSoldPDF/);
});

test("Records.tsx defines exportDeceasedPDF", () => {
  assert.match(recordsSrc, /const exportDeceasedPDF/);
});

test("Records.tsx defines exportLambingPDF", () => {
  assert.match(recordsSrc, /const exportLambingPDF/);
});

test("Records.tsx defines exportMatingPDF", () => {
  assert.match(recordsSrc, /const exportMatingPDF/);
});

// ─── 5. Records.tsx — quality dialog dispatches all exports ───────────────────

test("PDFExportDialog dispatcher handles culled", () => {
  assert.match(recordsSrc, /pdfExportType === ["']culled["']/);
});

test("PDFExportDialog dispatcher handles sold", () => {
  assert.match(recordsSrc, /pdfExportType === ["']sold["']/);
});

test("PDFExportDialog dispatcher handles deceased", () => {
  assert.match(recordsSrc, /pdfExportType === ["']deceased["']/);
});

test("PDFExportDialog dispatcher handles lambing", () => {
  assert.match(recordsSrc, /pdfExportType === ["']lambing["']/);
});

test("PDFExportDialog dispatcher handles mating", () => {
  assert.match(recordsSrc, /pdfExportType === ["']mating["']/);
});

// ─── 6. Records.tsx — pagination uses constant ───────────────────────────────

test("buildPagedPdf sets rowsPerPage from GROUP_ROWS_PER_PAGE", () => {
  assert.match(recordsSrc, /rowsPerPage\s*=\s*GROUP_ROWS_PER_PAGE/);
});

// ─── 7. Records.tsx — notes are sanitised ────────────────────────────────────

test("exportCulledPDF sanitises notes via sanitizePublicNote", () => {
  const section = between(recordsSrc, "const exportCulledPDF", "const exportCulledCSV");
  assert.match(section, /sanitizePublicNote/);
});

test("exportMatingPDF sanitises notes via sanitizePublicNote", () => {
  const section = between(recordsSrc, "const exportMatingPDF", "const exportMatingCSV");
  assert.match(section, /sanitizePublicNote/);
});

// ─── 8. Records.tsx — does not contain raw @page CSS ─────────────────────────

test("Records.tsx does not embed raw @page CSS (uses canonical import)", () => {
  // No local @page rule — template handles it
  assert.doesNotMatch(recordsSrc, /@page\s*\{/);
});

// ─── 9. HealthEventDetail.tsx — imports canonical template ───────────────────

test("HealthEventDetail.tsx imports getCanonicalPortraitCSS", () => {
  assert.match(healthSrc, /getCanonicalPortraitCSS/);
});

test("HealthEventDetail.tsx imports renderExportHeader", () => {
  assert.match(healthSrc, /renderExportHeader/);
});

test("HealthEventDetail.tsx imports renderExportFooter", () => {
  assert.match(healthSrc, /renderExportFooter/);
});

test("HealthEventDetail.tsx imports wrapExportDocument", () => {
  assert.match(healthSrc, /wrapExportDocument/);
});

test("HealthEventDetail.tsx imports openExportPrintDialog", () => {
  assert.match(healthSrc, /openExportPrintDialog/);
});

test("HealthEventDetail.tsx imports sanitizePublicNote", () => {
  assert.match(healthSrc, /sanitizePublicNote/);
});

test("HealthEventDetail.tsx uses PDFExportDialog component", () => {
  assert.match(healthSrc, /PDFExportDialog/);
});

// ─── 10. HealthEventDetail.tsx — old inline CSS removed ──────────────────────

test("HealthEventDetail.tsx does not embed @page portrait CSS inline", () => {
  assert.doesNotMatch(healthSrc, /@page\s*\{\s*size:\s*A4 portrait/);
});

test("HealthEventDetail.tsx does not call window.open directly", () => {
  assert.doesNotMatch(healthSrc, /window\.open\(/);
});

test("HealthEventDetail.tsx does not reference printWindow variable", () => {
  assert.doesNotMatch(healthSrc, /printWindow/);
});

// ─── 11. HealthEventDetail.tsx — health fields included in export ─────────────

test("exportPDF includes eventDate field", () => {
  const section = between(healthSrc, "const exportPDF", "createExportedDoc.mutate");
  assert.match(section, /eventDate/);
});

test("exportPDF includes productName field", () => {
  const section = between(healthSrc, "const exportPDF", "createExportedDoc.mutate");
  assert.match(section, /productName/);
});

test("exportPDF includes dose field", () => {
  const section = between(healthSrc, "const exportPDF", "createExportedDoc.mutate");
  assert.match(section, /dose/);
});

test("exportPDF sanitises notes via sanitizePublicNote", () => {
  const section = between(healthSrc, "const exportPDF", "createExportedDoc.mutate");
  assert.match(section, /sanitizePublicNote/);
});

test("exportPDF includes animals table", () => {
  const section = between(healthSrc, "const exportPDF", "createExportedDoc.mutate");
  assert.match(section, /animal-table|animal_table|tagId/);
});

// ─── 12. HealthEventDetail.tsx — dialog gates export ────────────────────────

test("export menu item opens dialog (not direct PDF call)", () => {
  assert.match(healthSrc, /setPdfDialogOpen\(true\)/);
});

test("dialog onExport calls exportPDF()", () => {
  assert.match(healthSrc, /exportPDF\(\)/);
});
