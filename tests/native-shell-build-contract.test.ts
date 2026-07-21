import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("windows certification workflow pins native candidates to the authenticated BreedLog app origin", () => {
  const workflow = readFileSync(".github/workflows/windows-build.yml", "utf8");
  assert.match(workflow, /BREEDLOG_NATIVE_BUILD_TARGET:\s*windows/);
  assert.match(workflow, /VITE_BREEDLOG_API_ORIGIN:\s*https:\/\/app\.breedlog\.com/);
  assert.doesNotMatch(workflow, /VITE_BREEDLOG_API_ORIGIN:\s*http:\/\/127\.0\.0\.1:5000/);
});

test("android certification workflow pins native candidates to the authenticated BreedLog app origin", () => {
  const workflow = readFileSync(".github/workflows/android-build.yml", "utf8");
  assert.match(workflow, /BREEDLOG_NATIVE_BUILD_TARGET:\s*android/);
  assert.match(workflow, /VITE_BREEDLOG_API_ORIGIN:\s*https:\/\/app\.breedlog\.com/);
  assert.doesNotMatch(workflow, /VITE_BREEDLOG_API_ORIGIN:\s*http:\/\/127\.0\.0\.1:5000/);
});

test("native build script fails closed when the production app origin contract is missing or local", () => {
  const script = readFileSync("script/build.ts", "utf8");
  assert.match(script, /BREEDLOG_NATIVE_BUILD_TARGET/);
  assert.match(script, /VITE_BREEDLOG_API_ORIGIN/);
  assert.match(script, /https:\/\/app\.breedlog\.com/);
  assert.match(script, /must not target localhost/);
});

test("tauri keeps localhost in dev-only config and excludes it from release config", () => {
  const releaseConfig = readFileSync("src-tauri/tauri.conf.json", "utf8");
  const devConfig = readFileSync("src-tauri/tauri.dev.conf.json", "utf8");
  const packageJson = readFileSync("package.json", "utf8");
  assert.doesNotMatch(releaseConfig, /127\.0\.0\.1:5000/);
  assert.match(devConfig, /127\.0\.0\.1:5000/);
  assert.match(packageJson, /tauri dev --config src-tauri\/tauri\.dev\.conf\.json/);
});

test("android release signing is only enabled when the full secret set is present", () => {
  const workflow = readFileSync(".github/workflows/android-build.yml", "utf8");
  const gradle = readFileSync("android/app/build.gradle", "utf8");
  assert.match(workflow, /ANDROID_KEYSTORE_BASE64/);
  assert.match(workflow, /ANDROID_KEYSTORE_PASSWORD/);
  assert.match(workflow, /ANDROID_KEY_ALIAS/);
  assert.match(workflow, /ANDROID_KEY_PASSWORD/);
  assert.match(workflow, /partially configured/);
  assert.match(workflow, /apksigner verify --print-certs/);
  assert.match(workflow, /Remove temporary Android release keystore/);
  assert.match(gradle, /BREEDLOG_ANDROID_SIGNING_ENABLED/);
  assert.match(gradle, /signingConfigs/);
  assert.match(gradle, /GradleException/);
});
