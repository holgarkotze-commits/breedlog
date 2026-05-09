import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const PORT = "5051";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TEST_USER_ID = "ai-test-user-001";
const TEST_DEVICE_ID = "ai-test-device-001";

const AUTH_HEADERS = {
  "x-test-user-id": TEST_USER_ID,
  "x-test-device-id": TEST_DEVICE_ID,
};

let server: ChildProcessWithoutNullStreams | null = null;
let logs = "";

async function waitForServer(timeoutMs = 25_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/version`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Test server did not become ready. Logs:\n${logs}`);
}

before(async () => {
  server = spawn("./node_modules/.bin/tsx", ["server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      USE_IN_MEMORY_STORAGE: "1",
      PORT,
      ADMIN_PIN: "1234",
    },
    detached: true,
  });
  server.stdout.on("data", (c: Buffer) => (logs += c.toString()));
  server.stderr.on("data", (c: Buffer) => (logs += c.toString()));
  await waitForServer();
});

after(() => {
  if (server && !server.killed) {
    try { process.kill(-server.pid!, "SIGTERM"); } catch { /* noop */ }
  }
});

async function get(path: string, auth = true) {
  return fetch(`${BASE_URL}${path}`, {
    headers: auth ? AUTH_HEADERS : {},
  });
}

async function post(path: string, body: unknown, auth = true) {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? AUTH_HEADERS : {}),
    },
    body: JSON.stringify(body),
  });
}

// ── Health ──────────────────────────────────────────────────────────────────

describe("AI Assistant — /api/ai/health", () => {
  test("returns 200 with configured field", async () => {
    const res = await get("/api/ai/health", false);
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.ok("configured" in body, "response must have 'configured' field");
    assert.ok(typeof body.configured === "boolean", "'configured' must be a boolean");
  });

  test("does NOT expose GEMINI_API_KEY value or name in response", async () => {
    const res = await get("/api/ai/health", false);
    const text = await res.text();
    const key = process.env.GEMINI_API_KEY || "";
    if (key.length > 4) {
      assert.ok(!text.includes(key), "API key value must not appear in health response");
    }
    assert.ok(!text.includes("GEMINI_API_KEY"), "key env-var name must not be leaked");
  });

  test("health endpoint does not require authentication", async () => {
    const res = await get("/api/ai/health", false);
    assert.notEqual(res.status, 401, "health must be publicly accessible");
  });
});

// ── Suggested prompts ───────────────────────────────────────────────────────

describe("AI Assistant — /api/ai/suggested-prompts", () => {
  test("returns 401 when unauthenticated", async () => {
    const res = await get("/api/ai/suggested-prompts", false);
    assert.equal(res.status, 401);
  });

  test("returns categories array for authenticated users", async () => {
    const res = await get("/api/ai/suggested-prompts");
    assert.equal(res.status, 200);
    const body = await res.json() as { categories: Array<{ key: string; label: string; prompts: string[] }> };
    assert.ok(Array.isArray(body.categories), "must return categories array");
    assert.ok(body.categories.length >= 5, "must have at least 5 categories");
  });

  test("each category has key, label, and non-empty prompts", async () => {
    const res = await get("/api/ai/suggested-prompts");
    const body = await res.json() as { categories: Array<{ key: string; label: string; prompts: string[] }> };
    for (const cat of body.categories) {
      assert.ok(typeof cat.key === "string" && cat.key.length > 0, "category must have key");
      assert.ok(typeof cat.label === "string" && cat.label.length > 0, "category must have label");
      assert.ok(Array.isArray(cat.prompts) && cat.prompts.length > 0, "category must have prompts");
    }
  });

  test("includes required farming categories", async () => {
    const res = await get("/api/ai/suggested-prompts");
    const body = await res.json() as { categories: Array<{ key: string }> };
    const keys = body.categories.map((c) => c.key);
    const required = ["herd-overview", "sire-performance", "ewe-maternal", "lamb-growth", "data-quality"];
    for (const k of required) {
      assert.ok(keys.includes(k), `must include category: ${k}`);
    }
  });
});

// ── Context summary ─────────────────────────────────────────────────────────

describe("AI Assistant — /api/ai/context-summary", () => {
  test("returns 401 when unauthenticated", async () => {
    const res = await get("/api/ai/context-summary", false);
    assert.equal(res.status, 401);
  });

  test("returns context summary for authenticated users", async () => {
    const res = await get("/api/ai/context-summary");
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.ok("animalsCount" in body, "must have animalsCount");
    assert.ok("breedingEventsCount" in body, "must have breedingEventsCount");
    assert.ok("hasData" in body, "must have hasData");
    assert.ok(typeof body.animalsCount === "number", "animalsCount must be a number");
  });

  test("context summary does not expose userId or token", async () => {
    const res = await get("/api/ai/context-summary");
    const body = await res.json() as Record<string, unknown>;
    assert.ok(!("userId" in body), "must not expose userId");
    assert.ok(!("token" in body), "must not expose token");
  });
});

