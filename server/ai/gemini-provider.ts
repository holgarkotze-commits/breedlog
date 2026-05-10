import { GoogleGenAI } from "@google/genai";
import { AI_CONFIG, getModelChain, isAIConfigured } from "./ai-config";

export function isConfigured(): boolean {
  return isAIConfigured();
}

export interface GeminiResponse {
  text: string;
  ok: boolean;
  error?: string;
  /** True when EVERY model in the chain returned 429 / RESOURCE_EXHAUSTED. */
  quotaExhausted?: boolean;
  /** Which model produced the answer (when ok). */
  modelUsed?: string;
  /** Per-model attempt summary for diagnostics (never exposed to UI). */
  attempts?: Array<{ model: string; ok: boolean; reason?: string }>;
}

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: AI_CONFIG.apiKey });
  }
  return _client;
}

interface FailureKind {
  kind: "quota" | "timeout" | "auth" | "notfound" | "other";
  reason: string;
}

function classify(err: unknown): FailureKind {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("aborted") || msg.includes("timeout")) {
    return { kind: "timeout", reason: msg.slice(0, 200) };
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
    return { kind: "quota", reason: msg.slice(0, 200) };
  }
  if (msg.includes("API_KEY") || msg.includes("authentication") || msg.includes("401") ||
      msg.includes("API key not valid")) {
    return { kind: "auth", reason: msg.slice(0, 200) };
  }
  if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("not found")) {
    return { kind: "notfound", reason: msg.slice(0, 200) };
  }
  return { kind: "other", reason: msg.slice(0, 200) };
}

async function tryOneModel(
  model: string,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number,
): Promise<{ ok: true; text: string } | { ok: false; failure: FailureKind }> {
  try {
    const client = getClient();
    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);
    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 2048,
        // Disable thinking on 2.5-series so output tokens aren't burned on reasoning
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    clearTimeout(timer);
    const text = response.text ?? "";
    if (!text || text.trim().length === 0) {
      return { ok: false, failure: { kind: "other", reason: "Empty response" } };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, failure: classify(err) };
  }
}

/**
 * Try the configured model, then each fallback model in order.
 * Only marks `quotaExhausted` when EVERY model returns a quota failure.
 */
export async function generateContent(
  systemPrompt: string,
  userMessage: string,
  timeoutMs = 25_000,
): Promise<GeminiResponse> {
  if (!isConfigured()) {
    return { ok: false, text: "", error: "GEMINI_API_KEY not configured" };
  }

  const chain = getModelChain();
  const attempts: GeminiResponse["attempts"] = [];

  for (const model of chain) {
    const result = await tryOneModel(model, systemPrompt, userMessage, timeoutMs);
    if (result.ok) {
      attempts.push({ model, ok: true });
      return { ok: true, text: result.text, modelUsed: model, attempts };
    }
    attempts.push({ model, ok: false, reason: result.failure.kind });
    console.error(`[BreedLog AI] ${model} -> ${result.failure.kind}: ${result.failure.reason}`);

    // Auth errors fail fast — every model will fail the same way
    if (result.failure.kind === "auth") {
      return {
        ok: false,
        text: "",
        error: "AI is not configured correctly. Contact support.",
        attempts,
      };
    }
    // Other recoverable errors fall through to the next model
  }

  // All models failed — figure out the dominant failure
  const allQuota = attempts.every((a) => !a.ok && a.reason === "quota");
  const anyTimeout = attempts.some((a) => !a.ok && a.reason === "timeout");

  if (allQuota) {
    return {
      ok: false,
      text: "",
      error: "AI quota is temporarily exhausted on all configured models.",
      quotaExhausted: true,
      attempts,
    };
  }
  if (anyTimeout) {
    return {
      ok: false,
      text: "",
      error: "The AI took too long to respond. Please try again.",
      attempts,
    };
  }
  return {
    ok: false,
    text: "",
    error: "AI is temporarily unavailable. Please try again shortly.",
    attempts,
  };
}

/**
 * Lightweight provider canary — minimal request to confirm the provider is
 * actually reachable and at least one model in the chain is responsive.
 * Used by /api/ai/health to give an honest status, not just "key present".
 */
export async function runCanary(timeoutMs = 8_000): Promise<{
  reachable: boolean;
  modelUsed: string | null;
  quotaExhausted: boolean;
  attempts: Array<{ model: string; ok: boolean; reason?: string }>;
}> {
  if (!isConfigured()) {
    return { reachable: false, modelUsed: null, quotaExhausted: false, attempts: [] };
  }
  const chain = getModelChain();
  const attempts: Array<{ model: string; ok: boolean; reason?: string }> = [];
  for (const model of chain) {
    const result = await tryOneModel(model, "Reply with the single word OK.", "Say OK.", timeoutMs);
    if (result.ok) {
      attempts.push({ model, ok: true });
      return { reachable: true, modelUsed: model, quotaExhausted: false, attempts };
    }
    attempts.push({ model, ok: false, reason: result.failure.kind });
    if (result.failure.kind === "auth") break;
  }
  const allQuota = attempts.every((a) => !a.ok && a.reason === "quota");
  return { reachable: false, modelUsed: null, quotaExhausted: allQuota, attempts };
}

/** Exported for /api/ai/health diagnostics. */
export function getConfiguredModelChain(): string[] {
  return getModelChain();
}
