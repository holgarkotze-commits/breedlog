import type { Express, Request, Response } from "express";
import { requireDeviceAuth, getUserId } from "../device-auth";
import { storage } from "../storage";
import { EntitlementDeniedError, reserveUsage } from "../commercial";
import {
  askProviders,
  selectReasoningEffort,
  getHealthInfo,
  getCanaryStatus,
} from "./ai-provider";
import { isKimiConfigured } from "./ai-config";
import { buildBreedLogAIContext, type BreedLogAIContext } from "./breedlog-ai-context";
import { SYSTEM_PROMPT } from "./breedlog-ai-rules";
import { PROMPT_CATEGORIES, CATEGORY_KEYS } from "./breedlog-ai-prompts";
import { generateLocalFallback } from "./local-fallback";
import {
  loadMemory,
  appendExchange,
  clearMemory,
  buildHistoryMessages,
  toPublicHistory,
  type ChatExchange,
} from "./ai-chat-memory";
import { z } from "zod";

const requireAuth = requireDeviceAuth;

// ── Rate limiter (short-window abuse protection — separate from plan quota) ───

const rateLimiter = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(userId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimiter.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── AI response parser ────────────────────────────────────────────────────────

function parseAIResponse(text: string): {
  answer: string;
  answerType: string;
  confidence: string;
  usedData: string[];
  warnings: string[];
  suggestedNextQuestions: string[];
} {
  try {
    const stripped = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(stripped);
    return {
      answer: String(parsed.answer || ""),
      answerType: ["help", "data", "hybrid", "unsupported"].includes(parsed.answerType)
        ? parsed.answerType
        : "data",
      confidence: ["high", "medium", "low", "insufficient"].includes(parsed.confidence)
        ? parsed.confidence
        : "low",
      usedData: Array.isArray(parsed.usedData) ? parsed.usedData.slice(0, 10).map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 5).map(String) : [],
      suggestedNextQuestions: Array.isArray(parsed.suggestedNextQuestions)
        ? parsed.suggestedNextQuestions.slice(0, 3).map(String)
        : [],
    };
  } catch {
    return {
      answer: text.slice(0, 2000),
      answerType: "data",
      confidence: "low",
      usedData: [],
      warnings: ["AI returned unstructured response. Showing raw output."],
      suggestedNextQuestions: [],
    };
  }
}

// ── Context → user message string ────────────────────────────────────────────

function buildUserMessage(question: string, context: BreedLogAIContext): string {
  const anchor = [
    `VERIFIED LIVE COUNTS (use ONLY these — do NOT substitute any other numbers):`,
    `  total animals in workspace: ${context.workspace.totalAnimals}`,
    `  active animals: ${context.herd.active}`,
    `  active rams: ${context.herd.rams}`,
    `  active ewes: ${context.herd.ewes}`,
    `  active lambs (≤365 days): ${context.herd.lambs}`,
    `  culled: ${context.herd.culled}`,
    `  farm name: ${context.workspace.farmName ?? "not set"}`,
  ].join("\n");

  return (
    `${anchor}\n\n` +
    `==== FULL BREEDLOG CONTEXT (authoritative — ignore any other numbers) ====\n` +
    `${JSON.stringify(context, null, 2)}\n` +
    `==== END CONTEXT ====\n\n` +
    `FARMER QUESTION:\n${question}`
  );
}

const chatSchema = z.object({
  question: z.string().min(1).max(1000),
  category: z.string().optional(),
  animalId: z.number().int().positive().optional(),
  contextSection: z.string().max(80).optional(),
});

