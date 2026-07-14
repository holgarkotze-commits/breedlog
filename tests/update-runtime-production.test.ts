import assert from "node:assert/strict";
import test from "node:test";
import {
  isInstalledBreedLogRuntime,
  isNativeRuntimePlatform,
  resolveApiRequestUrl,
  shouldRegisterPwaServiceWorker,
} from "../client/src/lib/runtime-updates";
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

test("native wrappers rewrite relative API calls to the configured backend origin", () => {
  assert.equal(
    resolveApiRequestUrl("/api/animals", "windows", "https://app.breedlog.test", "tauri://localhost"),
    "https://app.breedlog.test/api/animals",
  );
  assert.equal(
    resolveApiRequestUrl("tauri://localhost/api/version", "windows", "https://app.breedlog.test", "tauri://localhost"),
    "https://app.breedlog.test/api/version",
  );
  assert.equal(
    resolveApiRequestUrl("/api/version", "pwa", "https://app.breedlog.test", "https://app.breedlog.test"),
    "/api/version",
  );
});

test("native runtimes are treated as installed app shells", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  const mockNavigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    standalone: false,
  };

  const mockWindow = {
    __TAURI__: {},
    navigator: mockNavigator,
    matchMedia: () => ({ matches: false }),
    location: { origin: "tauri://localhost" },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: mockWindow,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: mockNavigator,
  });

  try {
    assert.equal(isNativeRuntimePlatform("windows"), true);
    assert.equal(isNativeRuntimePlatform("android"), true);
    assert.equal(isNativeRuntimePlatform("pwa"), false);
    assert.equal(isInstalledBreedLogRuntime(), true);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as typeof globalThis & { window?: unknown }).window;
    }
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete (globalThis as typeof globalThis & { navigator?: unknown }).navigator;
    }
  }
});

test("tauri localhost origin is treated as a native windows shell", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  const mockNavigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    standalone: false,
  };

  const mockWindow = {
    navigator: mockNavigator,
    matchMedia: () => ({ matches: false }),
    location: {
      origin: "https://tauri.localhost",
      hostname: "tauri.localhost",
      protocol: "https:",
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: mockWindow,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: mockNavigator,
  });

  try {
    assert.equal(isInstalledBreedLogRuntime(), true);
    assert.equal(
      resolveApiRequestUrl(
        "https://tauri.localhost/api/version",
        "windows",
        "https://app.breedlog.test",
        "https://tauri.localhost",
      ),
      "https://app.breedlog.test/api/version",
    );
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as typeof globalThis & { window?: unknown }).window;
    }
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete (globalThis as typeof globalThis & { navigator?: unknown }).navigator;
    }
  }
});

test("service workers only register in the pwa runtime", () => {
  assert.equal(shouldRegisterPwaServiceWorker("pwa"), true);
  assert.equal(shouldRegisterPwaServiceWorker("windows"), false);
  assert.equal(shouldRegisterPwaServiceWorker("android"), false);
});
