/**
 * Focused regression tests for the Groq GPT-OSS 120B AI upgrade.
 *
 * Tests cover:
 *  - Groq configuration contract (key variables, base URL, model, SDK reuse)
 *  - Request parameter contract (no unsupported sampling params, include_reasoning: false)
 *  - Strict JSON schema output contract
 *  - Reasoning effort selection (low / medium / high)
 *  - Provider chain order (Groq → Gemini → local fallback; Kimi not called)
 *  - Memory still works with Groq (five-exchange, isolation, reasoning never public)
 *  - Security (unauthenticated calls cannot invoke Groq, no keys or raw errors returned)
 *  - Quota controls (free-account cap + internal-test bypass unchanged)
 *
 * All provider calls use source-code analysis (static) or mocked providers.
 * No live Groq calls are made from the automated test suite.
 */

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ────────────────────────────────────────────────────────────────────────────
// 1. GROQ CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────

describe("Groq configuration", () => {
  const configSrc = fs.readFileSync("server/ai/ai-config.ts", "utf8");
  const groqSrc = fs.readFileSync("server/ai/groq-provider.ts", "utf8");

  test("Groq_api_key is recognised (Replit-named secret)", () => {
    // Both the config and the provider must reference process.env.Groq_api_key
    assert.match(configSrc, /process\.env\.Groq_api_key/);
    assert.match(groqSrc, /process\.env\.Groq_api_key/);
  });

  test("GROQ_API_KEY is recognised (standard uppercase alias)", () => {
    assert.match(configSrc, /process\.env\.GROQ_API_KEY/);
    assert.match(groqSrc, /process\.env\.GROQ_API_KEY/);
  });

  test("standard uppercase variable takes precedence over Replit-named secret", () => {
    // Must be: process.env.GROQ_API_KEY || process.env.Groq_api_key
    // Not the other way around.
    const capsPos = configSrc.indexOf("GROQ_API_KEY");
    const replitPos = configSrc.indexOf("Groq_api_key");
    assert.ok(capsPos < replitPos, "GROQ_API_KEY must appear before Groq_api_key (precedence order)");

    const groqCapsPos = groqSrc.indexOf("GROQ_API_KEY");
    const groqReplitPos = groqSrc.indexOf("Groq_api_key");
    assert.ok(groqCapsPos < groqReplitPos, "GROQ_API_KEY must appear before Groq_api_key in groq-provider.ts");
  });

  test("default Groq base URL is https://api.groq.com/openai/v1", () => {
    assert.match(configSrc, /https:\/\/api\.groq\.com\/openai\/v1/);
    assert.match(groqSrc, /https:\/\/api\.groq\.com\/openai\/v1/);
  });

  test("default Groq model is exactly openai/gpt-oss-120b", () => {
    // The canonical default lives in ai-config.ts; groq-provider.ts reads it via GROQ_CONFIG.model.
    assert.match(configSrc, /openai\/gpt-oss-120b/);
    assert.match(groqSrc, /GROQ_CONFIG\.model/);
  });

  test("GROQ_BASE_URL server-side override is supported", () => {
    assert.match(configSrc, /GROQ_BASE_URL/);
  });

  test("GROQ_MODEL server-side override is supported", () => {
    assert.match(configSrc, /GROQ_MODEL/);
  });

  test("existing OpenAI SDK is reused (no new dependency)", () => {
    // Must import from "openai" — not from "groq-sdk" or any other package
    assert.match(groqSrc, /from\s+["']openai["']/);
    assert.doesNotMatch(groqSrc, /from\s+["']groq-sdk["']/);
    assert.doesNotMatch(groqSrc, /from\s+["']groq["']/);
  });

  test("package.json was not modified", () => {
    // groq-sdk must not appear in package.json
    const pkgJson = fs.readFileSync("package.json", "utf8");
    assert.doesNotMatch(pkgJson, /groq-sdk/);
  });

  test("Groq API key never appears in client source bundle", () => {
    const clientDir = "client/src";
    function findClientFiles(dir: string): string[] {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) results.push(...findClientFiles(full));
        else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) results.push(full);
      }
      return results;
    }
    const violations: string[] = [];
    for (const f of findClientFiles(clientDir)) {
      const src = fs.readFileSync(f, "utf8");
      if (src.includes("GROQ_API_KEY") || src.includes("Groq_api_key") || src.includes("process.env.GROQ")) {
        violations.push(f);
      }
    }
    assert.deepEqual(violations, [], `Client files must not access Groq API key: ${violations.join(", ")}`);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. GROQ REQUEST CONTRACT
// ────────────────────────────────────────────────────────────────────────────

describe("Groq request contract", () => {
  const groqSrc = fs.readFileSync("server/ai/groq-provider.ts", "utf8");

  test("groq-provider uses chat completions (not generateContent)", () => {
    assert.match(groqSrc, /chat\.completions\.create/);
  });

  test("stream: false is set", () => {
    assert.match(groqSrc, /stream:\s*false/);
  });

  test("max_completion_tokens: 4096 is set", () => {
    const configSrc = fs.readFileSync("server/ai/ai-config.ts", "utf8");
    assert.match(configSrc, /maxCompletionTokens:\s*4096/);
    assert.match(groqSrc, /max_completion_tokens:\s*GROQ_CONFIG\.maxCompletionTokens/);
  });

  test("reasoning_effort is passed to the request", () => {
    assert.match(groqSrc, /reasoning_effort/);
  });

  test("include_reasoning: false is set", () => {
    assert.match(groqSrc, /include_reasoning:\s*false/);
  });

  test("temperature is NOT sent", () => {
    assert.doesNotMatch(groqSrc, /params\.temperature|["']temperature["']\s*:/);
  });

  test("top_p is NOT sent", () => {
    assert.doesNotMatch(groqSrc, /params\.top_p|["']top_p["']\s*:/);
  });

  test("presence_penalty is NOT sent", () => {
    assert.doesNotMatch(groqSrc, /presence_penalty\s*:/);
  });

  test("frequency_penalty is NOT sent", () => {
    assert.doesNotMatch(groqSrc, /frequency_penalty\s*:/);
  });

  test("logprobs is NOT sent", () => {
    assert.doesNotMatch(groqSrc, /logprobs\s*:/);
  });

  test("logit_bias is NOT sent", () => {
    assert.doesNotMatch(groqSrc, /logit_bias\s*:/);
  });

  test("reasoning_format is NOT sent", () => {
    assert.doesNotMatch(groqSrc, /reasoning_format\s*:/);
  });

  test("n greater than 1 is NOT set", () => {
    // n:1 is fine; n>1 is prohibited. Must not set n > 1.
    assert.doesNotMatch(groqSrc, /n:\s*[2-9]|n:\s*\d{2,}/);
  });

  test("Groq reasoning is not stored or returned", () => {
    // Provider must parse only message.content, never expose Groq reasoning
    assert.doesNotMatch(groqSrc, /rawText.*reasoning|reasoning.*rawText/);
    // The GroqAssistantMessage interface must not include reasoning_content
    assert.doesNotMatch(groqSrc, /interface GroqAssistantMessage[\s\S]{0,200}reasoning_content/);
    assert.match(groqSrc, /message\.content|content.*choice\.message/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. STRICT JSON SCHEMA CONTRACT
// ────────────────────────────────────────────────────────────────────────────

describe("Groq structured output schema", () => {
  const groqSrc = fs.readFileSync("server/ai/groq-provider.ts", "utf8");

  test("response_format json_schema type is used", () => {
    assert.match(groqSrc, /json_schema/);
    assert.match(groqSrc, /type:\s*["']json_schema["']/);
  });

  test("schema name is breedlog_answer", () => {
    assert.match(groqSrc, /name:\s*["']breedlog_answer["']/);
  });

  test("strict: true is set on json_schema", () => {
    assert.match(groqSrc, /strict:\s*true/);
  });

  test("additionalProperties: false is set in schema", () => {
    assert.match(groqSrc, /additionalProperties:\s*false/);
  });

  test("all six required fields are present in schema", () => {
    assert.match(groqSrc, /["']answer["']/);
    assert.match(groqSrc, /["']answerType["']/);
    assert.match(groqSrc, /["']confidence["']/);
    assert.match(groqSrc, /["']usedData["']/);
    assert.match(groqSrc, /["']warnings["']/);
    assert.match(groqSrc, /["']suggestedNextQuestions["']/);
  });

  test("all six fields appear in required array", () => {
    // The required array must list all six fields
    const schemaBlock = groqSrc.slice(
      groqSrc.indexOf("BREEDLOG_RESPONSE_SCHEMA"),
      groqSrc.indexOf("BREEDLOG_RESPONSE_SCHEMA") + 800,
    );
    assert.match(schemaBlock, /required.*answer.*answerType.*confidence.*usedData.*warnings.*suggestedNextQuestions/s);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. REASONING EFFORT SELECTION
// ────────────────────────────────────────────────────────────────────────────

describe("Groq reasoning effort selection", () => {
  let selectReasoningEffort: (category?: string | null) => string;

  before(async () => {
    const mod = await import("../server/ai/ai-provider.js");
    selectReasoningEffort = mod.selectReasoningEffort;
  });

  test("app-help selects low reasoning effort", () => {
    assert.equal(selectReasoningEffort("app-help"), "low");
  });

  test("health-records selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort("health-records"), "high");
  });

  test("breeding-lambing selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort("breeding-lambing"), "high");
  });

  test("herd-overview selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort("herd-overview"), "high");
  });

  test("null/undefined selects high reasoning effort", () => {
    assert.equal(selectReasoningEffort(null), "high");
    assert.equal(selectReasoningEffort(undefined), "high");
  });

  test("medium reasoning effort is a valid return value (records-summary)", () => {
    assert.equal(selectReasoningEffort("records-summary"), "medium");
  });

  test("medium reasoning effort is a valid return value (general)", () => {
    assert.equal(selectReasoningEffort("general"), "medium");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. PROVIDER CHAIN ORDER
// ────────────────────────────────────────────────────────────────────────────

describe("Provider chain order", () => {
  const orchestratorSrc = fs.readFileSync("server/ai/ai-provider.ts", "utf8");

  test("Groq is primary — askGroq is imported", () => {
    assert.match(orchestratorSrc, /import.*askGroq.*from.*groq-provider/);
  });

  test("Groq call appears before Gemini call", () => {
    const groqPos = orchestratorSrc.indexOf("askGroq(");
    const geminiPos = orchestratorSrc.indexOf("generateGeminiContent(");
    assert.ok(groqPos !== -1, "orchestrator must contain askGroq(");
    assert.ok(geminiPos !== -1, "orchestrator must contain generateGeminiContent(");
    assert.ok(groqPos < geminiPos, "Groq call must appear before Gemini call");
  });

  test("Kimi is NOT called in the active provider chain", () => {
    // Kimi must not be imported or invoked in ai-provider.ts
    assert.doesNotMatch(orchestratorSrc, /import.*askKimi.*from.*kimi-provider/);
    assert.doesNotMatch(orchestratorSrc, /askKimi\s*\(/);
    assert.doesNotMatch(orchestratorSrc, /runKimiCanary\s*\(/);
  });

  test("Gemini is secondary — generateGeminiContent is imported", () => {
    assert.match(orchestratorSrc, /generateContent as generateGeminiContent/);
  });

  test("local fallback remains last (in routes, after all providers fail)", () => {
    const routesSrc = fs.readFileSync("server/ai/breedlog-ai-routes.ts", "utf8");
    // generateLocalFallback must be present
    assert.match(routesSrc, /generateLocalFallback/);
    // askProviders must be called
    const providerCallPos = routesSrc.indexOf("askProviders(");
    assert.ok(providerCallPos !== -1, "routes must call askProviders()");
    // The local-fallback response is returned only inside the !result.ok branch,
    // which follows the askProviders call.  The call-site invocation uses result.safeReason.
    const fallbackInvocationPos = routesSrc.indexOf("result.safeReason");
    assert.ok(fallbackInvocationPos !== -1, "routes must reference result.safeReason (fallback path)");
    assert.ok(providerCallPos < fallbackInvocationPos,
      "askProviders() call must come before the result.safeReason fallback dispatch");
  });

  test("Groq success returns immediately without attempting Gemini", () => {
    // After askGroq returns ok:true there is an immediate return
    const afterGroqOk = orchestratorSrc.slice(
      orchestratorSrc.indexOf("result.ok") + 1,
      orchestratorSrc.indexOf("result.ok") + 300,
    );
    assert.match(afterGroqOk, /return\s*\{/, "must return immediately on Groq success");
  });

  test("Gemini is retained (not deleted)", () => {
    assert.ok(fs.existsSync("server/ai/gemini-provider.ts"));
  });

  test("Kimi source file is retained (not deleted)", () => {
    assert.ok(fs.existsSync("server/ai/kimi-provider.ts"));
  });

  test("local fallback module is retained (not deleted)", () => {
    assert.ok(fs.existsSync("server/ai/local-fallback.ts"));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. HEALTH AND CANARY STATUS
// ────────────────────────────────────────────────────────────────────────────

describe("Health and canary endpoint contract", () => {
  const routesSrc = fs.readFileSync("server/ai/breedlog-ai-routes.ts", "utf8");
  const orchestratorSrc = fs.readFileSync("server/ai/ai-provider.ts", "utf8");

  test("getHealthInfo reports groq as primary provider", () => {
    assert.match(orchestratorSrc, /primaryProvider:\s*["']groq["']/);
  });

  test("getHealthInfo reports openai/gpt-oss-120b as primary model", () => {
    // primaryModel uses GROQ_CONFIG.model which defaults to openai/gpt-oss-120b
    assert.match(orchestratorSrc, /primaryModel:.*GROQ_CONFIG\.model/);
  });

  test("canary probe uses Groq (runGroqCanary)", () => {
    assert.match(orchestratorSrc, /runGroqCanary/);
    // Groq canary must appear before Gemini canary in getCanaryStatus
    const groqCanaryPos = orchestratorSrc.indexOf("runGroqCanary(");
    const geminiCanaryPos = orchestratorSrc.indexOf("runGeminiCanary(");
    assert.ok(groqCanaryPos < geminiCanaryPos, "Groq canary must run before Gemini canary");
  });

  test("health endpoint not-configured message references GROQ_API_KEY", () => {
    assert.match(routesSrc, /GROQ_API_KEY/);
  });

  test("canary uses include_reasoning: false", () => {
    const groqSrc = fs.readFileSync("server/ai/groq-provider.ts", "utf8");
    // runGroqCanary calls askGroq with "low" effort — include_reasoning is false in all asks
    assert.match(groqSrc, /include_reasoning:\s*false/);
  });

  test("canary retains 60-second cache", () => {
    assert.match(orchestratorSrc, /CANARY_CACHE_MS\s*=\s*60_?000/);
  });

  test("unauthenticated requests cannot invoke Groq — canary is protected", () => {
    // requireAuth must appear before getCanaryStatus() in the route
    const requireAuthPos = routesSrc.indexOf("requireAuth, async");
    const canaryStatusPos = routesSrc.indexOf("getCanaryStatus()");
    assert.ok(requireAuthPos < canaryStatusPos, "requireAuth must precede getCanaryStatus()");
  });

  test("unauthenticated requests cannot invoke Groq — health is protected", () => {
    const healthRouteIdx = routesSrc.indexOf("GET /api/ai/health");
    const healthRequireAuth = routesSrc.indexOf("requireAuth", healthRouteIdx);
    const healthInfo = routesSrc.indexOf("getHealthInfo()", healthRouteIdx);
    assert.ok(healthRequireAuth < healthInfo, "requireAuth must precede getHealthInfo()");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. ERROR HANDLING AND SECURITY
// ────────────────────────────────────────────────────────────────────────────

describe("Groq error handling and security", () => {
  const groqSrc = fs.readFileSync("server/ai/groq-provider.ts", "utf8");
  const routesSrc = fs.readFileSync("server/ai/breedlog-ai-routes.ts", "utf8");
  const orchestratorSrc = fs.readFileSync("server/ai/ai-provider.ts", "utf8");

  test("401/403 is classified as auth failure", () => {
    assert.match(groqSrc, /status === 401.*403|401.*403.*auth/s);
    assert.match(groqSrc, /category.*["']auth["']/);
  });

  test("404 is classified as notfound", () => {
    assert.match(groqSrc, /status === 404|msg\.includes.*404/);
    assert.match(groqSrc, /category.*["']notfound["']/);
  });

  test("429 is classified as quota", () => {
    assert.match(groqSrc, /status === 429|msg\.includes.*429/);
    assert.match(groqSrc, /category.*["']quota["']/);
  });

  test("timeout is classified separately", () => {
    assert.match(groqSrc, /aborted|ETIMEDOUT/);
    assert.match(groqSrc, /category.*["']timeout["']/);
  });

  test("5xx is classified as other/provider error", () => {
    assert.match(groqSrc, /status >= 500/);
  });

  test("raw provider errors are not returned to client", () => {
    assert.doesNotMatch(routesSrc, /res\.json\(.*result\.error/);
    assert.doesNotMatch(orchestratorSrc, /safeMessage.*apiKey|apiKey.*safeMessage/);
  });

  test("API keys are never logged", () => {
    assert.doesNotMatch(groqSrc, /console\.(log|info|warn|error).*apiKey/);
    assert.doesNotMatch(groqSrc, /console\.(log|info|warn|error).*GROQ_API_KEY/);
    assert.doesNotMatch(groqSrc, /console\.(log|info|warn|error).*Groq_api_key/);
  });

  test("routes do not read raw API key values directly", () => {
    const nonCommentRoutes = routesSrc
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    assert.ok(!nonCommentRoutes.includes("process.env.GROQ_API_KEY"), "routes must not read GROQ_API_KEY directly");
    assert.ok(!nonCommentRoutes.includes("process.env.Groq_api_key"), "routes must not read Groq_api_key directly");
    assert.ok(!nonCommentRoutes.includes("rawError"), "routes must not surface rawError");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. MEMORY — five-exchange system still works with Groq
// ────────────────────────────────────────────────────────────────────────────

describe("Memory compatibility with Groq", () => {
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

  function makeGroqExchange(question: string, answer: string): any {
    return {
      userMessage: question,
      // Groq messages have no reasoning_content
      providerMessage: {
        role: "assistant",
        content: `{"answer":"${answer}","answerType":"data","confidence":"high","usedData":[],"warnings":[],"suggestedNextQuestions":[]}`,
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

  test("MAX_EXCHANGES is still 5", () => {
    assert.equal(MAX_EXCHANGES, 5);
  });

  test("Groq exchange is stored successfully", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "user-1", makeGroqExchange("How many lambs?", "You have 12 lambs."));
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].userMessage, "How many lambs?");
  });

  test("five Groq exchanges are retained (oldest evicted on sixth)", async () => {
    const storage = makeStorage();
    for (let i = 1; i <= 6; i++) {
      await appendExchange(storage, "user-1", makeGroqExchange(`Q${i}`, `A${i}`));
    }
    const loaded = await loadMemory(storage, "user-1");
    assert.equal(loaded.length, 5);
    assert.equal(loaded[0].userMessage, "Q2");
    assert.equal(loaded[4].userMessage, "Q6");
  });

  test("user isolation is maintained", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "farmer-A", makeGroqExchange("Farmer A question", "A"));
    const farmerB = await loadMemory(storage, "farmer-B");
    assert.equal(farmerB.length, 0);
  });

  test("clearMemory still works with Groq exchanges", async () => {
    const storage = makeStorage();
    await appendExchange(storage, "user-1", makeGroqExchange("Q", "A"));
    await clearMemory(storage, "user-1");
    assert.deepEqual(await loadMemory(storage, "user-1"), []);
  });

  test("Groq reasoning is not stored in providerMessage", async () => {
    const storage = makeStorage();
    const ex = makeGroqExchange("Q", "A");
    await appendExchange(storage, "user-1", ex);
    const loaded = await loadMemory(storage, "user-1");
    const keys = Object.keys(loaded[0].providerMessage);
    assert.ok(!keys.includes("reasoning_content"), "Groq providerMessage must not include reasoning_content");
  });

  test("existing Kimi memory (with reasoning_content) fails safely without exposing reasoning", async () => {
    const storage = makeStorage();
    // Simulate a legacy Kimi exchange stored in memory
    const legacyKimiExchange = {
      userMessage: "Old Kimi question",
      providerMessage: {
        role: "assistant",
        content: '{"answer":"old kimi answer","answerType":"data","confidence":"high","usedData":[],"warnings":[],"suggestedNextQuestions":[]}',
        reasoning_content: "secret kimi thinking",
      },
      parsedAnswer: {
        answer: "old kimi answer",
        answerType: "data",
        confidence: "high",
        usedData: [],
        warnings: [],
        suggestedNextQuestions: [],
      },
      category: "herd-overview",
      timestamp: new Date().toISOString(),
    };
    await appendExchange(storage, "user-1", legacyKimiExchange);
    const loaded = await loadMemory(storage, "user-1");
    // Must load without throwing
    assert.equal(loaded.length, 1);
    // Public history must not expose reasoning
    const pub = toPublicHistory(loaded);
    const serialised = JSON.stringify(pub);
    assert.doesNotMatch(serialised, /reasoning_content/);
    assert.doesNotMatch(serialised, /secret kimi thinking/);
  });

  test("toPublicHistory strips reasoning_content from legacy Kimi messages", () => {
    const exchanges = [{
      userMessage: "Q",
      providerMessage: { role: "assistant", content: "answer", reasoning_content: "private" },
      parsedAnswer: { answer: "answer", answerType: "data", confidence: "high", usedData: [], warnings: [], suggestedNextQuestions: [] },
      category: null,
      timestamp: new Date().toISOString(),
    }];
    const pub = toPublicHistory(exchanges);
    assert.doesNotMatch(JSON.stringify(pub), /reasoning_content/);
    assert.doesNotMatch(JSON.stringify(pub), /private/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. QUOTA CONTROLS — unchanged from pre-Groq baseline
// ────────────────────────────────────────────────────────────────────────────

describe("Quota controls (unchanged)", () => {
  const routesSrc = fs.readFileSync("server/ai/breedlog-ai-routes.ts", "utf8");
  const commercialSrc = fs.readFileSync("server/commercial.ts", "utf8");

  test("free-account plan AI quota is still enforced (reserveUsage)", () => {
    assert.match(routesSrc, /reserveUsage\(.*aiActions/);
  });

  test("short-window rate limiter remains (20 req/min)", () => {
    assert.match(routesSrc, /RATE_LIMIT\s*=\s*20/);
    assert.match(routesSrc, /RATE_WINDOW_MS\s*=\s*60_000|RATE_WINDOW_MS\s*=\s*60000/);
  });

  test("internal-test account still unlimited at BreedLog plan layer", () => {
    assert.match(commercialSrc, /isInternalTestEntitlement/);
    const reserveFn = commercialSrc.slice(
      commercialSrc.indexOf("export async function reserveUsage"),
      commercialSrc.indexOf("export async function reserveUsage") + 400,
    );
    assert.match(reserveFn, /isInternalTestEntitlement|internal_test/);
  });

  test("account purge still clears AI memory key", () => {
    assert.match(commercialSrc, /breedlog:ai-memory/);
    assert.match(
      commercialSrc,
      /deleteSystemSetting.*breedlog:ai-memory|breedlog:ai-memory.*deleteSystemSetting/,
    );
  });
});
