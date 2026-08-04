/**
 * Focused regression tests for the Kimi K3 AI upgrade.
 *
 * Tests cover:
 *  - Kimi configuration contract
 *  - Request parameter contract (no unsupported sampling params)
 *  - Reasoning effort selection
 *  - Memory storage, isolation, capacity and persistence
 *  - Provider fallback chain
 *  - Prompt quality (health / breeding / app-help rules)
 *  - Quota controls (internal-test bypass + normal cap + rate limiter)
 *  - Safety: reasoning_content never appears in public API responses
 *
 * All provider calls use mocks — no live Kimi calls from the test suite.
 */

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// 1. KIMI CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────

describe("Kimi configuration", () => {
  const configSrc = fs.readFileSync("server/ai/ai-config.ts", "utf8");
  const kimiSrc   = fs.readFileSync("server/ai/kimi-provider.ts", "utf8");

  test("KIMI_K3_API is used server-side in ai-config.ts", () => {
    assert.match(configSrc, /KIMI_K3_API/);
  });

  test("default Kimi base URL is https://api.moonshot.ai/v1", () => {
    assert.match(configSrc, /https:\/\/api\.moonshot\.ai\/v1/);
  });

  test("default Kimi model is kimi-k3", () => {
    assert.match(configSrc, /kimi-k3/);
  });

  test("kimi-provider.ts uses OpenAI SDK (not a new package)", () => {
    assert.match(kimiSrc, /from\s+["']openai["']/);
  });

  test("KIMI_K3_API secret absent from client source bundle", () => {
    // Check that no client-side file contains the literal secret name as an env lookup
    const clientFiles = findClientFiles("client/src");
    const violations: string[] = [];
    for (const f of clientFiles) {
      const content = fs.readFileSync(f, "utf8");
      if (content.includes("KIMI_K3_API") || content.includes("process.env.KIMI")) {
        violations.push(f);
      }
    }
    assert.deepEqual(violations, [], `Client files must not access KIMI_K3_API: ${violations.join(", ")}`);
  });

  test("kimi-provider.ts does not log the API key", () => {
    assert.doesNotMatch(kimiSrc, /console\.(log|info|warn|error).*apiKey/);
    assert.doesNotMatch(kimiSrc, /console\.(log|info|warn|error).*KIMI_K3_API/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. REQUEST CONTRACT
// ────────────────────────────────────────────────────────────────────────────

describe("Kimi request contract", () => {
  const kimiSrc = fs.readFileSync("server/ai/kimi-provider.ts", "utf8");

  test("kimi-provider uses chat completions (not generateContent)", () => {
    assert.match(kimiSrc, /chat\.completions\.create/);
  });

  test("max_completion_tokens: 4096 is set", () => {
    // Value is in KIMI_CONFIG.maxCompletionTokens (config) and referenced in the provider
    const configSrc2 = fs.readFileSync("server/ai/ai-config.ts", "utf8");
    assert.match(configSrc2, /maxCompletionTokens:\s*4096/);
    assert.match(kimiSrc, /max_completion_tokens:\s*KIMI_CONFIG\.maxCompletionTokens/);
  });

  test("reasoning_effort is passed to the request", () => {
    assert.match(kimiSrc, /reasoning_effort/);
  });

  test("response_format json_schema is requested", () => {
    assert.match(kimiSrc, /json_schema/);
  });

  test("temperature is NOT sent", () => {
    // Must not appear as a parameter in the request params object
    assert.doesNotMatch(kimiSrc, /params\.temperature|["']temperature["']\s*:/);
  });

  test("top_p is NOT sent", () => {
    assert.doesNotMatch(kimiSrc, /params\.top_p|["']top_p["']\s*:/);
  });

  test("presence_penalty is NOT sent", () => {
    assert.doesNotMatch(kimiSrc, /presence_penalty\s*:/);
  });

  test("frequency_penalty is NOT sent", () => {
    assert.doesNotMatch(kimiSrc, /frequency_penalty\s*:/);
  });

  test("reasoning_content is never parsed as the final answer", () => {
    // The provider must read message.content, not reasoning_content, as the text
    assert.doesNotMatch(kimiSrc, /rawText.*reasoning_content/);
    // rawText or ok.text must come from content
    assert.match(kimiSrc, /message\.content/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. REASONING EFFORT SELECTION
// ────────────────────────────────────────────────────────────────────────────

describe("Reasoning effort selection", () => {
  // Import via dynamic require to avoid module resolution issues in test env
  let selectReasoningEffort: (category?: string | null) => string;

  before(async () => {
    const mod = await import("../server/ai/ai-provider.js");
    selectReasoningEffort = mod.selectReasoningEffort;
  });

  test("app-help category selects low reasoning effort", () => {
    assert.equal(selectReasoningEffort("app-help"), "low");
  });

  test("health-records category selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort("health-records"), "high");
  });

  test("breeding-lambing category selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort("breeding-lambing"), "high");
  });

  test("herd-overview category selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort("herd-overview"), "high");
  });

  test("null/undefined category selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort(null), "high");
    assert.equal(selectReasoningEffort(undefined), "high");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. MEMORY
// ────────────────────────────────────────────────────────────────────────────

describe("AI chat memory", () => {
  let loadMemory: (s: any, uid: string) => Promise<any[]>;
  let appendExchange: (s: any, uid: string, ex: any) => Promise<void>;
  let clearMemory: (s: any, uid: string) => Promise<void>;
  let buildHistoryMessages: (exchanges: any[]) => any[];
  let toPublicHistory: (exchanges: any[]) => any[];
  let MAX_EXCHANGES: number;

  before(async () => {
    const mod = await import("../server/ai/ai-chat-memory.js");
    loadMemory = mod.loadMemory;
    appendExchange = mod.appendExchange;
    clearMemory = mod.clearMemory;
    buildHistoryMessages = mod.buildHistoryMessages;
    toPublicHistory = mod.toPublicHistory;
    MAX_EXCHANGES = mod.MAX_EXCHANGES;
  });

  function makeStorage() {
    const store: Record<string, string> = {};
    return {
      getSystemSetting: async (k: string) => store[k] ?? null,
      setSystemSetting: async (k: string, v: string) => { store[k] = v; },
      deleteSystemSetting: async (k: string) => { delete store[k]; },
    };
  }

  function makeExchange(question: string, answer: string, reasoning = ""): any {
    return {
      userMessage: question,
      providerMessage: {
        role: "assistant",
        content: `{"answer":"${answer}","answerType":"data","confidence":"high","usedData":[],"warnings":[],"suggestedNextQuestions":[]}`,
        ...(reasoning ? { reasoning_content: reasoning } : {}),
      },
      parsedAnswer: {
        answer,
        answerType: "data",
        confidence: "high",
        usedData: [],
        warnings: [],
        suggestedNextQuestions: [],
      },
      category: "herd-overview",
      timestamp: new Date().toISOString(),
    };
  }

  test("MAX_EXCHANGES is 5", () => {
    assert.equal(MAX_EXCHANGES, 5);
  });

  test("empty storage returns empty array", async () => {
    const storage = makeStorage();
    const result = await loadMemory(storage, "user-1");
    assert.deepEqual(result, []);
  });

  test("a successful exchange is stored", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "user-1", makeExchange("How many ewes?", "You have 10 ewes."));
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].userMessage, "How many ewes?");
  });

  test("five exchanges are retained", async () => {
    const storage = makeStorage();
    for (let i = 1; i <= 5; i++) {
      await appendExchange(storage, "user-1", makeExchange(`Q${i}`, `A${i}`));
    }
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded.length, 5);
  });

  test("sixth exchange removes the oldest", async () => {
    const storage = makeStorage();
    for (let i = 1; i <= 6; i++) {
      await appendExchange(storage, "user-1", makeExchange(`Q${i}`, `A${i}`));
    }
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded.length, 5, "should have exactly 5 exchanges");
    assert.equal(loaded[0].userMessage, "Q2", "oldest (Q1) should have been evicted");
    assert.equal(loaded[4].userMessage, "Q6", "newest (Q6) should be present");
  });

  test("memory survives a new provider/memory object instance (storage-backed)", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "user-1", makeExchange("Persistent?", "Yes."));
    // Simulate new instance by calling loadMemory with same storage
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].userMessage, "Persistent?");
  });

  test("User A cannot read User B's history", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "user-A", makeExchange("User A question", "A answer"));
    const bHistory = await loadMemory(storage, "user-B");
    assert.equal(bHistory.length, 0, "User B must see empty history");
  });

  test("authenticated user ID controls the storage key", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "my-user-id", makeExchange("Q", "A"));
    const keys = Object.keys((storage as any)._store ?? {});
    // Check via a direct lookup
    const stored = await storage.getSystemSetting("breedlog:ai-memory:my-user-id");
    assert.notEqual(stored, null, "must be keyed by user ID");
  });

  test("clearMemory removes all exchanges for user", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "user-1", makeExchange("Q1", "A1"));
    await clearMemory(storage, "user-1");
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded.length, 0);
  });

  test("clearMemory only clears the target user", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "user-1", makeExchange("Q1", "A1"));
    await appendExchange(storage, "user-2", makeExchange("Q2", "A2"));
    await clearMemory(storage, "user-1");
    const u2 = await loadMemory(storage, "user-2");
    assert.equal(u2.length, 1, "user-2 data must be unaffected");
  });

  test("malformed stored memory fails safely and resets", async () => {
    const storage = makeStorage();
    await storage.setSystemSetting("breedlog:ai-memory:user-1", "NOT_JSON{{{{");
    const loaded = await loadMemory(storage, "user-1");
    assert.deepEqual(loaded, [], "malformed memory must return empty array");
  });

  test("full Kimi assistant messages are preserved server-side", async () => {
    const storage = makeStorage();
    const ex = makeExchange("Q", "A", "internal chain of thought");
    await appendExchange(storage, "user-1", ex);
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded[0].providerMessage.reasoning_content, "internal chain of thought");
  });

  test("reasoning_content does not appear in toPublicHistory output", () => {
    const exchanges = [makeExchange("Q1", "A1", "secret thinking"), makeExchange("Q2", "A2")];
    const pub = toPublicHistory(exchanges);
    const serialised = JSON.stringify(pub);
    assert.doesNotMatch(serialised, /reasoning_content/, "reasoning_content must not appear in public history");
    assert.doesNotMatch(serialised, /secret thinking/, "reasoning text must not appear in public history");
  });

  test("GET history returns visible content only (no reasoning_content)", () => {
    const exchanges = [makeExchange("Question?", "Answer.", "private reasoning")];
    const pub = toPublicHistory(exchanges);
    assert.equal(pub.length, 1);
    assert.equal(pub[0].question, "Question?");
    assert.equal(pub[0].answer, "Answer.");
    const keys = Object.keys(pub[0]);
    assert.ok(!keys.includes("reasoning_content"), "public exchange must not include reasoning_content");
    assert.ok(!keys.includes("providerMessage"), "public exchange must not include raw providerMessage");
  });

  test("buildHistoryMessages preserves reasoning_content for Kimi continuity", () => {
    const exchanges = [makeExchange("Q", "A", "think step by step")];
    const msgs = buildHistoryMessages(exchanges);
    // Should be [user, assistant]
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, "user");
    assert.equal(msgs[1].role, "assistant");
    assert.equal((msgs[1] as any).reasoning_content, "think step by step");
  });

  test("current farm context is not stored in memory exchanges", async () => {
    const storage = makeStorage();
    // The exchange only stores userMessage (the farmer's question), not the full context JSON
    const ex = makeExchange("What are my lamb counts?", "You have 5 lambs.");
    await appendExchange(storage, "user-1", ex);
    const loaded = await loadMemory(storage, "user-1");
    assert.doesNotMatch(
      JSON.stringify(loaded[0].userMessage),
      /FULL BREEDLOG CONTEXT/,
      "Farm context JSON must not be stored in the userMessage field",
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. PROVIDER FALLBACK (source-code contract)
// ────────────────────────────────────────────────────────────────────────────

describe("Provider fallback chain", () => {
  const orchestratorSrc = fs.readFileSync("server/ai/ai-provider.ts", "utf8");
  const routesSrc = fs.readFileSync("server/ai/breedlog-ai-routes.ts", "utf8");

  test("orchestrator tries Kimi before Gemini", () => {
    const kimiPos = orchestratorSrc.indexOf("askKimi(");
    const geminiPos = orchestratorSrc.indexOf("generateGeminiContent(");
    assert.ok(kimiPos < geminiPos, "Kimi call must appear before Gemini call in orchestrator");
  });

  test("orchestrator has a local-fallback path", () => {
    assert.match(routesSrc, /generateLocalFallback/);
  });

  test("raw provider errors are not returned to client", () => {
    // The route file must not pass error.message directly to res.json
    assert.doesNotMatch(routesSrc, /res\.json\(.*result\.error/);
    assert.doesNotMatch(orchestratorSrc, /safeMessage.*apiKey|apiKey.*safeMessage/);
  });

  test("Gemini provider is retained (not deleted)", () => {
    assert.ok(fs.existsSync("server/ai/gemini-provider.ts"));
  });

  test("local fallback module is retained", () => {
    assert.ok(fs.existsSync("server/ai/local-fallback.ts"));
  });

  test("canary does not reveal credentials", () => {
    const canarySrc = fs.readFileSync("server/ai/kimi-provider.ts", "utf8");
    // canary response must not include apiKey
    assert.doesNotMatch(canarySrc, /reachable.*apiKey|apiKey.*reachable/);
    // health/canary routes must not return apiKey
    assert.doesNotMatch(routesSrc, /res\.json\(.*apiKey/);
  });

  test("Kimi success prevents Gemini fallback (code path)", () => {
    // When Kimi returns ok:true the orchestrator returns immediately
    const afterKimiOk = orchestratorSrc.slice(
      orchestratorSrc.indexOf("result.ok") + 1,
      orchestratorSrc.indexOf("result.ok") + 300,
    );
    assert.match(afterKimiOk, /return\s*\{/, "should return immediately on Kimi success");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. PROMPT QUALITY
// ────────────────────────────────────────────────────────────────────────────

describe("Prompt quality — system prompt rules", () => {
  const rules = fs.readFileSync("server/ai/breedlog-ai-rules.ts", "utf8");

  test("health rules prohibit diagnosis as fact", () => {
    // DO NOT section lists "Diagnose a condition as confirmed fact"
    assert.match(rules, /Diagnose a condition as (confirmed )?fact|do not diagnose/i);
  });

  test("health rules prohibit invented dosage", () => {
    // "Prescribe medication or recommend dosage you have not seen in this farmer's own records"
    assert.match(rules, /Prescribe medication.*recommend dosage|invent.*dosage|invent.*medication/i);
  });

  test("health rules prohibit claiming healthy without records", () => {
    // "Claim an animal is healthy merely because no health record exists for it"
    assert.match(rules, /healthy merely because no health record|no health record exists/i);
  });

  test("breeding rules require recorded evidence", () => {
    assert.match(rules, /recorded evidence|actual recorded/i);
  });

  test("breeding rules require disclosure of missing data", () => {
    assert.match(rules, /missing data|clearly state missing/i);
  });

  test("prompt distinguishes three knowledge sources", () => {
    assert.match(rules, /three knowledge sources|THREE KNOWLEDGE SOURCES/i);
  });

  test("prompt requires separation of general husbandry from farm-record conclusions", () => {
    assert.match(rules, /General husbandry guidance|general husbandry/i);
  });

  test("system prompt retains JSON response format requirement", () => {
    assert.match(rules, /answerType/);
    assert.match(rules, /suggestedNextQuestions/);
  });

  test("system prompt includes answerType values: help, data, hybrid, unsupported", () => {
    assert.match(rules, /help.*data.*hybrid.*unsupported|help | data | hybrid | unsupported/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. QUOTA CONTROLS
// ────────────────────────────────────────────────────────────────────────────

describe("Quota and rate-limit controls", () => {
  const routesSrc = fs.readFileSync("server/ai/breedlog-ai-routes.ts", "utf8");
  const commercialSrc = fs.readFileSync("server/commercial.ts", "utf8");

  test("chat route still calls reserveUsage for plan AI quota", () => {
    assert.match(routesSrc, /reserveUsage\(.*aiActions/);
  });

  test("internal-test entitlement bypasses plan AI quota (via isInternalTestEntitlement)", () => {
    assert.match(commercialSrc, /isInternalTestEntitlement/);
    // reserveUsage must short-circuit for internal_test source
    const reserveUsageFn = commercialSrc.slice(
      commercialSrc.indexOf("export async function reserveUsage"),
      commercialSrc.indexOf("export async function reserveUsage") + 400,
    );
    assert.match(reserveUsageFn, /isInternalTestEntitlement|internal_test/);
  });

  test("short-window rate limiter is present and applies to all users", () => {
    assert.match(routesSrc, /checkRateLimit/);
    assert.match(routesSrc, /RATE_LIMIT\s*=\s*20/);
    assert.match(routesSrc, /RATE_WINDOW_MS\s*=\s*60_000|RATE_WINDOW_MS\s*=\s*60000/);
  });

  test("rate limiter is applied before entitlement check in the route", () => {
    const rateLimitPos = routesSrc.indexOf("checkRateLimit(");
    const reservePos = routesSrc.indexOf("reserveUsage(");
    assert.ok(rateLimitPos < reservePos, "rate limit check must come before entitlement reservation");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. SAFETY — reasoning_content never in API responses
// ────────────────────────────────────────────────────────────────────────────

describe("reasoning_content safety", () => {
  const routesSrc = fs.readFileSync("server/ai/breedlog-ai-routes.ts", "utf8");
  const memorySrc = fs.readFileSync("server/ai/ai-chat-memory.ts", "utf8");

  test("breedlog-ai-routes.ts never sends reasoning_content in res.json", () => {
    assert.doesNotMatch(routesSrc, /res\.json\(.*reasoning_content/);
  });

  test("toPublicHistory strips reasoning_content", () => {
    assert.match(memorySrc, /toPublicHistory/);
    // The public output fields must not include reasoning_content
    const fnBody = memorySrc.slice(
      memorySrc.indexOf("export function toPublicHistory"),
      memorySrc.indexOf("export function toPublicHistory") + 600,
    );
    assert.doesNotMatch(fnBody, /reasoning_content/);
  });

  test("history endpoint returns only safe fields", () => {
    assert.match(routesSrc, /\/api\/ai\/history/);
    assert.match(routesSrc, /toPublicHistory/);
  });

  test("DELETE /api/ai/history clears only the current user", () => {
    // Must use getUserId(req) as the key, not a client-supplied value
    const deleteRoute = routesSrc.slice(
      routesSrc.indexOf("DELETE /api/ai/history") > 0
        ? routesSrc.indexOf("DELETE /api/ai/history")
        : routesSrc.indexOf("app.delete"),
      routesSrc.indexOf("app.delete") + 500,
    );
    assert.match(deleteRoute, /getUserId|userId/);
    assert.match(deleteRoute, /clearMemory/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. ACCOUNT PURGE — AI memory deleted on account deletion
// ────────────────────────────────────────────────────────────────────────────

describe("Account purge clears AI memory", () => {
  test("purgeCommercialState deletes the AI memory key", () => {
    const commercialSrc = fs.readFileSync("server/commercial.ts", "utf8");
    assert.match(commercialSrc, /breedlog:ai-memory/);
    assert.match(commercialSrc, /deleteSystemSetting.*breedlog:ai-memory|breedlog:ai-memory.*deleteSystemSetting/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 10. UI CHANGES — chat panel source checks
// ────────────────────────────────────────────────────────────────────────────

describe("Chat UI source checks", () => {
  const uiSrc = fs.readFileSync("client/src/components/BreedLogAssistantPanel.tsx", "utf8");

  test("UI calls GET /api/ai/history when panel opens", () => {
    assert.match(uiSrc, /\/api\/ai\/history/);
    assert.match(uiSrc, /fetchHistory/);
  });

  test("UI provides a clear conversation action", () => {
    assert.match(uiSrc, /clear-history|clearHistory|Clear conversation|deleteHistory/i);
  });

  test("UI calls DELETE /api/ai/history", () => {
    // deleteHistory() uses method: "DELETE" against /api/ai/history
    assert.match(uiSrc, /method:\s*["']DELETE["']/);
    assert.match(uiSrc, /\/api\/ai\/history/);
  });

  test("UI shows memory note for the user", () => {
    assert.match(uiSrc, /remembers your last 5 exchanges/i);
  });

  test("UI does not store reasoning_content in client state", () => {
    assert.doesNotMatch(uiSrc, /reasoning_content/);
  });

  test("UI does not expose provider internals to the user", () => {
    // Must not render raw providerMessage or reasoning_content
    assert.doesNotMatch(uiSrc, /providerMessage/);
  });

  test("UI shows model name where status label exists", () => {
    assert.match(uiSrc, /ai-model-label|response\.model/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────────────────────

function findClientFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findClientFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}
