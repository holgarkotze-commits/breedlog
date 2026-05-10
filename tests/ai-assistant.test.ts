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

  test("returns structured response or 503 (not configured) — quota errors produce 200 with fallback, not 502", async () => {
    const res = await post("/api/ai/chat", {
      question: "Summarize my herd.",
      category: "herd-overview",
    });

    if (res.status === 503) {
      // Not configured — acceptable
      const body = await res.json() as { configured: boolean; error: string };
      assert.equal(body.configured, false, "503 must indicate not configured");
      assert.ok(typeof body.error === "string", "503 must have error message");
    } else if (res.status === 200) {
      // Success — either live Gemini answer or local fallback for quota errors
      const body = await res.json() as {
        answer: string;
        confidence: string;
        usedData: unknown[];
        warnings: unknown[];
        suggestedNextQuestions: unknown[];
        isFallback?: boolean;
      };
      assert.ok(typeof body.answer === "string" && body.answer.length > 0, "must have non-empty answer");
      assert.ok(
        ["high", "medium", "low", "insufficient"].includes(body.confidence),
        "confidence must be valid",
      );
      assert.ok(Array.isArray(body.usedData), "usedData must be array");
      assert.ok(Array.isArray(body.warnings), "warnings must be array");
      assert.ok(Array.isArray(body.suggestedNextQuestions), "suggestedNextQuestions must be array");
      // When using local fallback, answer must NOT contain raw API error JSON
      assert.ok(!body.answer.includes("RESOURCE_EXHAUSTED"), "answer must not expose raw API error");
      assert.ok(!body.answer.includes('"error"'), "answer must not expose raw JSON error field");
    } else if (res.status === 502) {
      // Non-quota provider error (timeout, auth, etc.) — must have clean message
      const body = await res.json() as { error: string };
      assert.ok(typeof body.error === "string", "502 must have error message");
      assert.ok(body.error.length < 300, "502 error must be short user-facing message, not raw JSON");
      assert.ok(!body.error.includes("RESOURCE_EXHAUSTED"), "502 must not expose raw API error codes");
      assert.ok(!body.error.includes("{"), "502 must not expose JSON in user-facing error");
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

// ── Health — quota status fields ────────────────────────────────────────────

describe("AI Assistant — /api/ai/health quota status fields", () => {
  test("health endpoint returns quotaExhausted and fallbackActive fields", async () => {
    const res = await get("/api/ai/health", false);
    assert.equal(res.status, 200);
    const body = await res.json() as Record<string, unknown>;
    assert.ok("quotaExhausted" in body, "must have quotaExhausted field");
    assert.ok("fallbackActive" in body, "must have fallbackActive field");
    assert.ok("providerStatus" in body, "must have providerStatus field");
    assert.ok(typeof body.quotaExhausted === "boolean", "quotaExhausted must be boolean");
    assert.ok(typeof body.fallbackActive === "boolean", "fallbackActive must be boolean");
    const validStatuses = ["available", "quota_exhausted", "not_configured", "unavailable"];
    assert.ok(
      validStatuses.includes(body.providerStatus as string),
      `providerStatus must be one of: ${validStatuses.join(", ")}`,
    );
  });

  test("when quota is not exhausted, fallbackActive must be false (or AI not configured)", async () => {
    const res = await get("/api/ai/health", false);
    const body = await res.json() as { configured: boolean; quotaExhausted: boolean; fallbackActive: boolean };
    // fallbackActive should only be true when configured AND quota is exhausted
    if (!body.configured) {
      assert.equal(body.fallbackActive, false, "fallbackActive must be false when not configured");
    } else if (!body.quotaExhausted) {
      assert.equal(body.fallbackActive, false, "fallbackActive must be false when quota not exhausted");
    }
  });
});

// ── Local Fallback (unit — no server needed) ─────────────────────────────────

describe("AI Local Fallback — generateLocalFallback (unit)", () => {
  // Build a minimal context for testing
  async function makeCtx(overrides: Partial<import("../server/ai/breedlog-ai-context.ts").BreedLogAIContext> = {}) {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const base = buildBreedLogAIContext({
      animals: [],
      breedingEvents: [],
      performanceRecords: [],
      healthRecords: [],
      flockHealthEvents: [],
      matingGroups: [],
      farmSettings: undefined,
    });
    return { ...base, ...overrides };
  }

  async function fallback(question: string, category?: string) {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const ctx = await makeCtx();
    return generateLocalFallback(question, ctx, category);
  }

  test("always returns isFallback: true", async () => {
    const result = await fallback("Summarize my herd.");
    assert.equal(result.isFallback, true, "isFallback must always be true");
  });

  test("herd-overview returns valid structure", async () => {
    const result = await fallback("Summarize my herd.", "herd-overview");
    assert.ok(typeof result.answer === "string" && result.answer.length > 0, "must have non-empty answer");
    assert.ok(Array.isArray(result.usedData), "usedData must be array");
    assert.ok(Array.isArray(result.warnings), "warnings must be array");
    assert.ok(Array.isArray(result.suggestedNextQuestions), "suggestedNextQuestions must be array");
    assert.ok(
      ["high", "medium", "low", "insufficient"].includes(result.confidence),
      "confidence must be valid",
    );
  });

  test("data-quality returns valid structure", async () => {
    const result = await fallback("How complete is my herd data?", "data-quality");
    assert.equal(result.isFallback, true);
    assert.ok(typeof result.answer === "string" && result.answer.length > 0);
    assert.ok(result.answer.toLowerCase().includes("data quality") || result.answer.toLowerCase().includes("score"), "should mention data quality");
  });

  test("sire-performance returns valid structure (empty = insufficient)", async () => {
    const result = await fallback("Which ram is performing best?", "sire-performance");
    assert.equal(result.isFallback, true);
    assert.ok(typeof result.answer === "string" && result.answer.length > 0);
    // Empty data should return insufficient confidence
    assert.equal(result.confidence, "insufficient", "no sires = insufficient confidence");
  });

  test("health returns valid structure (empty = insufficient)", async () => {
    const result = await fallback("How is my herd's health?", "health");
    assert.equal(result.isFallback, true);
    assert.ok(typeof result.answer === "string" && result.answer.length > 0);
    assert.equal(result.confidence, "insufficient", "no health records = insufficient");
  });

  test("priority list returns valid structure", async () => {
    const result = await fallback("What needs my attention first?", "priority");
    assert.equal(result.isFallback, true);
    assert.ok(typeof result.answer === "string" && result.answer.length > 0);
    assert.equal(result.confidence, "high", "priority list always returns high confidence");
  });

  test("question keyword detection — 'ram' maps to sire-performance", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const ctx = await makeCtx();
    const result = generateLocalFallback("Which ram appears to be performing best?", ctx);
    assert.equal(result.isFallback, true);
    // Should be sire-performance (no data → insufficient)
    assert.equal(result.confidence, "insufficient");
  });

  test("question keyword detection — 'attention' maps to priority", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const ctx = await makeCtx();
    const result = generateLocalFallback("What needs my attention first?", ctx);
    assert.equal(result.isFallback, true);
    assert.equal(result.confidence, "high", "priority always returns high confidence");
  });

  test("question keyword detection — 'how many animals' maps to herd-overview", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const ctx = await makeCtx();
    const result = generateLocalFallback("How many animals do I have and how are they distributed?", ctx);
    assert.equal(result.isFallback, true);
    // herd with 0 animals → insufficient or low
    assert.ok(["insufficient", "low", "medium"].includes(result.confidence));
  });

  test("answer never contains raw API JSON or error codes", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const ctx = await makeCtx();
    const questions = [
      "Summarize my herd.",
      "Which ram appears to be performing best?",
      "How complete is my herd data?",
      "What needs my attention first?",
    ];
    for (const q of questions) {
      const result = generateLocalFallback(q, ctx);
      assert.ok(!result.answer.includes("RESOURCE_EXHAUSTED"), `answer must not contain RESOURCE_EXHAUSTED for: ${q}`);
      assert.ok(!result.answer.includes('"error"'), `answer must not contain JSON error field for: ${q}`);
      assert.ok(!result.answer.includes("quota"), `answer must not mention quota for: ${q}`);
    }
  });

  test("fallback with real herd data produces high-confidence herd overview", async () => {
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");

    const baseAnimal = {
      userId: "u1", rawTag: null, tattooId: null, electronicId: null,
      studPrefix: null, name: null, breed: null, classification: "stud" as const,
      photo: null, lambStatus: null, ramLambClass: null,
      birthDate: "2022-01-01", currentWeight: null, weight100DayDate: null,
      birthStatus: null, lambingSeason: null, notes: null, clientId: null, vectorClock: null,
      lastSyncedAt: null, cullConfirmed: null, cullReason: null, cullNotes: null,
      cullDate: null, culledAt: null, isCulled: null, deathDate: null, deathCause: null,
      deathNotes: null, createdAt: new Date(), updatedAt: new Date(),
      sireId: null, damId: null, birthWeight: null, weight100Day: null,
      status: "active" as const,
    };
    const animals = Array.from({ length: 12 }, (_, i) => ({
      ...baseAnimal,
      id: i + 1,
      tagId: `TAG-${String(i + 1).padStart(3, "0")}`,
      sex: (i < 3 ? "ram" : "ewe") as "ram" | "ewe",
    }));
    const ctx = buildBreedLogAIContext({
      animals, breedingEvents: [], performanceRecords: [],
      healthRecords: [], flockHealthEvents: [], matingGroups: [], farmSettings: undefined,
    });
    const result = generateLocalFallback("Summarize my herd.", ctx, "herd-overview");
    assert.equal(result.isFallback, true);
    assert.equal(result.confidence, "high", "12 animals should produce high confidence");
    assert.ok(result.answer.includes("12"), "answer should mention total animal count");
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

// ── AI Config & Model Chain (unit) ───────────────────────────────────────────

describe("AI Config — model chain & shared config", () => {
  test("AI_CONFIG exposes a single source of truth", async () => {
    const mod = await import("../server/ai/ai-config.ts");
    assert.ok("apiKey" in mod.AI_CONFIG, "must expose apiKey");
    assert.ok("primaryModel" in mod.AI_CONFIG, "must expose primaryModel");
    assert.ok(Array.isArray(mod.AI_CONFIG.fallbackModels), "fallbackModels must be array");
    assert.equal(mod.AI_CONFIG.provider, "gemini");
  });

  test("getModelChain returns primary first, then fallbacks, deduplicated", async () => {
    const { getModelChain, AI_CONFIG } = await import("../server/ai/ai-config.ts");
    const chain = getModelChain();
    assert.ok(chain.length >= 1, "chain must have at least one model");
    assert.equal(chain[0], AI_CONFIG.primaryModel, "primary model must be first");
    assert.equal(new Set(chain).size, chain.length, "chain must be deduplicated");
  });

  test("default chain prefers a free-tier-available 2.5 model (no 1.5 deprecated models)", async () => {
    const { getModelChain } = await import("../server/ai/ai-config.ts");
    const chain = getModelChain();
    const has25 = chain.some((m) => m.includes("2.5") || m.includes("2.0"));
    assert.ok(has25, "default chain must include a 2.x model");
    // 1.5-flash was deprecated; chain must not contain only deprecated models
    const onlyDeprecated = chain.every((m) => m === "gemini-1.5-flash" || m === "gemini-1.5-flash-8b");
    assert.equal(onlyDeprecated, false, "chain must not consist entirely of deprecated models");
  });
});

// ── Health endpoint exposes model chain & active model ───────────────────────

describe("AI Assistant — /api/ai/health model diagnostics", () => {
  test("health endpoint exposes modelChain and activeModel fields", async () => {
    const res = await get("/api/ai/health", false);
    const body = await res.json() as Record<string, unknown>;
    assert.ok("modelChain" in body, "must expose modelChain");
    assert.ok(Array.isArray(body.modelChain), "modelChain must be array");
    assert.ok((body.modelChain as string[]).length >= 1, "modelChain must not be empty");
    assert.ok("activeModel" in body, "must expose activeModel (null until first success)");
  });
});

// ── Canary endpoint ──────────────────────────────────────────────────────────

describe("AI Assistant — /api/ai/canary", () => {
  test("canary endpoint returns honest provider reachability", async () => {
    const res = await get("/api/ai/canary", false);
    // 200 when configured (reachable or not), 503 when key missing
    assert.ok(res.status === 200 || res.status === 503, `expected 200 or 503, got ${res.status}`);
    const body = await res.json() as Record<string, unknown>;
    assert.ok("configured" in body, "must expose configured flag");
    assert.ok("reachable" in body, "must expose reachable flag");
    assert.ok("message" in body, "must expose human-readable message");
    if (body.configured) {
      assert.ok("modelChain" in body, "must expose modelChain when configured");
    }
  });
});

// ── Local fallback is category-specific (regression for "always herd overview") ─

describe("AI Local Fallback — category-specific answers", () => {
  test("sire-performance category produces sire/ram-focused answer", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const ctx = buildBreedLogAIContext({
      animals: [], breedingEvents: [], performanceRecords: [],
      healthRecords: [], flockHealthEvents: [], matingGroups: [], farmSettings: undefined,
    });
    const result = generateLocalFallback("Which ram is performing best?", ctx, "sire-performance");
    const lower = result.answer.toLowerCase();
    assert.ok(
      lower.includes("ram") || lower.includes("sire"),
      `sire-performance answer must mention ram/sire, got: ${result.answer.slice(0,200)}`,
    );
  });

  test("data-quality category produces data-quality-focused answer", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const ctx = buildBreedLogAIContext({
      animals: [], breedingEvents: [], performanceRecords: [],
      healthRecords: [], flockHealthEvents: [], matingGroups: [], farmSettings: undefined,
    });
    const result = generateLocalFallback("How complete is my herd data?", ctx, "data-quality");
    const lower = result.answer.toLowerCase();
    assert.ok(
      lower.includes("data") || lower.includes("complete") || lower.includes("missing") || lower.includes("quality"),
      `data-quality answer must mention data/completeness, got: ${result.answer.slice(0,200)}`,
    );
  });

  test("priority/attention question routes to priority handler, not herd overview", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const ctx = buildBreedLogAIContext({
      animals: [], breedingEvents: [], performanceRecords: [],
      healthRecords: [], flockHealthEvents: [], matingGroups: [], farmSettings: undefined,
    });
    const result = generateLocalFallback("What needs my attention first?", ctx);
    const lower = result.answer.toLowerCase();
    assert.ok(
      lower.includes("attention") || lower.includes("priority") || lower.includes("action") ||
      lower.includes("first") || lower.includes("focus"),
      `priority answer must be action-oriented, got: ${result.answer.slice(0,200)}`,
    );
  });

  test("fallback never leaks raw provider JSON or 'error' tokens", async () => {
    const { generateLocalFallback } = await import("../server/ai/local-fallback.ts");
    const { buildBreedLogAIContext } = await import("../server/ai/breedlog-ai-context.ts");
    const ctx = buildBreedLogAIContext({
      animals: [], breedingEvents: [], performanceRecords: [],
      healthRecords: [], flockHealthEvents: [], matingGroups: [], farmSettings: undefined,
    });
    for (const cat of ["herd-overview", "sire-performance", "ewe-performance", "lamb-growth",
                       "reproductive", "health", "data-quality"]) {
      const r = generateLocalFallback("test question", ctx, cat);
      assert.ok(!r.answer.includes('{"error"'), `${cat}: must not contain raw error JSON`);
      assert.ok(!r.answer.includes("RESOURCE_EXHAUSTED"), `${cat}: must not leak provider error codes`);
      assert.ok(!r.answer.includes("ai.google.dev"), `${cat}: must not leak provider URLs`);
    }
  });
});
