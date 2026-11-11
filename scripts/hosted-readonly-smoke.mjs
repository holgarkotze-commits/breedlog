#!/usr/bin/env node
// Read-only hosted reachability and API-contract smoke. No signup, writes, credentials or farmer data.
// A 200 SPA shell is NOT evidence that the registration UI renders or that signup works.
const base = (process.env.BREEDLOG_URL || "https://breedlog.replit.app").replace(/\/$/, "");
const timeout = 15000;
let failed = 0;

async function probe(name, path, expected, inspect) {
  try {
    const response = await fetch(base + path, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
      headers: { Accept: path.startsWith("/api/") ? "application/json" : "text/html" },
    });
    const body = await response.text();
    const ok = expected.includes(response.status)
      && (!response.redirected)
      && (!response.headers.get("location"))
      && (!inspect || inspect(response, body));
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: HTTP ${response.status}`);
    if (!ok) failed++;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    failed++;
  }
}

const html = (r, body) => /text\/html/i.test(r.headers.get("content-type") || "")
  && /<html(?:\s|>)/i.test(body);
const validVersion = (r, body) => {
  if (!/application\/json/i.test(r.headers.get("content-type") || "")) return false;
  try {
    const v = JSON.parse(body);
    return v !== null && typeof v === "object" && !Array.isArray(v)
      && typeof v.version === "string" && v.version.trim().length > 0
      && typeof v.buildDate === "string" && v.buildDate.trim().length > 0
      && Number.isInteger(v.dataSchemaVersion) && v.dataSchemaVersion >= 0
      && Number.isInteger(v.androidVersionCode) && v.androidVersionCode >= 0
      && typeof v.serverTime === "string" && Number.isFinite(Date.parse(v.serverTime));
  } catch { return false; }
};

await probe("landing shell reachable (not visual acceptance)", "/", [200], html);
await probe("registration shell reachable (not rendered signup acceptance)", "/auth/register", [200], html);
await probe("version contract", "/api/version", [200], validVersion);
const deniedWithoutData = (r, body) => {
  const type = r.headers.get("content-type") || "";
  if (!/application\/json/i.test(type)) return false;
  let payload;
  try { payload = JSON.parse(body); } catch { return false; }
  if (payload === null || Array.isArray(payload) || typeof payload !== "object") return false;
  // Denial proof must not treat a 401/403 containing animal records as safe.
  const allowed = new Set(["error", "message", "code", "status"]);
  if (!Object.keys(payload).every(key => allowed.has(key))) return false;
  return Object.values(payload).every(value => value === null || ["string", "number", "boolean"].includes(typeof value));
};
await probe("anonymous animals denied without data", "/api/animals", [401, 403], deniedWithoutData);
console.log(`Hosted read-only smoke: ${failed ? "FAIL" : "PASS"}; ${failed} failed checks. Does not prove rendered signup, real registration, email recovery, billing, or native installers.`);
process.exitCode = failed ? 1 : 0;