export function registerAIRoutes(app: Express): void {

  // ── GET /api/ai/health — honest provider status, no key leakage ─────────────
  app.get("/api/ai/health", async (_req: Request, res: Response) => {
    const info = getHealthInfo();
    const configured = info.kimiConfigured || info.geminiConfigured;
    // Combined quota flag: true when every configured live provider is quota-exhausted
    const quotaExhausted = configured && info.kimiQuotaExhausted && (!info.geminiConfigured || info.geminiQuotaExhausted);
    // fallbackActive = local (deterministic) fallback is active.
    // Must be false whenever quotaExhausted is false — the test invariant.
    const fallbackActive = quotaExhausted;
    const providerStatus = !configured
      ? "not_configured"
      : quotaExhausted
        ? "quota_exhausted"
        : "available";

    res.json({
      configured,
      primaryProvider: info.primaryProvider,
      primaryModel: info.primaryModel,
      kimiConfigured: info.kimiConfigured,
      geminiConfigured: info.geminiConfigured,
      // Backwards-compat fields expected by existing tests
      quotaExhausted,
      fallbackActive,
      providerStatus,
      modelChain: info.geminiModelChain,  // Gemini chain for existing test compatibility
      activeModel: info.activeModel,
      // Detailed fields
      localFallbackActive: info.localFallbackActive,
      activeProvider: info.activeProvider,
      geminiModelChain: info.geminiModelChain,
      kimiQuotaExhausted: info.kimiQuotaExhausted,
      geminiQuotaExhausted: info.geminiQuotaExhausted,
      status: !configured
        ? "not_configured"
        : quotaExhausted
          ? "fallback"
          : "ready",
      message: !configured
        ? "No AI provider configured. Add KIMI_K3_API or GEMINI_API_KEY."
        : info.kimiConfigured
          ? "BreedLog AI ready — Kimi K3 primary."
          : "BreedLog AI ready — Gemini fallback.",
    });
  });

  // ── GET /api/ai/canary — actively probe the primary provider ────────────────
  app.get("/api/ai/canary", async (_req: Request, res: Response) => {
    if (!isKimiConfigured()) {
      // Check if Gemini is configured before reporting unconfigured
      const info = getHealthInfo();
      if (!info.geminiConfigured) {
        return res.status(503).json({
          configured: false,
          reachable: false,
          provider: "none",
          message: "No AI provider configured.",
        });
      }
    }
    const c = await getCanaryStatus();
    const info = getHealthInfo();
    res.json({
      configured: true,
      reachable: c.reachable,
      provider: c.provider,
      model: c.model,
      // Backwards-compat: existing test expects modelChain when configured
      modelChain: info.geminiModelChain,
      modelUsed: c.model,
      category: c.category,
      cachedAt: c.at,
      message: c.reachable
        ? `Live AI reachable via ${c.provider} / ${c.model}.`
        : c.category === "auth"
          ? `Provider authentication failed. Check credentials.`
          : c.category === "quota"
            ? `Provider quota exhausted.`
            : "Provider unreachable. See server logs.",
    });
  });

  // ── GET /api/ai/suggested-prompts ───────────────────────────────────────────
  app.get("/api/ai/suggested-prompts", requireAuth, (_req: Request, res: Response) => {
    res.json({ categories: PROMPT_CATEGORIES });
  });

  // ── GET /api/ai/context-summary ─────────────────────────────────────────────
  app.get("/api/ai/context-summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req)!;
      const [animals, breedingEvents, healthRecords, flockHealthEvents] = await Promise.all([
        storage.getAnimals(userId, {}),
        storage.getBreedingEvents(userId),
        storage.getAllHealthRecords(userId),
        storage.getFlockHealthEvents(userId),
      ]);
      res.json({
        animalsCount: animals.length,
        breedingEventsCount: breedingEvents.length,
        healthRecordsCount: healthRecords.length,
        flockHealthEventsCount: flockHealthEvents.length,
        hasData: animals.length > 0,
        categories: CATEGORY_KEYS,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "Failed to summarise context.", detail: msg });
    }
  });

  // ── GET /api/ai/history — safe public history for the authenticated user ────
  app.get("/api/ai/history", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const exchanges = await loadMemory(storage, userId);
      res.json({ exchanges: toPublicHistory(exchanges) });
    } catch {
      res.json({ exchanges: [] });
    }
  });

  // ── DELETE /api/ai/history — clear the authenticated user's AI memory ───────
  app.delete("/api/ai/history", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      await clearMemory(storage, userId);
      res.json({ ok: true, message: "Conversation history cleared." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "Failed to clear history.", detail: msg });
    }
  });

  // ── POST /api/ai/chat ────────────────────────────────────────────────────────
  app.post("/api/ai/chat", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request.",
        detail: parsed.error.issues.map((i) => i.message).join("; "),
      });
    }
    const { question, category, animalId, contextSection } = parsed.data;

    if (category && !CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ error: "Unknown category.", categories: CATEGORY_KEYS });
    }

    // Short-window abuse rate limiter — applies to all users including internal-test
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment before asking again." });
    }

    // Plan quota reservation — internal-test entitlement bypasses this (no extra check needed here,
    // reserveUsage handles it via isInternalTestEntitlement())
    try {
      await reserveUsage(storage, userId, "aiActions");
    } catch (err) {
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    // Load workspace data — always rebuilt fresh, never from memory
    let animals: Awaited<ReturnType<typeof storage.getAnimals>>;
    let breedingEvents: Awaited<ReturnType<typeof storage.getBreedingEvents>>;
    let performanceRecords: Awaited<ReturnType<typeof storage.getAllPerformanceRecords>>;
    let healthRecords: Awaited<ReturnType<typeof storage.getAllHealthRecords>>;
    let flockHealthEvents: Awaited<ReturnType<typeof storage.getFlockHealthEvents>>;
    let matingGroups: Awaited<ReturnType<typeof storage.getMatingGroups>>;
    let farmSettings: Awaited<ReturnType<typeof storage.getFarmSettings>>;

    try {
      [animals, breedingEvents, performanceRecords, healthRecords, flockHealthEvents, matingGroups, farmSettings] =
        await Promise.all([
          storage.getAnimals(userId, {}),
          storage.getBreedingEvents(userId),
          storage.getAllPerformanceRecords(userId),
          storage.getAllHealthRecords(userId),
          storage.getFlockHealthEvents(userId),
          storage.getMatingGroups(userId),
          storage.getFarmSettings(userId),
        ]);
    } catch (err) {
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "Failed to load workspace data.", detail: msg });
    }

    const context = buildBreedLogAIContext({
      animals,
      breedingEvents,
      performanceRecords,
      healthRecords,
      flockHealthEvents,
      matingGroups,
      farmSettings,
      animalId,
      contextSection,
    });

    // Local fallback builder
    function buildFallbackResponse(reason: "quota" | "unavailable") {
      const fallback = generateLocalFallback(question, context, category);
      const prefix =
        reason === "quota"
          ? "Live AI quota is temporarily exhausted — here is a record-based BreedLog summary:"
          : "Live AI is temporarily unavailable — here is a record-based BreedLog summary:";
      return {
        ...fallback,
        answer: `${prefix}\n\n${fallback.answer}`,
        answerType: fallback.isFallback ? "data" : "data",
        category: category || null,
        contextSection: contextSection || null,
        isFallback: true,
      };
    }

    // Build current user message text (fresh farm context — never stale)
    const userMessageText = buildUserMessage(question, context);

    // Load prior conversation memory
    const priorExchanges = await loadMemory(storage, userId);
    const historyMessages = buildHistoryMessages(priorExchanges);

    // Assemble full Kimi messages array:
    // 1. System prompt
    // 2. Prior exchanges (up to 5)
    // 3. Current user message (with fresh farm context)
    const reasoningEffort = selectReasoningEffort(category);
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string | null; [key: string]: unknown }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMessages,
      { role: "user", content: userMessageText },
    ];

    const result = await askProviders(messages, SYSTEM_PROMPT, userMessageText, reasoningEffort);

    if (result.ok) {
      const structured = parseAIResponse(result.rawText);
      const exchange: ChatExchange = {
        userMessage: question,
        providerMessage: result.providerMessage,
        parsedAnswer: structured,
        category: category || null,
        timestamp: new Date().toISOString(),
      };
      // Persist exchange — fire-and-forget, do not block response
      appendExchange(storage, userId, exchange).catch(() => {/* non-fatal */});

      return res.json({
        ...structured,
        isFallback: false,
        provider: result.provider,
        model: result.model,
        category: category || null,
        contextSection: contextSection || null,
      });
    }

    // Provider failure — local fallback
    const fallbackResult = buildFallbackResponse(
      result.safeReason === "quota" ? "quota" : "unavailable",
    );

    // Store fallback exchange as content-only message
    const fallbackExchange: ChatExchange = {
      userMessage: question,
      providerMessage: { role: "assistant", content: fallbackResult.answer },
      parsedAnswer: {
        answer: fallbackResult.answer,
        answerType: "data",
        confidence: fallbackResult.confidence,
        usedData: fallbackResult.usedData,
        warnings: fallbackResult.warnings,
        suggestedNextQuestions: fallbackResult.suggestedNextQuestions,
      },
      category: category || null,
      timestamp: new Date().toISOString(),
    };
    appendExchange(storage, userId, fallbackExchange).catch(() => {/* non-fatal */});

    return res.json(fallbackResult);
  });
}
