import { GoogleGenAI } from "@google/genai";
const key = process.env.GEMINI_API_KEY || "";
console.log("Key present:", key.length > 0, "length:", key.length, "prefix:", key.slice(0,4));
const candidates = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.5-flash-lite"];
const client = new GoogleGenAI({ apiKey: key });
for (const m of candidates) {
  try {
    const r = await client.models.generateContent({
      model: m,
      contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
      config: { temperature: 0, maxOutputTokens: 16 },
    });
    console.log(`OK ${m} -> "${(r.text ?? "").slice(0,40).replace(/\n/g," ")}"`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`ERR ${m} -> ${msg.slice(0, 280).replace(/\n/g, " ")}`);
  }
}
