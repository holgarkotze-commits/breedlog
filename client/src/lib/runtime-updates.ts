import {
  BREEDLOG_ANDROID_VERSION_CODE,
  BREEDLOG_DATA_SCHEMA_VERSION,
  BREEDLOG_RUNTIME_VERSION,
  type BreedLogRuntimePlatform,
} from "@shared/update-runtime";

type ServiceWorkerUpdateState = {
  registration: ServiceWorkerRegistration | null;
  waiting: boolean;
  updateAvailable: boolean;
};

const listeners = new Set<(state: ServiceWorkerUpdateState) => void>();
let state: ServiceWorkerUpdateState = {
  registration: null,
  waiting: false,
  updateAvailable: false,
};
let controllerRefreshTriggered = false;

function publish(next: Partial<ServiceWorkerUpdateState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

function attachRegistration(registration: ServiceWorkerRegistration) {
  const updateWaitingState = () => {
    publish({
      registration,
      waiting: !!registration.waiting,
      updateAvailable: !!registration.waiting,
    });
  };

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        updateWaitingState();
      }
    });
  });

  updateWaitingState();
}

export async function registerBreedLogServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  attachRegistration(registration);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controllerRefreshTriggered) return;
    controllerRefreshTriggered = true;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_ACTIVATED") {
      publish({ registration, waiting: false, updateAvailable: false });
    }
  });
}

export function subscribeToRuntimeUpdates(listener: (state: ServiceWorkerUpdateState) => void) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getRuntimeUpdateSnapshot() {
  return state;
}

export function applyPendingPwaUpdate() {
  state.registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
}

export function detectRuntimePlatform(): BreedLogRuntimePlatform {
  const win = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  if (win.__TAURI__ || win.__TAURI_INTERNALS__) {
    return "windows";
  }
  if (navigator.userAgent.toLowerCase().includes("android")) {
    return "android";
  }
  return "pwa";
}

export function getRuntimeVersionQuery() {
  const platform = detectRuntimePlatform();
  return new URLSearchParams({
    platform,
    currentVersion: BREEDLOG_RUNTIME_VERSION,
    currentDataSchemaVersion: String(BREEDLOG_DATA_SCHEMA_VERSION),
    ...(platform === "android" ? { currentBuildNumber: String(BREEDLOG_ANDROID_VERSION_CODE) } : {}),
    channel: "test",
  }).toString();
}
