/**
 * Kimi K3 provider for BreedLog AI.
 *
 * Uses the installed OpenAI-compatible SDK with Moonshot's base URL.
 * API key is read from process.env.KIMI_K3_API — never logged or returned.
 *
 * DO NOT:
 *  - Log the key, prompts, farm context, or reasoning_content.
 *  - Return reasoning_content to callers — it stays server-side.
 *  - Send temperature / top_p / presence_penalty / frequency_penalty.
 *
 * reasoning_effort:
 *  "high"  — farm data, health, breeding, genetics questions
 *  "low"   — simple app-help / navigation questions
 */

import OpenAI from "openai";
import { KIMI_CONFIG, isKimiConfigured } from "./ai-config";

// ── Types ─────────────────────────────────────────────────────────────────────

export type KimiReasoningEffort = "high" | "low";

/** Full raw assistant message from Kimi — preserved server-side for memory continuity. */
export interface KimiAssistantMessage {
  role: "assistant";
  content: string | null;
  /** Internal chain-of-thought — NEVER return to client or log. */
  reasoning_content?: string;
  tool_calls?: unknown[];
}

export interface KimiResult {
  ok: true;
  message: KimiAssistantMessage;
  model: string;
}

export interface KimiError {
  ok: false;
  /** Classified error category — safe to log. Never expose raw error text to user. */
  category: "auth" | "quota" | "timeout" | "notfound" | "other";
  /** Safe short description (no key, no prompt, no response body). */
  safeMessage: string;
}

export type KimiResponse = KimiResult | KimiError;

// ── Strict JSON schema for the BreedLog AI response format ──────────────────

const BREEDLOG_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    answerType: { type: "string", enum: ["help", "data", "hybrid", "unsupported"] },
    confidence: { type: "string", enum: ["high", "medium", "low", "insufficient"] },
    usedData: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    suggestedNextQuestions: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "answerType", "confidence", "usedData", "warnings", "suggestedNextQuestions"],
  additionalProperties: false,
} as const;

// ── Lazy client ───────────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: KIMI_CONFIG.apiKey,
      baseURL: KIMI_CONFIG.baseURL,
    });
  }
  return _client;
}

// ── Error classification ──────────────────────────────────────────────────────

function classifyKimiError(err: unknown): KimiError {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 0;

  if (status === 401 || status === 403 || msg.includes("authentication") || msg.includes("API key")) {
    console.error(`[BreedLog AI] kimi auth failure (${status})`);
    return { ok: false, category: "auth", safeMessage: "Kimi authentication failed." };
  }
  if (status === 404 || msg.includes("404") || msg.includes("not found") || msg.includes("NOT_FOUND")) {
    console.error(`[BreedLog AI] kimi model/endpoint not found (${status})`);
    return { ok: false, category: "notfound", safeMessage: "Kimi model or endpoint unavailable." };
  }
  if (status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) {
    console.error(`[BreedLog AI] kimi quota/rate-limit (${status})`);
    return { ok: false, category: "quota", safeMessage: "Kimi quota or rate limit reached." };
  }
  if (msg.includes("aborted") || msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    console.error(`[BreedLog AI] kimi timeout`);
    return { ok: false, category: "timeout", safeMessage: "Kimi request timed out." };
  }
  if (status >= 500) {
    console.error(`[BreedLog AI] kimi server error (${status})`);
    return { ok: false, category: "other", safeMessage: "Kimi provider error." };
  }
  console.error(`[BreedLog AI] kimi unknown failure`);
  return { ok: false, category: "other", safeMessage: "Kimi provider unavailable." };
}

// ── Core request ──────────────────────────────────────────────────────────────

/**
 * Send a conversation to Kimi K3.
 *
 * @param messages  Full ordered messages array (system → history → user).
 * @param effort    "high" for farm/health/breeding, "low" for app-help.
 * @param timeoutMs Hard abort timeout in milliseconds.
 */
export async function askKimi(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | null; [key: string]: unknown }>,
  effort: KimiReasoningEffort = "high",
  timeoutMs = 30_000,
): Promise<KimiResponse> {
  if (!isKimiConfigured()) {
    return { ok: false, category: "auth", safeMessage: "KIMI_K3_API is not configured." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const client = getClient();

    // Build request — deliberately omit temperature/top_p/presence_penalty/frequency_penalty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model: KIMI_CONFIG.model,
      messages,
      max_completion_tokens: KIMI_CONFIG.maxCompletionTokens,
      reasoning_effort: effort,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "breedlog_ai_response",
          strict: true,
          schema: BREEDLOG_RESPONSE_SCHEMA,
        },
      },
    };

    const response = await client.chat.completions.create(params, {
      signal: controller.signal,
    });

    clearTimeout(timer);

    const choice = response.choices?.[0];
    if (!choice) {
      return { ok: false, category: "other", safeMessage: "Kimi returned no choices." };
    }

    const raw = choice.message as unknown as Record<string, unknown>;

    const message: KimiAssistantMessage = {
      role: "assistant",
      content: (raw.content as string | null) ?? null,
      // Preserve reasoning_content server-side only — never returned to callers
      ...(raw.reasoning_content !== undefined ? { reasoning_content: raw.reasoning_content as string } : {}),
      ...(raw.tool_calls !== undefined ? { tool_calls: raw.tool_calls as unknown[] } : {}),
    };

    if (!message.content && !message.tool_calls) {
      return { ok: false, category: "other", safeMessage: "Kimi returned empty content." };
    }

    return { ok: true, message, model: KIMI_CONFIG.model };
  } catch (err) {
    clearTimeout(timer);
    return classifyKimiError(err);
  }
}

// ── Canary probe ──────────────────────────────────────────────────────────────

/**
 * Minimal canary probe — one small request with low reasoning effort.
 * Used by /api/ai/canary to confirm Kimi is reachable.
 * Result is cached 60s by the caller.
 */
export async function runKimiCanary(timeoutMs = 10_000): Promise<{
  reachable: boolean;
  model: string | null;
  category: KimiError["category"] | null;
}> {
  if (!isKimiConfigured()) {
    return { reachable: false, model: null, category: "auth" };
  }
  const result = await askKimi(
    [
      { role: "system", content: 'Reply with exactly: {"answer":"OK","answerType":"help","confidence":"high","usedData":[],"warnings":[],"suggestedNextQuestions":[]}' },
      { role: "user", content: "Canary check." },
    ],
    "low",
    timeoutMs,
  );
  if (result.ok) {
    return { reachable: true, model: result.model, category: null };
  }
  return { reachable: false, model: null, category: result.category };
}