// ── Chat ────────────────────────────────────────────────────────────────────

describe("AI Assistant — /api/ai/chat", () => {
  test("returns 401 when unauthenticated", async () => {
    const res = await post("/api/ai/chat", { question: "How many animals do I have?" }, false);
    assert.equal(res.status, 401);
  });

  test("rejects missing question (empty body)", async () => {
    const res = await post("/api/ai/chat", {});
    assert.ok(
      res.status === 400 || res.status === 503,
      `expected 400 or 503, got ${res.status}`,
    );
  });

  test("rejects question exceeding 1000 characters", async () => {
    const res = await post("/api/ai/chat", { question: "A".repeat(1001) });
    assert.ok(
      res.status === 400 || res.status === 503,
      `expected 400 or 503, got ${res.status}`,
    );
  });

  test("rejects unknown category", async () => {
    const res = await post("/api/ai/chat", {
      question: "Test question",
      category: "not-a-real-category-xyz",
    });
    assert.ok(
      res.status === 400 || res.status === 503,
      `expected 400 or 503, got ${res.status}`,
    );
  });

  test("returns structured response or 503 when AI not configured", async () => {
    const res = await post("/api/ai/chat", {
      question: "Summarize my herd.",
      category: "herd-overview",
    });

    if (res.status === 503) {
      const body = await res.json() as { configured: boolean; error: string };
      assert.equal(body.configured, false, "503 must indicate not configured");
      assert.ok(typeof body.error === "string", "503 must have error message");
    } else if (res.status === 200) {
      const body = await res.json() as {
        answer: string;
        confidence: string;
        usedData: unknown[];
        warnings: unknown[];
        suggestedNextQuestions: unknown[];
      };
      assert.ok(typeof body.answer === "string", "must have answer string");
      assert.ok(
        ["high", "medium", "low", "insufficient"].includes(body.confidence),
        "confidence must be valid",
      );
      assert.ok(Array.isArray(body.usedData), "usedData must be array");
      assert.ok(Array.isArray(body.warnings), "warnings must be array");
      assert.ok(Array.isArray(body.suggestedNextQuestions), "suggestedNextQuestions must be array");
    } else {
      assert.fail(`Unexpected status ${res.status}: ${await res.text()}`);
    }
  });

  test("does not mutate animal data (read-only invariant)", async () => {
    const animalsBefore = await get("/api/animals");
    const countBefore = ((await animalsBefore.json()) as unknown[]).length;

    await post("/api/ai/chat", { question: "How many rams do I have?" });

    const animalsAfter = await get("/api/animals");
    const countAfter = ((await animalsAfter.json()) as unknown[]).length;
    assert.equal(countAfter, countBefore, "AI chat must not mutate animal data");
  });

  test("validates animalId must be a positive integer", async () => {
    const res = await post("/api/ai/chat", {
      question: "Tell me about this animal.",
      animalId: -1,
    });
    assert.ok(
      res.status === 400 || res.status === 503,
      `expected 400 or 503 for negative animalId, got ${res.status}`,
    );
  });
});

// ── Context Builder (unit) ───────────────────────────────────────────────────

