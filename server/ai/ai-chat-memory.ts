/**
 * Server-side per-user AI chat memory for BreedLog.
 *
 * Stores the 5 most recent exchanges (farmer question + assistant response)
 * in the existing system-setting storage under a user-scoped key.
 *
 * KEY INVARIANTS:
 *  - Key is always derived server-side from the authenticated user's ID.
 *  - The client never controls which user ID is used.
 *  - reasoning_content is stored server-side for Kimi continuity but is
 *    NEVER returned through any public endpoint.
 *  - Farm context is NOT stored — it is always rebuilt from live records.
 *  - Memory survives server restarts, app restarts, and logout/re-login.
 *  - Memory is isolated per user.
 */

import type { IStorage } from "../storage";

export const MAX_EXCHANGES = 5;

const MEMORY_PREFIX = "breedlog:ai-memory:";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Full Kimi assistant message preserved server-side for conversation continuity. */
export interface StoredProviderMessage {
  role: "assistant";
  content: string | null;
  /** Internal reasoning — server-side only, never returned to client or logged. */
  reasoning_content?: string;
  tool_calls?: unknown[];
}

/** One stored exchange (question + response). */
export interface ChatExchange {
  /** The farmer's original question. */
  userMessage: string;
  /** Full provider assistant message — stays server-side. */
  providerMessage: StoredProviderMessage;
  /** Parsed visible answer — safe for history API. */
  parsedAnswer: {
    answer: string;
    answerType: string;
    confidence: string;
    usedData: string[];
    warnings: string[];
    suggestedNextQuestions: string[];
  };
  category: string | null;
  timestamp: string;
}

/** Safe public view of an exchange — no reasoning_content, no raw provider data. */
export interface PublicExchange {
  question: string;
  answer: string;
  answerType: string;
  confidence: string;
  usedData: string[];
  warnings: string[];
  suggestedNextQuestions: string[];
  timestamp: string;
}

// ── Storage key ───────────────────────────────────────────────────────────────

function memoryKey(userId: string): string {
  return `${MEMORY_PREFIX}${userId}`;
}

// ── Read / write helpers ──────────────────────────────────────────────────────

export async function loadMemory(storage: IStorage, userId: string): Promise<ChatExchange[]> {
  try {
    const raw = await storage.getSystemSetting(memoryKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidExchange);
  } catch {
    // Malformed data — reset rather than crash
    return [];
  }
}

async function saveMemory(storage: IStorage, userId: string, exchanges: ChatExchange[]): Promise<void> {
  const trimmed = exchanges.slice(-MAX_EXCHANGES);
  await storage.setSystemSetting(
    memoryKey(userId),
    JSON.stringify(trimmed),
    "BreedLog AI chat memory — server-side only",
  );
}

export async function clearMemory(storage: IStorage, userId: string): Promise<void> {
  await storage.deleteSystemSetting(memoryKey(userId));
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidExchange(x: unknown): x is ChatExchange {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.userMessage === "string" &&
    typeof e.providerMessage === "object" &&
    e.providerMessage !== null &&
    typeof e.timestamp === "string" &&
    typeof e.parsedAnswer === "object"
  );
}

// ── Append a new exchange ─────────────────────────────────────────────────────

export async function appendExchange(
  storage: IStorage,
  userId: string,
  exchange: ChatExchange,
): Promise<void> {
  const current = await loadMemory(storage, userId);
  current.push(exchange);
  // Retain only newest MAX_EXCHANGES
  await saveMemory(storage, userId, current);
}

// ── Build Kimi messages array from memory ─────────────────────────────────────

/**
 * Convert stored exchanges to the messages array format Kimi expects.
 * Preserves full assistant messages (including reasoning_content when present)
 * for proper conversation continuity.
 *
 * Returns only the history messages — caller adds system prompt and current
 * user message around them.
 */
export function buildHistoryMessages(
  exchanges: ChatExchange[],
): Array<{ role: "user" | "assistant"; content: string | null; [key: string]: unknown }> {
  const messages: Array<{ role: "user" | "assistant"; content: string | null; [key: string]: unknown }> = [];
  for (const ex of exchanges.slice(-MAX_EXCHANGES)) {
    messages.push({ role: "user", content: ex.userMessage });
    // Spread full provider message to preserve reasoning_content and tool_calls
    messages.push({ ...ex.providerMessage });
  }
  return messages;
}

// ── Public history (safe for API) ─────────────────────────────────────────────

export function toPublicHistory(exchanges: ChatExchange[]): PublicExchange[] {
  return exchanges.slice(-MAX_EXCHANGES).map((ex) => ({
    question: ex.userMessage,
    answer: ex.parsedAnswer.answer,
    answerType: ex.parsedAnswer.answerType,
    confidence: ex.parsedAnswer.confidence,
    usedData: ex.parsedAnswer.usedData,
    warnings: ex.parsedAnswer.warnings,
    suggestedNextQuestions: ex.parsedAnswer.suggestedNextQuestions,
    timestamp: ex.timestamp,
  }));
}
