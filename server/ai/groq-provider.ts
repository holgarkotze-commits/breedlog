/**
 * Groq GPT-OSS 120B provider for BreedLog AI.
 *
 * Uses the installed OpenAI-compatible SDK with Groq's base URL.
 * API key is read from process.env.GROQ_API_KEY || process.env.Groq_api_key — never logged or returned.
 *
 * DO NOT:
 *  - Log the key, prompts, farm context, or Groq reasoning output.
 *  - Return Groq reasoning to callers — stay server-side.
 *  - Send unsupported parameters (temperature, top_p, presence_penalty, frequency_penalty,
 *    logprobs, logit_bias, top_logprobs, messages[].name, n>1, reasoning_format).
 *
 * reasoning_effort:
 *  "high"   — farm data, health, breeding, genetics, multi-record analysis
 *  "medium" — ordinary summaries and record explanations
 *  "low"    — simple app-help / navigation questions
 */

import OpenAI from "openai";
import { GROQ_CONFIG, isGroqConfigured } from "./ai-config";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GroqReasoningEffort = "high" | "medium" | "low";

/** Groq assistant message — content only. Groq reasoning is never stored or returned. */
export interface GroqAssistantMessage {
  role: "assistant";
  content: string | null;
}

export interface GroqResult {
  ok: true;
  message: GroqAssistantMessage;
  model: string;
}

export interface GroqError {
  ok: false;
  /** Classified error category — safe to log. Never expose raw error text to user. */
  category: "auth" | "quota" | "timeout" | "notfound" | "other";
  /** Safe short description (no key, no prompt, no response body). */
  safeMessage: string;
}

export type GroqResponse = GroqResult | GroqError;

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
      // Standard uppercase alias takes precedence; Replit-named secret is fallback.
      apiKey: process.env.GROQ_API_KEY || process.env.Groq_api_key || "",
      baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    });
  }
  return _client;
}

// ── Error classification ──────────────────────────────────────────────────────

function classifyGroqError(err: unknown): GroqError {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 0;

  if (status === 401 || status === 403 || msg.includes("authentication") || msg.includes("API key")) {
    console.error(`[BreedLog AI] groq auth failure (${status})`);
    return { ok: false, category: "auth", safeMessage: "Groq authentication failed." };
  }
  if (status === 404 || msg.includes("404") || msg.includes("not found") || msg.includes("NOT_FOUND")) {
    console.error(`[BreedLog AI] groq model/endpoint not found (${status})`);
    return { ok: false, category: "notfound", safeMessage: "Groq model or endpoint unavailable." };
  }
  if (status === 429 || msg.includes("429") || msg.includes("quota") || msg.includes("rate limit")) {
    console.error(`[BreedLog AI] groq quota/rate-limit (${status})`);
    return { ok: false, category: "quota", safeMessage: "Groq quota or rate limit reached." };
  }
  if (msg.includes("aborted") || msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    console.error(`[BreedLog AI] groq timeout`);
    return { ok: false, category: "timeout", safeMessage: "Groq request timed out." };
  }
  if (status >= 500) {
    console.error(`[BreedLog AI] groq server error (${status})`);
    return { ok: false, category: "other", safeMessage: "Groq provider error." };
  }
  console.error(`[BreedLog AI] groq unknown failure`);
  return { ok: false, category: "other", safeMessage: "Groq provider unavailable." };
}

// ── Core request ──────────────────────────────────────────────────────────────

/**
 * Send a conversation to Groq GPT-OSS 120B.
 *
 * @param messages  Full ordered messages array (system → history → user).
 * @param effort    "high" for farm/health/breeding/genetics, "medium" for summaries, "low" for app-help.
 * @param timeoutMs Hard abort timeout in milliseconds.
 */
export async function askGroq(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | null; [key: string]: unknown }>,
  effort: GroqReasoningEffort = "high",
  timeoutMs = 30_000,
): Promise<GroqResponse> {
  if (!isGroqConfigured()) {
    return { ok: false, category: "auth", safeMessage: "GROQ_API_KEY is not configured." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const client = getClient();

    // Build request — only supported Groq params.
    // Deliberately omit: temperature, top_p, presence_penalty, frequency_penalty,
    // logprobs, logit_bias, top_logprobs, n>1, messages[].name, reasoning_format.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model: GROQ_CONFIG.model,
      messages,
      stream: false,
      max_completion_tokens: GROQ_CONFIG.maxCompletionTokens,
      reasoning_effort: effort,
      include_reasoning: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "breedlog_answer",
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
      return { ok: false, category: "other", safeMessage: "Groq returned no choices." };
    }

    // Parse only message.content — Groq reasoning is never stored or returned.
    const content = (choice.message as any).content as string | null;

    if (!content) {
      return { ok: false, category: "other", safeMessage: "Groq returned empty content." };
    }

    return {
      ok: true,
      message: { role: "assistant", content },
      model: GROQ_CONFIG.model,
    };
  } catch (err) {
    clearTimeout(timer);
    return classifyGroqError(err);
  }
}

// ── Canary probe ──────────────────────────────────────────────────────────────

/**
 * Minimal canary probe — one small request with low reasoning effort, include_reasoning: false.
 * Used by /api/ai/canary to confirm Groq is reachable.
 * Result is cached 60s by the caller.
 */
export async function runGroqCanary(timeoutMs = 10_000): Promise<{
  reachable: boolean;
  model: string | null;
  category: GroqError["category"] | null;
}> {
  if (!isGroqConfigured()) {
    return { reachable: false, model: null, category: "auth" };
  }
  const result = await askGroq(
    [
      {
        role: "system",
        content:
          'Reply with exactly: {"answer":"OK","answerType":"help","confidence":"high","usedData":[],"warnings":[],"suggestedNextQuestions":[]}',
      },
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
