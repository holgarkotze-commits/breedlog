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

function normalizeApiOrigin(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

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
  const win = window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown; Capacitor?: unknown };
  const { hostname, protocol } = window.location;
  if (
    win.__TAURI__ ||
    win.__TAURI_INTERNALS__ ||
    protocol === "tauri:" ||
    hostname === "tauri.localhost"
  ) {
    return "windows";
  }
  if (
    protocol === "capacitor:" ||
    Boolean(win.Capacitor)
  ) {
    return "android";
  }
  return "pwa";
}

export function isNativeRuntimePlatform(platform: BreedLogRuntimePlatform) {
  return platform === "windows" || platform === "android";
}

export function isInstalledBreedLogRuntime() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return isStandalone || isNativeRuntimePlatform(detectRuntimePlatform());
}

export function getConfiguredApiOrigin() {
  return normalizeApiOrigin(import.meta.env.VITE_BREEDLOG_API_ORIGIN);
}

export function resolveApiRequestUrl(
  requestUrl: string,
  platform: BreedLogRuntimePlatform,
  apiOrigin = getConfiguredApiOrigin(),
  browserOrigin = window.location.origin,
) {
  if (!apiOrigin || platform === "pwa") {
    return requestUrl;
  }
  if (requestUrl.startsWith("/api/")) {
    return `${apiOrigin}${requestUrl}`;
  }
  if (requestUrl.startsWith(`${browserOrigin}/api/`)) {
    return `${apiOrigin}${requestUrl.slice(browserOrigin.length)}`;
  }
  return requestUrl;
}

export function installNativeApiFetchBridge() {
  const platform = detectRuntimePlatform();
  const apiOrigin = getConfiguredApiOrigin();
  const targetOrigin = window.location.origin;
  const bridgeWindow = window as Window & { __breedlogFetchBridgeInstalled__?: boolean };
  if (!apiOrigin || platform === "pwa" || bridgeWindow.__breedlogFetchBridgeInstalled__) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return originalFetch(resolveApiRequestUrl(input, platform, apiOrigin, targetOrigin), init);
    }
    if (input instanceof URL) {
      return originalFetch(resolveApiRequestUrl(input.toString(), platform, apiOrigin, targetOrigin), init);
    }
    return originalFetch(
      new Request(resolveApiRequestUrl(input.url, platform, apiOrigin, targetOrigin), input),
      init,
    );
  }) as typeof window.fetch;

  bridgeWindow.__breedlogFetchBridgeInstalled__ = true;
}

export function shouldRegisterPwaServiceWorker(platform = detectRuntimePlatform()) {
  return platform === "pwa";
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
