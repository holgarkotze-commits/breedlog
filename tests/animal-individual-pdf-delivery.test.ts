import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");
const exportStart = source.indexOf("const handleExportPDF");
const exportEnd = source.indexOf("/* Legacy HTML print path", exportStart);
const exportSource = source.slice(exportStart, exportEnd);

test("individual animal PDF delivery is not blocked by export-history recording", () => {
  assert.match(exportSource, /const pdfBlob = await buildAnimalProfilePdfBlob\(/);
  assert.doesNotMatch(exportSource, /await createExportedDoc\.mutateAsync\(/);
  assert.match(
    exportSource,
    /void createExportedDoc\.mutateAsync\([\s\S]*?\)\.catch\(/,
  );
  assert.match(exportSource, /URL\.createObjectURL\(pdfBlob\)/);
});