describe("AI Context Builder — breedlog-ai-context.ts (unit)", () => {
  test("buildBreedLogAIContext produces valid shape on empty input", async () => {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const ctx = buildBreedLogAIContext({
      animals: [],
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      flockHealthEvents: [],
      matingGroups: [],
      farmSettings: undefined,
    });
    assert.equal(ctx.herd.total, 0);
    assert.equal(ctx.herd.rams, 0);
    assert.equal(ctx.herd.ewes, 0);
    assert.equal(ctx.herd.lambs, 0);
    assert.equal(ctx.reproductive.ewesJoined, 0);
    assert.equal(ctx.health.totalAnimalRecords, 0);
    assert.equal(ctx.workspace.dataQualityScore, 0);
    assert.ok(ctx.workspace.dataQualityWarnings.length > 0, "should warn about no animals");
  });

  test("buildBreedLogAIContext counts rams and ewes correctly", async () => {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const baseAnimal = {
      userId: "u1", rawTag: null, tattooId: null, electronicId: null,
      studPrefix: null, name: null, breed: null, classification: null, status: "active" as const,
      photo: null, lambStatus: null, ramLambClass: null,
      birthDate: "2022-01-01", currentWeight: null, weight100DayDate: null,
      birthStatus: null, lambingSeason: null, notes: null, clientId: null, vectorClock: null,
      lastSyncedAt: null, cullConfirmed: null, cullReason: null, cullNotes: null,
      cullDate: null, culledAt: null, isCulled: null, deathDate: null, deathCause: null,
      deathNotes: null, createdAt: new Date(), updatedAt: new Date(),
      sireId: null, damId: null, birthWeight: null, weight100Day: null,
    };
    const animals = [
      { ...baseAnimal, id: 1, sex: "ram" as const, tagId: "RAM-01" },
      { ...baseAnimal, id: 2, sex: "ewe" as const, tagId: "EWE-01" },
      { ...baseAnimal, id: 3, sex: "ewe" as const, tagId: "EWE-02" },
    ];
    const ctx = buildBreedLogAIContext({
      animals,
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      flockHealthEvents: [],
      matingGroups: [],
      farmSettings: undefined,
    });
    assert.equal(ctx.herd.rams, 1);
    assert.equal(ctx.herd.ewes, 2);
    assert.equal(ctx.herd.total, 3);
  });

  test("buildBreedLogAIContext isolates to provided animals (workspace safety)", async () => {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const ctx = buildBreedLogAIContext({
      animals: [],
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      flockHealthEvents: [],
      matingGroups: [],
      farmSettings: undefined,
    });
    assert.equal(ctx.herd.total, 0);
    assert.equal(ctx.sires.length, 0);
    assert.equal(ctx.ewes.active, 0);
  });

  test("buildBreedLogAIContext computes sire performance correctly", async () => {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const base = {
      userId: "u1", rawTag: null, tattooId: null, electronicId: null,
      studPrefix: null, name: null, breed: null, classification: null, status: "active" as const,
      photo: null, lambStatus: null, ramLambClass: null,
      birthDate: "2023-01-01", currentWeight: null, weight100DayDate: null,
      birthStatus: null, lambingSeason: null, notes: null, clientId: null, vectorClock: null,
      lastSyncedAt: null, cullConfirmed: null, cullReason: null, cullNotes: null,
      cullDate: null, culledAt: null, isCulled: null, deathDate: null, deathCause: null,
      deathNotes: null, createdAt: new Date(), updatedAt: new Date(),
    };
    const sire = { ...base, id: 1, sex: "ram" as const, tagId: "RAM-001", sireId: null, damId: null, birthWeight: null, weight100Day: null };
    const lamb1 = { ...base, id: 2, sex: "ewe" as const, tagId: "LAMB-01", sireId: 1, damId: null, birthWeight: "4.5", weight100Day: "28" };
    const lamb2 = { ...base, id: 3, sex: "ram" as const, tagId: "LAMB-02", sireId: 1, damId: null, birthWeight: "5.0", weight100Day: "32" };
    const ctx = buildBreedLogAIContext({
      animals: [sire, lamb1, lamb2],
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      flockHealthEvents: [],
      matingGroups: [],
      farmSettings: undefined,
    });
    assert.equal(ctx.sires.length, 1);
    assert.equal(ctx.sires[0].tag, "RAM-001");
    assert.equal(ctx.sires[0].offspring, 2);
    assert.ok(ctx.sires[0].avgBirthWeight !== null, "avgBirthWeight should be computed");
  });

  test("buildBreedLogAIContext includes selectedAnimal when animalId provided", async () => {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const animal = {
      id: 42, userId: "u1", tagId: "TEST-42", rawTag: null, tattooId: null, electronicId: null,
      studPrefix: null, name: null, breed: null, classification: null, status: "active" as const,
      photo: null, lambStatus: null, ramLambClass: null, sex: "ewe" as const,
      birthDate: null, birthWeight: null, currentWeight: null, weight100Day: null,
      weight100DayDate: null, birthStatus: null, lambingSeason: null, sireId: null, damId: null,
      notes: null, clientId: null, vectorClock: null, lastSyncedAt: null, cullConfirmed: null,
      cullReason: null, cullNotes: null, cullDate: null, culledAt: null, isCulled: null,
      deathDate: null, deathCause: null, deathNotes: null, createdAt: new Date(), updatedAt: new Date(),
    };
    const ctx = buildBreedLogAIContext({
      animals: [animal],
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      flockHealthEvents: [],
      matingGroups: [],
      farmSettings: undefined,
      animalId: 42,
    });
    assert.ok(ctx.selectedAnimal, "should include selectedAnimal");
    assert.equal(ctx.selectedAnimal!.tagId, "TEST-42");
    assert.ok(ctx.selectedAnimal!.missingFields.includes("birth date"), "should flag missing birth date");
    assert.ok(ctx.selectedAnimal!.missingFields.includes("birth weight"), "should flag missing birth weight");
  });

  test("buildBreedLogAIContext data quality score is 0 when no animals", async () => {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const ctx = buildBreedLogAIContext({
      animals: [],
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      flockHealthEvents: [],
      matingGroups: [],
      farmSettings: undefined,
    });
    assert.equal(ctx.workspace.dataQualityScore, 0);
  });
});
