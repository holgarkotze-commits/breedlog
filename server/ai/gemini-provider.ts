import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL   = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export function isConfigured(): boolean {
  return GEMINI_API_KEY.length > 0;
}

export interface GeminiResponse {
  text: string;
  ok: boolean;
  error?: string;
}

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return _client;
}

export async function generateContent(
  systemPrompt: string,
  userMessage: string,
  timeoutMs = 25_000,
): Promise<GeminiResponse> {
  if (!isConfigured()) {
    return { ok: false, text: "", error: "GEMINI_API_KEY not configured" };
  }

  try {
    const client = getClient();

    const abortController = new AbortController();
    const timer = setTimeout(() => abortController.abort(), timeoutMs);

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    clearTimeout(timer);

    const text = response.text ?? "";
    return { ok: true, text };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("aborted") || msg.includes("timeout")) {
      return { ok: false, text: "", error: "AI provider timed out" };
    }
    return { ok: false, text: "", error: `AI provider error: ${msg}` };
  }
}
