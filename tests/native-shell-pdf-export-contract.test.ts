import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");

test("native shell PDF export generates a real PDF blob and saves it through the desktop bridge", () => {
  assert.match(source, /const pdfBlob = await buildAnimalProfilePdfBlob\(/);
  assert.match(source, /const nativePath = await saveFileInNativeDownloads\(pdfBlob, nativeFilename, "application\/pdf"\);/);
});

test("browser fallback downloads the generated PDF without opening a blank preview tab", () => {
  const exportStart = source.indexOf("const handleExportPDF");
  const exportEnd = source.indexOf("/* Legacy HTML print path", exportStart);
  const exportSource = source.slice(exportStart, exportEnd);
  assert.doesNotMatch(exportSource, /window\.open\(/);
  assert.match(exportSource, /const blobUrl = URL\.createObjectURL\(pdfBlob\);/);
  assert.match(source, /anchor\.download = nativeFilename;/);
  assert.match(source, /anchor\.click\(\);/);
});
