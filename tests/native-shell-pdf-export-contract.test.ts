import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("client/src/pages/AnimalDetail.tsx", "utf8");

test("native shell PDF export opens the print window before async work begins", () => {
  const openIndex = source.indexOf('const printWindow = window.open("", "_blank");');
  const photoFetchIndex = source.indexOf("const resp = await fetch(animal.photo);");
  assert.notEqual(openIndex, -1);
  assert.notEqual(photoFetchIndex, -1);
  assert.ok(openIndex < photoFetchIndex);
});

test("native shell PDF export reuses the pre-opened window for the rendered datasheet", () => {
  assert.match(source, /printWindow\.location\.href = blobUrl;/);
});
