/**
 * BreedLog AI provider orchestrator.
 *
 * Provider chain: Groq GPT-OSS 120B → Gemini → deterministic local fallback
 *
 * Responsibilities:
 *  - Route requests to the configured primary provider (Groq).
 *  - Fall back to Gemini if Groq fails.
 *  - Expose a uniform result type to the route handler.
 *  - Never expose raw provider errors, request bodies, or secrets to callers.
 *  - Log only: provider name, model, failure category, status code.
 *
 * Kimi K3 is NOT in the active provider chain (the API account has no usable free quota).
 * Kimi source files are retained for history; kimi-provider.ts is not imported here.
 */

import { askGroq, runGroqCanary, type GroqReasoningEffort, type GroqAssistantMessage } from "./groq-provider";
import { generateContent as generateGeminiContent, runCanary as runGeminiCanary, getConfiguredModelChain } from "./gemini-provider";
import { isGroqConfigured, isGeminiConfigured, GROQ_CONFIG } from "./ai-config";
import { SYSTEM_PROMPT } from "./breedlog-ai-rules";

// ── Result types ──────────────────────────────────────────────────────────────

export type ActiveProvider = "groq" | "gemini" | "local";

export interface ProviderResult {
  ok: true;
  rawText: string;
  /** Full provider message — stored in memory server-side, never returned to client. */
  providerMessage: GroqAssistantMessage;
  provider: ActiveProvider;
  model: string;
}

export interface ProviderFailure {
  ok: false;
  /** Safe user-visible reason — no keys, no prompts, no response body. */
  safeReason: "quota" | "unavailable" | "not_configured";
}

export type ProviderResponse = ProviderResult | ProviderFailure;

// ── Reasoning effort selection ────────────────────────────────────────────────

/**
 * Select reasoning effort for Groq GPT-OSS 120B.
 *  "low"    — app-help / navigation (fast, low cost)
 *  "medium" — general summaries, records explanations (balanced)
 *  "high"   — farm data, health, breeding, genetics, multi-record analysis (thorough)
 */
export function selectReasoningEffort(category?: string | null): GroqReasoningEffort {
  if (category === "app-help") return "low";
  if (category === "general" || category === "records-summary") return "medium";
  return "high";
}

// ── Provider state ────────────────────────────────────────────────────────────

let _groqQuotaAt: number | null = null;
let _geminiQuotaAt: number | null = null;
const QUOTA_COOLDOWN_MS = 5 * 60_000;

function isGroqQuotaExhausted(): boolean {
  if (!_groqQuotaAt) return false;
  if (Date.now() - _groqQuotaAt > QUOTA_COOLDOWN_MS) { _groqQuotaAt = null; return false; }
  return true;
}

function isGeminiQuotaExhausted(): boolean {
  if (!_geminiQuotaAt) return false;
  if (Date.now() - _geminiQuotaAt > QUOTA_COOLDOWN_MS) { _geminiQuotaAt = null; return false; }
  return true;
}

export function markGroqQuotaExhausted(): void { _groqQuotaAt = Date.now(); }
export function markGeminiQuotaExhausted(): void { _geminiQuotaAt = Date.now(); }
export function clearGroqQuota(): void { _groqQuotaAt = null; }
export function clearGeminiQuota(): void { _geminiQuotaAt = null; }

// ── Last working state (for health endpoint) ──────────────────────────────────

let _lastWorkingProvider: ActiveProvider | null = null;
let _lastWorkingModel: string | null = null;

export function getLastWorkingProvider(): ActiveProvider | null { return _lastWorkingProvider; }
export function getLastWorkingModel(): string | null { return _lastWorkingModel; }

// ── Canary cache ──────────────────────────────────────────────────────────────

const CANARY_CACHE_MS = 60_000;
let _lastCanary: {
  at: number;
  reachable: boolean;
  provider: string;
  model: string | null;
  category: string | null;
} | null = null;

