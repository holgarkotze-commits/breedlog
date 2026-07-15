import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("windows certification workflow injects the local proof API origin for native shell artifacts", () => {
  const workflow = readFileSync(".github/workflows/windows-build.yml", "utf8");
  assert.match(workflow, /VITE_BREEDLOG_API_ORIGIN:\s*http:\/\/127\.0\.0\.1:5000/);
});

test("android certification workflow injects the local proof API origin for native shell artifacts", () => {
  const workflow = readFileSync(".github/workflows/android-build.yml", "utf8");
  assert.match(workflow, /VITE_BREEDLOG_API_ORIGIN:\s*http:\/\/127\.0\.0\.1:5000/);
});
