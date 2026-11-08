#!/usr/bin/env node
// Read-only hosted acceptance: no signup, writes, credentials, or farmer data.
const base = (process.env.BREEDLOG_URL || "https://breedlog.replit.app").replace(/\/$/, "");
const timeout = 15000;
let failed = 0;
async function probe(name, path, expected, inspect) {
  try {
    const response = await fetch(base + path, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(timeout), headers: { "Accept": path.startsWith("/api/") ? "application/json" : "text/html" } });
    const body = await response.text();
    const ok = expected.includes(response.status) && (!inspect || inspect(response, body));
    console.log(`${ok ? "PASS" : "FAIL"} ${name}: HTTP ${response.status}`);
    if (!ok) failed++;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    failed++;
  }
}
await probe("landing page", "/", [200], (r, body) => body.includes("<html"));
await probe("registration route", "/auth/register", [200], (r, body) => body.includes("<html"));
await probe("version endpoint", "/api/version", [200], (r, body) => { try { return !!JSON.parse(body); } catch { return false; } });
await probe("anonymous animals denied", "/api/animals", [401, 403]);
console.log(`Hosted read-only smoke: ${failed ? "FAIL" : "PASS"}; ${failed} failed checks. Does not prove real signup, email recovery, billing, or native installers.`);
process.exitCode = failed ? 1 : 0;
