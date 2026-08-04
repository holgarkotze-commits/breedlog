/**
 * Privacy & public-content regression tests.
 *
 * Proves:
 * - Public legal pages contain no personal/test references.
 * - Generic client defaults contain no personal/test data (Haka, Kwantam, phone numbers).
 * - The simulation access code and batch marker are absent from the client bundle.
 * - A new user receives an empty workspace (no simulation animals).
 * - Cross-user data isolation: user A cannot read user B's animals.
 * - Export note sanitisation strips internal simulation markers.
 * - Legal document type remains correctly typed (no reviewStatus field leaked).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ============================================================
// 1. Legal document content — no personal/test references
// ============================================================

// We import the legal document definitions directly (pure data module).
import { LEGAL_DOCUMENTS } from "../client/src/content/legal";

const PROHIBITED_IN_LEGAL = [
  /\bHaka\b/i,
  /\bHolgar\b/i,
  /\bKotze\b/i,
  /0814229602/,
  /U2A2ZAVQ/,
  /\bKwantam\b/i,
  /KWANTAM_SIMULATION/i,
  /master simulation/i,
  /simulation access code/i,
  /professional legal review/i,
  /implementation draft/i,
  /draft for.*review/i,
];

for (const [key, doc] of Object.entries(LEGAL_DOCUMENTS)) {
  test(`legal/${key}: title contains no prohibited personal/test references`, () => {
    for (const pattern of PROHIBITED_IN_LEGAL) {
      assert.ok(!pattern.test(doc.title), `"${doc.title}" matched prohibited pattern ${pattern} in title`);
      assert.ok(!pattern.test(doc.subtitle), `"${doc.subtitle}" matched prohibited pattern ${pattern} in subtitle`);
    }
  });

  test(`legal/${key}: body paragraphs contain no prohibited personal/test references`, () => {
    for (const section of doc.sections) {
      for (const para of section.body) {
        for (const pattern of PROHIBITED_IN_LEGAL) {
          assert.ok(!pattern.test(para), `paragraph "${para.slice(0, 80)}…" matched prohibited pattern ${pattern} in ${key}`);
        }
      }
    }
  });
}

test("legal documents do not carry a reviewStatus field", () => {
  for (const [key, doc] of Object.entries(LEGAL_DOCUMENTS)) {
    assert.ok(!("reviewStatus" in doc), `legal/${key} still carries reviewStatus field — must be removed`);
  }
});

// ============================================================
// 2. OnboardingWizard — no Kwantam placeholder
// ============================================================

test("OnboardingWizard.tsx does not use Kwantam as a placeholder example", () => {
  const src = fs.readFileSync("client/src/components/OnboardingWizard.tsx", "utf8");
  assert.ok(!/kwantam/i.test(src), "OnboardingWizard.tsx must not reference 'Kwantam' as a placeholder farm name");
});

// ============================================================
// 3. Settings page — no developer-internal legal status text
// ============================================================

test("Settings.tsx does not contain 'implementation drafts' or 'professional legal review'", () => {
  const src = fs.readFileSync("client/src/pages/Settings.tsx", "utf8");
  assert.ok(!/implementation draft/i.test(src), "Settings.tsx must not use 'implementation drafts' language visible to users");
  assert.ok(!/professional legal review/i.test(src), "Settings.tsx must not surface 'professional legal review' to users");
});

// ============================================================
// 4. AI knowledge corpus — no internal test context names
// ============================================================

test("breedlog-knowledge.ts does not reference 'Kwantam' or the field-test context by name", () => {
  const src = fs.readFileSync("shared/breedlog-knowledge.ts", "utf8");
  assert.ok(!/kwantam/i.test(src), "AI knowledge corpus must not expose internal test farm name 'Kwantam'");
  assert.ok(!/field.test context/i.test(src), "AI knowledge corpus must not reference 'field-test context' by name");
});

// ============================================================
// 5. Client source tree — no direct exposure of access code or batch marker
// ============================================================

const CLIENT_SRC = "client/src";

function walkSync(dir: string, results: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSync(full, results);
    else if (entry.isFile() && /\.(ts|tsx|js)$/.test(entry.name)) results.push(full);
  }
  return results;
}

test("client/src does not import or embed the simulation access code (U2A2ZAVQ)", () => {
  const files = walkSync(CLIENT_SRC);
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    assert.ok(!/U2A2ZAVQ/i.test(src), `${f} must not contain the simulation access code`);
  }
});

test("client/src does not import shared/master-simulation", () => {
  const files = walkSync(CLIENT_SRC);
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    assert.ok(!/master-simulation/.test(src), `${f} must not import master-simulation (server-only module)`);
  }
});

test("client/src does not hardcode personal names (Haka, Holgar, Kotze) or phone number", () => {
  const files = walkSync(CLIENT_SRC);
  const patterns = [/\bHaka\b/i, /\bHolgar\b/i, /\bKotze\b/i, /0814229602/];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    for (const p of patterns) {
      assert.ok(!p.test(src), `${f} must not hardcode personal data matching ${p}`);
    }
  }
});

// ============================================================
// 6. Production bundle scan (runs only when dist/ exists)
// ============================================================

const DIST_DIR = "dist/public";
const bundleExists = fs.existsSync(DIST_DIR);

const maybeTest = bundleExists ? test : test.skip;

maybeTest("production bundle does not contain the simulation access code (U2A2ZAVQ)", () => {
  const jsFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith(".js")).map(f => path.join(DIST_DIR, f));
  for (const f of jsFiles) {
    const content = fs.readFileSync(f, "utf8");
    assert.ok(!/U2A2ZAVQ/.test(content), `${f} contains the simulation access code — it must never reach the browser bundle`);
  }
});

maybeTest("production bundle does not contain the internal simulation batch marker", () => {
  const jsFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith(".js")).map(f => path.join(DIST_DIR, f));
  for (const f of jsFiles) {
    const content = fs.readFileSync(f, "utf8");
    assert.ok(!/KWANTAM_SIMULATION_2022_TO_2026_V1/.test(content), `${f} contains internal simulation batch marker`);
  }
});

// ============================================================
// 7. Export note sanitisation
// ============================================================

import { sanitizePublicNote } from "../client/src/lib/export-template";

test("sanitizePublicNote strips KWANTAM_SIMULATION_* markers from exported notes", () => {
  const raw = "Good growth rate. KWANTAM_SIMULATION_2022_TO_2026_V1 Internal note.";
  const cleaned = sanitizePublicNote(raw);
  assert.ok(!cleaned.includes("KWANTAM_SIMULATION_"), "KWANTAM_SIMULATION marker must be removed from exported notes");
  assert.ok(cleaned.includes("Good growth rate"), "Legitimate farmer content must be preserved");
});

test("sanitizePublicNote does not strip legitimate farmer content", () => {
  const raw = "Healthy ewe. Good weight gain at 100-day weigh.";
  const cleaned = sanitizePublicNote(raw);
  assert.equal(cleaned.trim(), raw.trim(), "Legitimate notes must pass through unchanged");
});

// ============================================================
// 8. New user isolation — in-memory storage
// ============================================================

import { InMemoryStorage } from "../server/storage";

test("a new user workspace contains zero animals (no simulation bleed)", async () => {
  const store = new InMemoryStorage();
  const animals = await store.getAnimals("brand-new-user-id", {});
  assert.equal(animals.length, 0, "New workspace must be empty — no simulation animals must bleed in");
});

test("cross-user isolation: user A cannot read user B's animals", async () => {
  const store = new InMemoryStorage();
  await store.createAnimal("user-A", {
    tagId: "A001", rawTag: "A001", name: "UserA Animal",
    sex: "ewe", status: "active", classification: "commercial",
  } as any);
  const animals = await store.getAnimals("user-B", {});
  assert.equal(animals.length, 0, "User B must not see User A's animals");
  const aAnimals = await store.getAnimals("user-A", {});
  assert.equal(aAnimals.length, 1, "User A must see their own animal");
});
