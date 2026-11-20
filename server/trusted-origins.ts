// Exact origins of the existing packaged clients. Capacitor Android 8 defaults
// to https://localhost (CapConfig.CAPACITOR_HTTPS_SCHEME).
const NATIVE_APP_ORIGINS = new Set([
  "http://tauri.localhost", "https://tauri.localhost", "tauri://localhost",
  "capacitor://localhost", "http://localhost", "https://localhost",
]);

export function isNativeAppOrigin(origin: string | undefined): boolean {
  return !!origin && NATIVE_APP_ORIGINS.has(origin);
}

export function resolveCorsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  if (origin === "https://breedlog.stitchworx.net" || isNativeAppOrigin(origin)) return origin;
  const configured = (process.env.BREEDLOG_CORS_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  return configured.includes(origin) ? origin : null;
}
