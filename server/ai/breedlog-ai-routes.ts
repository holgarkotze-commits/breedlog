import type { Express, Request, Response } from "express";
import { requireDeviceAuth, getUserId } from "../device-auth";
import { storage } from "../storage";
import { EntitlementDeniedError, reserveUsage } from "../commercial";
import {
  isConfigured,
  generateContent,
  runCanary,
  getConfiguredModelChain,
} from "./gemini-provider";
import { buildBreedLogAIContext, type BreedLogAIContext } from "./breedlog-ai-context";
import { SYSTEM_PROMPT } from "./breedlog-ai-rules";
import { PROMPT_CATEGORIES, CATEGORY_KEYS } from "./breedlog-ai-prompts";
import { generateLocalFallback } from "./local-fallback";
import { z } from "zod";

const requireAuth = requireDeviceAuth;

// ── Provider state tracking ──────────────────────────────────────────────────

let _quotaExhaustedAt: number | null = null;
let _lastWorkingModel: string | null = null;
let _lastCanary: {
  at: number;
  reachable: boolean;
  modelUsed: string | null;
  quotaExhausted: boolean;
} | null = null;

const QUOTA_COOLDOWN_MS = 5 * 60_000;
const CANARY_CACHE_MS = 60_000;

function isQuotaExhausted(): boolean {
  if (!_quotaExhaustedAt) return false;
  if (Date.now() - _quotaExhaustedAt > QUOTA_COOLDOWN_MS) {
    _quotaExhaustedAt = null;
    return false;
  }
  return true;
}

function markQuotaExhausted(): void {
  _quotaExhaustedAt = Date.now();
}

function clearQuotaExhausted(): void {
  _quotaExhaustedAt = null;
}

async function getCanary() {
  if (_lastCanary && Date.now() - _lastCanary.at < CANARY_CACHE_MS) {
    return _lastCanary;
  }
  const result = await runCanary();
  _lastCanary = { at: Date.now(), ...result };
  if (result.reachable) {
    clearQuotaExhausted();
    if (result.modelUsed) _lastWorkingModel = result.modelUsed;
  } else if (result.quotaExhausted) {
    markQuotaExhausted();
  }
  return _lastCanary;
}

// ── Rate limiter ─────────────────────────────────────────────────────────────

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

// ── Gemini response parser ───────────────────────────────────────────────────

function parseAIResponse(text: string): {
  answer: string;
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
      confidence: "low",
      usedData: [],
      warnings: ["AI returned unstructured response. Showing raw output."],
      suggestedNextQuestions: [],
    };
  }
}

function buildUserMessage(question: string, context: BreedLogAIContext): string {
  return `BREEDLOG CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nFARMER QUESTION:\n${question}`;
}

const chatSchema = z.object({
  question: z.string().min(1).max(1000),
  category: z.string().optional(),
  animalId: z.number().int().positive().optional(),
  contextSection: z.string().max(80).optional(),
});

export function registerAIRoutes(app: Express): void {
  // GET /api/ai/health — honest provider status, no key leakage
  app.get("/api/ai/health", async (_req: Request, res: Response) => {
    const configured = isConfigured();
    const quotaFlag = isQuotaExhausted();
    const chain = getConfiguredModelChain();

    const providerStatus = !configured
      ? "not_configured"
      : quotaFlag
        ? "quota_exhausted"
        : "available";

    res.json({
      configured,
      quotaExhausted: quotaFlag,
      fallbackActive: configured && quotaFlag,
      providerStatus,
      modelChain: chain,
      activeModel: _lastWorkingModel,
      lastCanary: _lastCanary
        ? {
            at: _lastCanary.at,
            reachable: _lastCanary.reachable,
            modelUsed: _lastCanary.modelUsed,
          }
        : null,
      status: !configured
        ? "not_configured"
        : quotaFlag
          ? "fallback"
          : "ready",
      message: !configured
        ? "AI key is not configured. Add the Gemini secret to enable AI features."
        : quotaFlag
          ? "AI provider quota is exhausted on all configured models. Local record-based answers are active."
          : "BreedLog AI is ready.",
    });
  });

  // GET /api/ai/canary — actively probe the provider, returns honest status.
  // Cached for 60s to avoid burning quota.
  app.get("/api/ai/canary", async (_req: Request, res: Response) => {
    if (!isConfigured()) {
      return res.status(503).json({
        configured: false,
        reachable: false,
        message: "GEMINI_API_KEY is not configured.",
      });
    }
    const c = await getCanary();
    res.json({
      configured: true,
      reachable: c.reachable,
      modelUsed: c.modelUsed,
      quotaExhausted: c.quotaExhausted,
      cachedAt: c.at,
      modelChain: getConfiguredModelChain(),
      message: c.reachable
        ? `Live AI reachable via ${c.modelUsed}.`
        : c.quotaExhausted
          ? "All configured models are quota-exhausted."
          : "Provider unreachable. See server logs.",
    });
  });

  app.get("/api/ai/suggested-prompts", requireAuth, (_req: Request, res: Response) => {
    res.json({ categories: PROMPT_CATEGORIES });
  });

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

    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment before asking again." });
    }

    if (!isConfigured()) {
      return res.status(503).json({
        error: "BreedLog AI is not configured. GEMINI_API_KEY secret is missing.",
        configured: false,
      });
    }

    try {
      await reserveUsage(storage, userId, "aiActions");
    } catch (err) {
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      throw err;
    }

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

    function respondWithFallback(reason: "quota" | "unavailable") {
      const fallback = generateLocalFallback(question, context, category);
      const prefix =
        reason === "quota"
          ? "Live AI quota is temporarily exhausted — here is a record-based BreedLog summary:"
          : "Live AI is temporarily unavailable — here is a record-based BreedLog summary:";
      return res.json({
        ...fallback,
        answer: `${prefix}\n\n${fallback.answer}`,
        category: category || null,
        contextSection: contextSection || null,
      });
    }

    // Skip Gemini if we know quota is exhausted
    if (isQuotaExhausted()) {
      return respondWithFallback("quota");
    }

    const userMessage = buildUserMessage(question, context);
    const geminiResponse = await generateContent(SYSTEM_PROMPT, userMessage);

    if (geminiResponse.ok) {
      clearQuotaExhausted();
      if (geminiResponse.modelUsed) _lastWorkingModel = geminiResponse.modelUsed;
      const structured = parseAIResponse(geminiResponse.text);
      return res.json({
        ...structured,
        isFallback: false,
        modelUsed: geminiResponse.modelUsed || null,
        category: category || null,
        contextSection: contextSection || null,
      });
    }

    if (geminiResponse.quotaExhausted) {
      markQuotaExhausted();
      return respondWithFallback("quota");
    }

    // Other provider error — still serve a useful fallback rather than dead-end
    return respondWithFallback("unavailable");
  });
}
