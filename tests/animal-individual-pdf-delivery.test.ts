import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");
const exportStart = source.indexOf("const handleExportPDF");
const exportEnd = source.indexOf("/* Legacy HTML print path", exportStart);
const exportSource = source.slice(exportStart, exportEnd);

test("individual animal PDF respects quota recording without opening a blank preview", () => {
  assert.match(exportSource, /const pdfBlob = await buildAnimalProfilePdfBlob\(/);
  assert.match(exportSource, /await createExportedDoc\.mutateAsync\(/);
  assert.match(exportSource, /URL\.createObjectURL\(pdfBlob\)/);
  assert.doesNotMatch(exportSource, /window\.open\(/);
  assert.match(exportSource, /anchor\.download = nativeFilename/);
});