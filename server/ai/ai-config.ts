/**
 * Single source of truth for the BreedLog AI provider configuration.
 *
 * Primary provider: Groq GPT-OSS 120B   — GROQ_API_KEY or Groq_api_key secret
 * Secondary provider: Gemini             — GEMINI_API_KEY secret
 * Tertiary: deterministic local BreedLog fallback (always available)
 *
 * Provider order: Groq → Gemini → local fallback
 *
 * Kimi K3 configuration is retained below but Kimi is NOT in the active provider chain.
 * The Kimi source files are preserved for history; they are not called at runtime.
 *
 * Optional server-side overrides:
 *   GROQ_BASE_URL  — default https://api.groq.com/openai/v1
 *   GROQ_MODEL     — default openai/gpt-oss-120b
 *   KIMI_BASE_URL  — default https://api.moonshot.ai/v1
 *   KIMI_MODEL     — default kimi-k3
 *   GEMINI_MODEL   — default gemini-2.5-flash-lite
 *   GEMINI_FALLBACK_MODELS — comma-separated chain
 */

// ── Groq (primary) ────────────────────────────────────────────────────────────

export const GROQ_CONFIG = {
  provider: "groq" as const,
  /**
   * Standard uppercase alias takes precedence; Replit-named secret (Groq_api_key) is fallback.
   * Never log or return the key.
   */
  apiKey: process.env.GROQ_API_KEY || process.env.Groq_api_key || "",
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  maxCompletionTokens: 4096,
};

export function isGroqConfigured(): boolean {
  return GROQ_CONFIG.apiKey.length > 0;
}

// ── Kimi K3 (inactive — retained for source history) ─────────────────────────

export const KIMI_CONFIG = {
  provider: "kimi" as const,
  /** Never log or return the key. */
  apiKey: process.env.KIMI_K3_API || "",
  baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1",
  model: process.env.KIMI_MODEL || "kimi-k3",
  maxCompletionTokens: 4096,
};

export function isKimiConfigured(): boolean {
  return KIMI_CONFIG.apiKey.length > 0;
}

// ── Gemini (secondary / fallback) ─────────────────────────────────────────────

export const GEMINI_CONFIG = {
  provider: "gemini" as const,
  apiKey: process.env.GEMINI_API_KEY || "",
  primaryModel: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  fallbackModels: (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash,gemini-2.0-flash")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
};

export function isGeminiConfigured(): boolean {
  return GEMINI_CONFIG.apiKey.length > 0;
}

// ── Backwards-compat shim used by gemini-provider.ts ─────────────────────────

export const AI_CONFIG = {
  provider: "gemini" as const,
  apiKey: GEMINI_CONFIG.apiKey,
  primaryModel: GEMINI_CONFIG.primaryModel,
  fallbackModels: GEMINI_CONFIG.fallbackModels,
};

export function getModelChain(): string[] {
  const chain = [GEMINI_CONFIG.primaryModel, ...GEMINI_CONFIG.fallbackModels];
  return Array.from(new Set(chain));
}

export function isAIConfigured(): boolean {
  return isGeminiConfigured();
}

// ── Primary-provider helper ───────────────────────────────────────────────────

/** True when at least one live provider is configured. */
export function isAnyProviderConfigured(): boolean {
  return isGroqConfigured() || isKimiConfigured() || isGeminiConfigured();
}
