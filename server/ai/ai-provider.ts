/**
 * BreedLog AI provider orchestrator.
 *
 * Provider chain: Kimi K3 → Gemini → deterministic local fallback
 *
 * Responsibilities:
 *  - Route requests to the configured primary provider (Kimi).
 *  - Fall back to Gemini if Kimi fails.
 *  - Expose a uniform result type to the route handler.
 *  - Never expose raw provider errors, request bodies, or secrets to callers.
 *  - Log only: provider name, model, failure category, status code.
 */

import { askKimi, runKimiCanary, type KimiReasoningEffort, type KimiAssistantMessage } from "./kimi-provider";
import { generateContent as generateGeminiContent, runCanary as runGeminiCanary, getConfiguredModelChain } from "./gemini-provider";
import { isKimiConfigured, isGeminiConfigured } from "./ai-config";
import { SYSTEM_PROMPT } from "./breedlog-ai-rules";

// ── Result types ──────────────────────────────────────────────────────────────

export type ActiveProvider = "kimi" | "gemini" | "local";

export interface ProviderResult {
  ok: true;
  rawText: string;
  /** Full provider message — stored in memory server-side, never returned to client. */
  providerMessage: KimiAssistantMessage;
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
 * Select reasoning effort for Kimi K3.
 * App-help / navigation questions use "low" to reduce latency and cost.
 * All farm-data, health, breeding, and genetics questions use "high".
 */
export function selectReasoningEffort(category?: string | null): KimiReasoningEffort {
  if (category === "app-help") return "low";
  return "high";
}

// ── Provider state ────────────────────────────────────────────────────────────

let _kimiQuotaAt: number | null = null;
let _geminiQuotaAt: number | null = null;
const QUOTA_COOLDOWN_MS = 5 * 60_000;

function isKimiQuotaExhausted(): boolean {
  if (!_kimiQuotaAt) return false;
  if (Date.now() - _kimiQuotaAt > QUOTA_COOLDOWN_MS) { _kimiQuotaAt = null; return false; }
  return true;
}

function isGeminiQuotaExhausted(): boolean {
  if (!_geminiQuotaAt) return false;
  if (Date.now() - _geminiQuotaAt > QUOTA_COOLDOWN_MS) { _geminiQuotaAt = null; return false; }
  return true;
}

export function markKimiQuotaExhausted(): void { _kimiQuotaAt = Date.now(); }
export function markGeminiQuotaExhausted(): void { _geminiQuotaAt = Date.now(); }
export function clearKimiQuota(): void { _kimiQuotaAt = null; }
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
  // Try Kimi first
  if (isKimiConfigured()) {
    const r = await runKimiCanary(10_000);
    _lastCanary = { at: Date.now(), reachable: r.reachable, provider: "kimi", model: r.model, category: r.category };
    if (r.reachable) {
      _lastWorkingProvider = "kimi";
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
 * @param messages  Complete ordered messages array ready for Kimi
 *                  (system message INCLUDED — caller builds full array).
 * @param systemPrompt  Plain system prompt text for Gemini fallback (Gemini uses its own interface).
 * @param userMessageText  Plain current question text for Gemini fallback.
 * @param effort    Kimi reasoning effort level.
 */
export async function askProviders(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | null; [key: string]: unknown }>,
  systemPrompt: string,
  userMessageText: string,
  effort: KimiReasoningEffort,
): Promise<ProviderResponse> {

  // ── 1. Kimi ──────────────────────────────────────────────────────────────────
  if (isKimiConfigured() && !isKimiQuotaExhausted()) {
    const result = await askKimi(messages, effort, 35_000);
    if (result.ok) {
      clearKimiQuota();
      _lastWorkingProvider = "kimi";
      _lastWorkingModel = result.model;
      return {
        ok: true,
        rawText: result.message.content ?? "",
        providerMessage: result.message,
        provider: "kimi",
        model: result.model,
      };
    }
    // Quota / rate-limit → mark and fall through
    if (result.category === "quota") {
      markKimiQuotaExhausted();
    }
    // Auth / notfound → fail fast (Gemini won't fix this)
    if (result.category === "auth" || result.category === "notfound") {
      console.error(`[BreedLog AI] kimi hard failure: ${result.category}`);
      // Fall through to Gemini anyway
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
        // Gemini: wrap in content-only message (no reasoning_content)
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
  const bothQuota = isKimiQuotaExhausted() && isGeminiQuotaExhausted();
  if (!isKimiConfigured() && !isGeminiConfigured()) {
    return { ok: false, safeReason: "not_configured" };
  }
  return { ok: false, safeReason: bothQuota ? "quota" : "unavailable" };
}

// ── Health info ───────────────────────────────────────────────────────────────

export function getHealthInfo() {
  const kimiConfigured = isKimiConfigured();
  const geminiConfigured = isGeminiConfigured();
  const kimiQuota = isKimiQuotaExhausted();
  const geminiQuota = isGeminiQuotaExhausted();

  return {
    primaryProvider: "kimi",
    primaryModel: kimiConfigured ? (process.env.KIMI_MODEL || "kimi-k3") : null,
    kimiConfigured,
    geminiConfigured,
    kimiQuotaExhausted: kimiQuota,
    geminiQuotaExhausted: geminiQuota,
    fallbackActive: kimiConfigured && kimiQuota && geminiConfigured,
    localFallbackActive: !kimiConfigured && !geminiConfigured,
    activeProvider: _lastWorkingProvider,
    activeModel: _lastWorkingModel,
    geminiModelChain: getConfiguredModelChain(),
  };
}
