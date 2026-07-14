export type BreedLogRuntimePlatform = "pwa" | "windows" | "android";

export type RuntimeInstallAction =
  | "none"
  | "reload"
  | "download_and_restart"
  | "store_update";

export type RuntimeUpdateChannel = "stable" | "test";

export type RuntimeUpdateState = {
  platform: BreedLogRuntimePlatform;
  currentVersion: string;
  availableVersion: string;
  minimumSupportedVersion: string;
  currentDataSchemaVersion: number;
  availableDataSchemaVersion: number;
  minimumSupportedDataSchemaVersion: number;
  updateAvailable: boolean;
  updateRequired: boolean;
  installAction: RuntimeInstallAction;
  reason:
    | "up_to_date"
    | "new_version_available"
    | "schema_too_old"
    | "version_too_old";
  channel: RuntimeUpdateChannel;
  testAdapter: boolean;
  windows?: {
    signedUpdates: boolean;
    manifestVersion: string;
    availableDisplayVersion: string;
  };
  android?: {
    availableVersionCode: number;
    minimumSupportedVersionCode: number;
    playManagedUpdates: boolean;
  };
};

export const BREEDLOG_RUNTIME_VERSION = "1.0.2";
export const BREEDLOG_RUNTIME_BUILD_DATE = "2026-07-14";
export const BREEDLOG_DATA_SCHEMA_VERSION = 4;
export const BREEDLOG_MIN_SUPPORTED_DATA_SCHEMA_VERSION = 4;
export const BREEDLOG_WINDOWS_UPDATE_MANIFEST_VERSION = "1";
export const BREEDLOG_ANDROID_VERSION_CODE = 2;
export const BREEDLOG_ANDROID_MIN_SUPPORTED_VERSION_CODE = 2;
export const BREEDLOG_DEFAULT_UPDATE_CHANNEL: RuntimeUpdateChannel = "test";

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    value
      .split(/[^0-9]+/)
      .filter(Boolean)
      .map((part) => Number.parseInt(part, 10));
  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

export function evaluateRuntimeUpdateState(input: {
  platform: BreedLogRuntimePlatform;
  currentVersion: string;
  currentDataSchemaVersion?: number;
  currentBuildNumber?: number;
  channel?: RuntimeUpdateChannel;
}): RuntimeUpdateState {
  const currentDataSchemaVersion = input.currentDataSchemaVersion ?? BREEDLOG_DATA_SCHEMA_VERSION;
  const channel = input.channel ?? BREEDLOG_DEFAULT_UPDATE_CHANNEL;
  const base: RuntimeUpdateState = {
    platform: input.platform,
    currentVersion: input.currentVersion,
    availableVersion: BREEDLOG_RUNTIME_VERSION,
    minimumSupportedVersion:
      input.platform === "windows" ? "1.0.0"
      : input.platform === "android" ? "1.0.0"
      : "1.0.0",
    currentDataSchemaVersion,
    availableDataSchemaVersion: BREEDLOG_DATA_SCHEMA_VERSION,
    minimumSupportedDataSchemaVersion: BREEDLOG_MIN_SUPPORTED_DATA_SCHEMA_VERSION,
    updateAvailable: false,
    updateRequired: false,
    installAction:
      input.platform === "pwa" ? "reload"
      : input.platform === "windows" ? "download_and_restart"
      : "store_update",
    reason: "up_to_date",
    channel,
    testAdapter: channel === "test",
    ...(input.platform === "windows" ? {
      windows: {
        signedUpdates: false,
        manifestVersion: BREEDLOG_WINDOWS_UPDATE_MANIFEST_VERSION,
        availableDisplayVersion: BREEDLOG_RUNTIME_VERSION,
      },
    } : {}),
    ...(input.platform === "android" ? {
      android: {
        availableVersionCode: BREEDLOG_ANDROID_VERSION_CODE,
        minimumSupportedVersionCode: BREEDLOG_ANDROID_MIN_SUPPORTED_VERSION_CODE,
        playManagedUpdates: true,
      },
    } : {}),
  };

  if (currentDataSchemaVersion < BREEDLOG_MIN_SUPPORTED_DATA_SCHEMA_VERSION) {
    return {
      ...base,
      updateRequired: true,
      updateAvailable: true,
      reason: "schema_too_old",
    };
  }

  if (compareVersions(input.currentVersion, base.minimumSupportedVersion) < 0) {
    return {
      ...base,
      updateRequired: true,
      updateAvailable: true,
      reason: "version_too_old",
    };
  }

  if (compareVersions(input.currentVersion, BREEDLOG_RUNTIME_VERSION) < 0) {
    return {
      ...base,
      updateAvailable: true,
      reason: "new_version_available",
    };
  }
  return base;
}
