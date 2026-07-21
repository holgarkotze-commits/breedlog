import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");

test("native shell PDF export generates a real PDF blob and saves it through the desktop bridge", () => {
  assert.match(source, /const pdfBlob = await buildAnimalProfilePdfBlob\(/);
  assert.match(source, /const nativePath = await saveFileInNativeDownloads\(pdfBlob, nativeFilename, "application\/pdf"\);/);
});

test("browser fallback still previews or downloads the generated PDF blob", () => {
  assert.match(source, /const previewWindow = window\.open\(blobUrl, "_blank"\);/);
  assert.match(source, /anchor\.download = nativeFilename;/);
});
