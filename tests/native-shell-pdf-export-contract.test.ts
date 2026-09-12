import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");

test("native shell PDF export generates a real PDF blob and saves it through the desktop bridge", () => {
  assert.match(source, /const pdfBlob = await buildAnimalProfilePdfBlob\(/);
  assert.match(source, /const nativePath = await saveFileInNativeDownloads\(pdfBlob, nativeFilename, "application\/pdf"\);/);
});

test("browser fallback still previews or downloads the generated PDF blob", () => {
  const preOpenIndex = source.indexOf('const previewWindow = window.open("", "_blank");');
  const buildIndex = source.indexOf("const pdfBlob = await buildAnimalProfilePdfBlob(");
  assert.ok(preOpenIndex >= 0, "PDF preview window should open synchronously");
  assert.ok(preOpenIndex < buildIndex, "PDF preview window must open before asynchronous PDF generation");
  assert.match(source, /previewWindow\.location\.href = blobUrl;/);
  assert.match(source, /anchor\.download = nativeFilename;/);
});
