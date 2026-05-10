import type { Express, Request, Response } from "express";
import { requireDeviceAuth, getUserId } from "../device-auth";
import { storage } from "../storage";
import { isConfigured, generateContent } from "./gemini-provider";
import { buildBreedLogAIContext, type BreedLogAIContext } from "./breedlog-ai-context";
import { SYSTEM_PROMPT } from "./breedlog-ai-rules";
import { PROMPT_CATEGORIES, CATEGORY_KEYS } from "./breedlog-ai-prompts";
import { generateLocalFallback } from "./local-fallback";
import { z } from "zod";

const requireAuth = requireDeviceAuth;

// ── Quota exhaustion tracking ────────────────────────────────────────────────
// When Gemini returns 429/RESOURCE_EXHAUSTED we note the timestamp so that:
// a) Subsequent requests go straight to the local fallback (no wasted API call)
// b) /api/ai/health reflects the degraded state
// Clears automatically after 5 minutes (quota windows typically reset sooner).

let _quotaExhaustedAt: number | null = null;
const QUOTA_COOLDOWN_MS = 5 * 60_000; // 5 min

function isQuotaExhausted(): boolean {
  if (!_quotaExhaustedAt) return false;
  if (Date.now() - _quotaExhaustedAt > QUOTA_COOLDOWN_MS) {
    _quotaExhaustedAt = null; // expired — optimistically retry Gemini
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

// ── Gemini response parser ────────────────────────────────────────────────────

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
  // GET /api/ai/health — configuration and quota status check (no auth required)
  app.get("/api/ai/health", (_req: Request, res: Response) => {
    const quotaExhausted = isQuotaExhausted();
    const providerStatus = !isConfigured()
      ? "not_configured"
      : quotaExhausted
        ? "quota_exhausted"
        : "available";

    res.json({
      configured: isConfigured(),
      quotaExhausted,
      fallbackActive: isConfigured() && quotaExhausted,
      providerStatus,
      model: isConfigured() ? (process.env.GEMINI_MODEL || "gemini-2.0-flash") : null,
      status: isConfigured() ? (quotaExhausted ? "fallback" : "ready") : "not_configured",
      message: !isConfigured()
        ? "AI key is not configured. Add the Gemini secret to enable AI features."
        : quotaExhausted
          ? "AI provider quota is exhausted. Local record-based answers are active."
          : "BreedLog AI is ready.",
    });
  });

  // GET /api/ai/suggested-prompts — static prompt metadata
  app.get("/api/ai/suggested-prompts", requireAuth, (_req: Request, res: Response) => {
    res.json({ categories: PROMPT_CATEGORIES });
  });

  // GET /api/ai/context-summary — summary of available context for current user
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

  // POST /api/ai/chat — main AI chat endpoint with local fallback
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

    // If not configured at all, return 503
    if (!isConfigured()) {
      return res.status(503).json({
        error: "BreedLog AI is not configured. GEMINI_API_KEY secret is missing.",
        configured: false,
      });
    }

    // Load workspace data (needed for both Gemini context and local fallback)
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

    // ── If quota is already known-exhausted, skip Gemini entirely ──────────
    if (isQuotaExhausted()) {
      const fallback = generateLocalFallback(question, context, category);
      return res.json({
        ...fallback,
        answer: `Live AI polish is temporarily unavailable — here is a record-based BreedLog summary:\n\n${fallback.answer}`,
        category: category || null,
        contextSection: contextSection || null,
      });
    }

    // ── Try Gemini ──────────────────────────────────────────────────────────
    const userMessage = buildUserMessage(question, context);
    const geminiResponse = await generateContent(SYSTEM_PROMPT, userMessage);

    if (geminiResponse.ok) {
      clearQuotaExhausted();
      const structured = parseAIResponse(geminiResponse.text);
      return res.json({
        ...structured,
        isFallback: false,
        category: category || null,
        contextSection: contextSection || null,
      });
    }

    // ── Gemini failed — check if it's a quota error ─────────────────────────
    if (geminiResponse.quotaExhausted) {
      markQuotaExhausted();
      const fallback = generateLocalFallback(question, context, category);
      return res.json({
        ...fallback,
        answer: `Live AI polish is temporarily unavailable — here is a record-based BreedLog summary:\n\n${fallback.answer}`,
        isFallback: true,
        category: category || null,
        contextSection: contextSection || null,
      });
    }

    // ── Other provider error (timeout, auth, etc.) — still 502 ─────────────
    return res.status(502).json({
      error: geminiResponse.error || "AI provider unavailable. Please try again shortly.",
    });
  });
}
