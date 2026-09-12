import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pdfDialog = fs.readFileSync("client/src/components/PDFExportDialog.tsx", "utf8");
const exportTemplate = fs.readFileSync("client/src/lib/export-template.ts", "utf8");
const settings = fs.readFileSync("client/src/pages/Settings.tsx", "utf8");
const assistant = fs.readFileSync("client/src/components/BreedLogAssistantPanel.tsx", "utf8");

test("PDF export lifecycle analytics records quality only", () => {
  assert.match(pdfDialog, /trackAnalyticsEvent\("pdf_export_started",\s*\{\s*quality\s*\}\)/);
  assert.match(pdfDialog, /await onExport\(quality\);\s*trackAnalyticsEvent\("pdf_export_completed",\s*\{\s*quality\s*\}\)/);
});

test("document previews are tracked only after a popup opens", () => {
  assert.match(
    exportTemplate,
    /if \(!w\) return;\s*trackAnalyticsEvent\("document_preview_opened",\s*\{\s*format: "pdf"\s*\}\)/,
  );
});

test("settings analytics uses aggregate CSV import and reset fields", () => {
  assert.match(settings, /trackAnalyticsEvent\("csv_import_completed",\s*\{[\s\S]*imported_count:[\s\S]*warning_count:[\s\S]*result:/);
  assert.match(settings, /trackAnalyticsEvent\("workspace_reset_completed",\s*\{\s*scope: "workspace",\s*offline_cache_cleared: true,/);
});

test("assistant analytics excludes prompt and answer text", () => {
  assert.match(assistant, /trackAnalyticsEvent\("ai_prompt_submitted"/);
  assert.match(assistant, /trackAnalyticsEvent\("ai_response_received"/);
  assert.match(assistant, /ANALYTICS_CATEGORIES/);
  assert.match(assistant, /ANALYTICS_ANSWER_TYPES/);
  assert.match(assistant, /ANALYTICS_CONFIDENCE_LEVELS/);
  assert.doesNotMatch(assistant, /trackAnalyticsEvent\("ai_prompt_submitted",\s*\{[^}]*\b(?:question|answer)\s*:/);
  assert.doesNotMatch(assistant, /trackAnalyticsEvent\("ai_response_received",\s*\{[^}]*\banswer\s*:/);
});