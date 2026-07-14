import assert from "node:assert/strict";
import test from "node:test";
import {
  BREEDLOG_ANDROID_VERSION_CODE,
  BREEDLOG_DATA_SCHEMA_VERSION,
  BREEDLOG_RUNTIME_VERSION,
  compareVersions,
  evaluateRuntimeUpdateState,
} from "../shared/update-runtime";

test("runtime version comparison is deterministic for multi-part versions", () => {
  assert.equal(compareVersions("1.0.2", "1.0.2"), 0);
  assert.equal(compareVersions("1.0.10", "1.0.2"), 1);
  assert.equal(compareVersions("1.0.1", "1.0.2"), -1);
});

test("pwa update state requires upgrade when schema is too old", () => {
  const state = evaluateRuntimeUpdateState({
    platform: "pwa",
    currentVersion: "1.0.2",
    currentDataSchemaVersion: BREEDLOG_DATA_SCHEMA_VERSION - 1,
  });
  assert.equal(state.updateRequired, true);
  assert.equal(state.reason, "schema_too_old");
  assert.equal(state.installAction, "reload");
});

test("windows update state exposes unsigned certification boundary", () => {
  const state = evaluateRuntimeUpdateState({
    platform: "windows",
    currentVersion: "1.0.0",
    currentDataSchemaVersion: BREEDLOG_DATA_SCHEMA_VERSION,
  });
  assert.equal(state.updateAvailable, true);
  assert.equal(state.reason, "new_version_available");
  assert.equal(state.windows?.signedUpdates, false);
});

test("android update state reports play-managed adapter boundaries", () => {
  const state = evaluateRuntimeUpdateState({
    platform: "android",
    currentVersion: BREEDLOG_RUNTIME_VERSION,
    currentDataSchemaVersion: BREEDLOG_DATA_SCHEMA_VERSION,
    currentBuildNumber: BREEDLOG_ANDROID_VERSION_CODE,
  });
  assert.equal(state.updateAvailable, false);
  assert.equal(state.android?.availableVersionCode, BREEDLOG_ANDROID_VERSION_CODE);
  assert.equal(state.android?.playManagedUpdates, true);
});
