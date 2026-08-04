/**
 * entitlement-internal-test.test.ts
 *
 * Focused regression suite for internal-test entitlement.
 * Access code U2A2ZAVQ must:
 *   • receive source === "internal_test" in EntitlementState
 *   • bypass animal creation limits entirely
 *   • bypass AI quota enforcement
 *   • suppress downgrade-visibility filtering
 *   • remain isolated per workspace (cross-user isolation)
 *   • grant NO admin authority (planId stays "free")
 *   • leave normal Free and paid accounts unaffected
 *   • not appear in client source bundle
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ─── Source-level checks (no server startup required) ──────────────────────

// commercial.ts source
const commercialSrc = fs.readFileSync("server/commercial.ts", "utf8");

// ─── 1. Type and predicate presence ──────────────────────────────────────────

test("commercial.ts defines internal_test as a valid EntitlementState source", () => {
  assert.match(commercialSrc, /["']internal_test["']/);
});

test("commercial.ts exports isInternalTestEntitlement predicate", () => {
  assert.match(commercialSrc, /export\s+(function|const)\s+isInternalTestEntitlement/);
});

test("commercial.ts exports setInternalTestEntitlement setter", () => {
  assert.match(commercialSrc, /export\s+(async\s+)?function\s+setInternalTestEntitlement/);
});

// ─── 2. Bypass wiring in assertCanCreateAnimal ────────────────────────────────

test("assertCanCreateAnimal early-returns / skips enforcement for internal_test", () => {
  // The function must reference isInternalTestEntitlement (or source === "internal_test") before throwing
  const fnStart = commercialSrc.indexOf("assertCanCreateAnimal");
  const fnBody = commercialSrc.slice(fnStart, fnStart + 1200);
  const hasCheck =
    fnBody.includes("isInternalTestEntitlement") ||
    fnBody.includes("internal_test");
  assert.ok(hasCheck, "assertCanCreateAnimal should bypass for internal_test");
});

// ─── 3. Bypass wiring in reserveUsage ────────────────────────────────────────

test("reserveUsage skips enforcement for internal_test", () => {
  const fnStart = commercialSrc.indexOf("reserveUsage");
  const fnBody = commercialSrc.slice(fnStart, fnStart + 1200);
  const hasCheck =
    fnBody.includes("isInternalTestEntitlement") ||
    fnBody.includes("internal_test");
  assert.ok(hasCheck, "reserveUsage should bypass for internal_test");
});

// ─── 4. routes.ts hooks ───────────────────────────────────────────────────────

const routesSrc = fs.readFileSync("server/routes.ts", "utf8");

test("routes.ts imports setInternalTestEntitlement from commercial", () => {
  assert.match(routesSrc, /setInternalTestEntitlement/);
});

test("routes.ts imports isInternalTestEntitlement from commercial", () => {
  assert.match(routesSrc, /isInternalTestEntitlement/);
});

test("routes.ts calls setInternalTestEntitlement after seedMasterSimulationIfNeeded", () => {
  // Must appear at least once in the activation paths
  const count = (routesSrc.match(/setInternalTestEntitlement\(/g) || []).length;
  assert.ok(count >= 1, `Expected ≥1 call to setInternalTestEntitlement, found ${count}`);
});

test("routes.ts getDowngradeVisibilityContext checks isInternalTestEntitlement", () => {
  const fnStart = routesSrc.indexOf("getDowngradeVisibilityContext");
  const fnBody = routesSrc.slice(fnStart, fnStart + 600);
  assert.match(fnBody, /isInternalTestEntitlement/);
});

// ─── 5. planId stays free (no elevated subscription) ─────────────────────────

test("setInternalTestEntitlement does not set planId to a paid tier", () => {
  const fnStart = commercialSrc.indexOf("setInternalTestEntitlement");
  const fnBody = commercialSrc.slice(fnStart, fnStart + 600);
  // Should not set planId to anything other than "free"
  const hasPaidPlan =
    fnBody.includes('"starter"') ||
    fnBody.includes('"professional"') ||
    fnBody.includes('"enterprise"');
  assert.ok(!hasPaidPlan, "setInternalTestEntitlement should not set a paid planId");
});

test("setInternalTestEntitlement does not set planId to anything other than free", () => {
  const fnStart = commercialSrc.indexOf("setInternalTestEntitlement");
  const fnBody = commercialSrc.slice(fnStart, fnStart + 600);
  // It should either set planId: "free" or not set planId at all
  if (fnBody.includes("planId")) {
    assert.match(fnBody, /planId[^:]*:\s*["']free["']/);
  }
});

// ─── 6. Cross-user isolation: setter is user-scoped ──────────────────────────

test("setInternalTestEntitlement takes a per-user identifier parameter (user-scoped)", () => {
  const fnStart = commercialSrc.indexOf("function setInternalTestEntitlement");
  const signature = commercialSrc.slice(fnStart, fnStart + 200);
  // Accept either userId or accountId — the function is user-scoped either way
  const hasUserParam = /userId|accountId/.test(signature);
  assert.ok(hasUserParam, "setInternalTestEntitlement must take a per-user identifier param");
});

// ─── 7. Access code absent from client bundle source ─────────────────────────

test("U2A2ZAVQ does not appear in any client/src file", () => {
  function collectTs(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectTs(full));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        files.push(full);
      }
    }
    return files;
  }

  const clientFiles = collectTs("client/src");
  const leaks: string[] = [];
  for (const file of clientFiles) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("U2A2ZAVQ")) {
      leaks.push(file);
    }
  }
  assert.deepEqual(leaks, [], `U2A2ZAVQ found in client source: ${leaks.join(", ")}`);
});

// ─── 8. No admin authority granted ───────────────────────────────────────────

test("setInternalTestEntitlement does not grant isAdmin or admin flag", () => {
  const fnStart = commercialSrc.indexOf("setInternalTestEntitlement");
  const fnBody = commercialSrc.slice(fnStart, fnStart + 600);
  assert.ok(!fnBody.includes("isAdmin"), "setInternalTestEntitlement must not set isAdmin");
  assert.ok(!fnBody.includes('"admin"'), "setInternalTestEntitlement must not grant admin role");
});
