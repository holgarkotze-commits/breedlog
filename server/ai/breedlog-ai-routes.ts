import type { Express, Request, Response } from "express";
import { requireDeviceAuth, getUserId } from "../device-auth";
import { storage } from "../storage";
import { isConfigured, generateContent } from "./gemini-provider";
import { buildBreedLogAIContext, type BreedLogAIContext } from "./breedlog-ai-context";
import { SYSTEM_PROMPT } from "./breedlog-ai-rules";
import { PROMPT_CATEGORIES, CATEGORY_KEYS } from "./breedlog-ai-prompts";
import { z } from "zod";

const requireAuth = requireDeviceAuth;

// Simple in-memory rate limiter: 20 requests per 60 seconds per userId
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

// Validate and parse the AI response from Gemini
function parseAIResponse(text: string): {
  answer: string;
  confidence: string;
  usedData: string[];
  warnings: string[];
  suggestedNextQuestions: string[];
} {
  try {
    // Strip markdown code fences if present
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
    // Model returned prose instead of JSON — wrap it
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
  // GET /api/ai/health — configuration check, no key leakage
  app.get("/api/ai/health", (req: Request, res: Response) => {
    res.json({
      configured: isConfigured(),
      model: isConfigured() ? (process.env.GEMINI_MODEL || "gemini-2.0-flash") : null,
      status: isConfigured() ? "ready" : "not_configured",
      message: isConfigured()
        ? "BreedLog AI is ready."
        : "AI key is not configured. Add the Gemini secret to enable AI features.",
    });
  });

  // GET /api/ai/suggested-prompts — static prompt metadata
  app.get("/api/ai/suggested-prompts", requireAuth, (req: Request, res: Response) => {
    res.json({ categories: PROMPT_CATEGORIES });
  });

  // GET /api/ai/context-summary — safe summary of available context for current user
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

  // POST /api/ai/chat — main AI chat endpoint
  app.post("/api/ai/chat", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;

    // Parse and validate request body
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request.",
        detail: parsed.error.issues.map((i) => i.message).join("; "),
      });
    }
    const { question, category, animalId, contextSection } = parsed.data;

    // Validate category if provided
    if (category && !CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ error: "Unknown category.", categories: CATEGORY_KEYS });
    }

    // Rate limit
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment before asking again." });
    }

    // Check AI is configured
    if (!isConfigured()) {
      return res.status(503).json({
        error: "BreedLog AI is not configured. GEMINI_API_KEY secret is missing.",
        configured: false,
      });
    }

    // Load workspace data
    try {
      const [animals, breedingEvents, performanceRecords, healthRecords, flockHealthEvents, matingGroups, farmSettings] =
        await Promise.all([
          storage.getAnimals(userId, {}),
          storage.getBreedingEvents(userId),
          storage.getAllPerformanceRecords(userId),
          storage.getAllHealthRecords(userId),
          storage.getFlockHealthEvents(userId),
          storage.getMatingGroups(userId),
          storage.getFarmSettings(userId),
        ]);

      // Build context
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

      // Call Gemini
      const userMessage = buildUserMessage(question, context);
      const geminiResponse = await generateContent(SYSTEM_PROMPT, userMessage);

      if (!geminiResponse.ok) {
        return res.status(502).json({
          error: geminiResponse.error || "AI provider unavailable. Please try again shortly.",
        });
      }

      const structured = parseAIResponse(geminiResponse.text);

      return res.json({
        ...structured,
        category: category || null,
        contextSection: contextSection || null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: "Failed to process AI request.", detail: msg });
    }
  });
}
