/**
 * Single source of truth for the BreedLog AI provider configuration.
 *
 * Reads exclusively from environment variables. Used by the gemini provider
 * and the AI health endpoint so we cannot drift between them.
 *
 * - GEMINI_API_KEY      : the API key (required to enable live AI)
 * - GEMINI_MODEL        : preferred model id (default: gemini-2.5-flash-lite —
 *                         proven to work on the free tier when 2.0-flash is
 *                         out of quota)
 * - GEMINI_FALLBACK_MODELS : comma-separated chain tried in order if the
 *                         preferred model returns 429 / RESOURCE_EXHAUSTED
 */

export const AI_CONFIG = {
  provider: "gemini" as const,
  apiKey: process.env.GEMINI_API_KEY || "",
  primaryModel: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
  fallbackModels: (process.env.GEMINI_FALLBACK_MODELS ||
    "gemini-2.5-flash,gemini-2.0-flash")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
};

/** Whole ordered chain to try, primary first. */
export function getModelChain(): string[] {
  const chain = [AI_CONFIG.primaryModel, ...AI_CONFIG.fallbackModels];
  // De-dup while preserving order
  return Array.from(new Set(chain));
}

export function isAIConfigured(): boolean {
  return AI_CONFIG.apiKey.length > 0;
}