export async function getCanaryStatus() {
  if (_lastCanary && Date.now() - _lastCanary.at < CANARY_CACHE_MS) {
    return _lastCanary;
  }
  // Try Groq first (primary provider)
  if (isGroqConfigured()) {
    const r = await runGroqCanary(10_000);
    _lastCanary = { at: Date.now(), reachable: r.reachable, provider: "groq", model: r.model, category: r.category };
    if (r.reachable) {
      _lastWorkingProvider = "groq";
      _lastWorkingModel = r.model;
    }
    return _lastCanary;
  }
  // Try Gemini
  if (isGeminiConfigured()) {
    const r = await runGeminiCanary(8_000);
    _lastCanary = { at: Date.now(), reachable: r.reachable, provider: "gemini", model: r.modelUsed, category: null };
    if (r.reachable) {
      _lastWorkingProvider = "gemini";
      _lastWorkingModel = r.modelUsed;
    }
    return _lastCanary;
  }
  _lastCanary = { at: Date.now(), reachable: false, provider: "none", model: null, category: "not_configured" };
  return _lastCanary;
}

// ── Primary ask ───────────────────────────────────────────────────────────────

/**
 * Ask the AI provider chain.
 *
 * @param messages  Complete ordered messages array ready for Groq
 *                  (system message INCLUDED — caller builds full array).
 * @param systemPrompt  Plain system prompt text for Gemini fallback.
 * @param userMessageText  Plain current question text for Gemini fallback.
 * @param effort    Groq reasoning effort level.
 */
export async function askProviders(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | null; [key: string]: unknown }>,
  systemPrompt: string,
  userMessageText: string,
  effort: GroqReasoningEffort,
): Promise<ProviderResponse> {

  // ── 1. Groq ──────────────────────────────────────────────────────────────────
  if (isGroqConfigured() && !isGroqQuotaExhausted()) {
    const result = await askGroq(messages, effort, 35_000);
    if (result.ok) {
      clearGroqQuota();
      _lastWorkingProvider = "groq";
      _lastWorkingModel = result.model;
      return {
        ok: true,
        rawText: result.message.content ?? "",
        providerMessage: result.message,
        provider: "groq",
        model: result.model,
      };
    }
    // Quota / rate-limit → mark and fall through
    if (result.category === "quota") {
      markGroqQuotaExhausted();
    }
    // Auth / notfound → log and fall through to Gemini
    if (result.category === "auth" || result.category === "notfound") {
      console.error(`[BreedLog AI] groq hard failure: ${result.category}`);
    }
  }

  // ── 2. Gemini ────────────────────────────────────────────────────────────────
  if (isGeminiConfigured() && !isGeminiQuotaExhausted()) {
    const geminiResult = await generateGeminiContent(systemPrompt, userMessageText, 25_000);
    if (geminiResult.ok) {
      clearGeminiQuota();
      _lastWorkingProvider = "gemini";
      _lastWorkingModel = geminiResult.modelUsed ?? null;
      const text = geminiResult.text;
      return {
        ok: true,
        rawText: text,
        // Gemini: wrap in content-only message (no reasoning)
        providerMessage: { role: "assistant", content: text },
        provider: "gemini",
        model: geminiResult.modelUsed ?? "gemini",
      };
    }
    if (geminiResult.quotaExhausted) {
      markGeminiQuotaExhausted();
      return { ok: false, safeReason: "quota" };
    }
  }

  // ── 3. Both failed ───────────────────────────────────────────────────────────
  const bothQuota = isGroqQuotaExhausted() && isGeminiQuotaExhausted();
  if (!isGroqConfigured() && !isGeminiConfigured()) {
    return { ok: false, safeReason: "not_configured" };
  }
  return { ok: false, safeReason: bothQuota ? "quota" : "unavailable" };
}

// ── Health info ───────────────────────────────────────────────────────────────

export function getHealthInfo() {
  const groqConfigured = isGroqConfigured();
  const geminiConfigured = isGeminiConfigured();
  const groqQuota = isGroqQuotaExhausted();
  const geminiQuota = isGeminiQuotaExhausted();

  return {
    primaryProvider: "groq",
    primaryModel: groqConfigured ? GROQ_CONFIG.model : null,
    groqConfigured,
    geminiConfigured,
    // Backwards-compat fields (previously kimi*)
    kimiConfigured: false,
    kimiQuotaExhausted: false,
    groqQuotaExhausted: groqQuota,
    geminiQuotaExhausted: geminiQuota,
    fallbackActive: groqConfigured && groqQuota && geminiConfigured,
    localFallbackActive: !groqConfigured && !geminiConfigured,
    activeProvider: _lastWorkingProvider,
    activeModel: _lastWorkingModel,
    geminiModelChain: getConfiguredModelChain(),
  };
}
