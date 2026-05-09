# BreedLog AI Assistant Foundation

## Overview

Secure, read-only AI assistant powered by Google Gemini, grounded in the user's own BreedLog workspace data. Farmers can ask questions about their herd, sires, ewes, lambs, breeding results, health records, and data quality in plain language.

## Architecture

```
Frontend AI Panel (BreedLogAssistantPanel)
  → POST /api/ai/chat (authenticated)
  → Rate limiter (20 req/min per userId)
  → Workspace isolation check (getUserId → scoped storage calls)
  → BreedLog context builder (server/ai/breedlog-ai-context.ts)
  → Gemini provider adapter (server/ai/gemini-provider.ts)
  → Structured JSON response
  → Frontend renders answer + confidence + usedData + warnings + follow-ups
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ai/health` | None | Config check — returns `{configured, status, model}` without leaking key |
| GET | `/api/ai/suggested-prompts` | Required | Returns grouped prompt categories |
| GET | `/api/ai/context-summary` | Required | Safe summary of available context for current workspace |
| POST | `/api/ai/chat` | Required | Main chat endpoint |

### POST /api/ai/chat

**Request:**
```json
{
  "question": "string (1–1000 chars, required)",
  "category": "herd-overview | sire-performance | ... (optional)",
  "animalId": 123,
  "contextSection": "string (optional, max 80 chars)"
}
```

**Response:**
```json
{
  "answer": "Plain farmer language answer",
  "confidence": "high | medium | low | insufficient",
  "usedData": ["bullet list of data points used"],
  "warnings": ["caveats, data gaps, disclaimers"],
  "suggestedNextQuestions": ["2-3 follow-up questions"],
  "category": "herd-overview",
  "contextSection": null
}
```

## Required Secrets

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Google AI API key. Without this, `/api/ai/health` returns `configured: false` and all chat requests return 503. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-2.0-flash` if not set. |

Add these in **Replit Secrets** (never in source code).

## Data Isolation Rules

1. Every AI endpoint uses `requireDeviceAuth` middleware — same as all other app routes.
2. `getUserId(req)` returns the effective workspace userId (respecting shared workspaces).
3. All storage calls are scoped to that userId — `storage.getAnimals(userId)`, etc.
4. No raw database dumps sent to the model — data is summarised and capped (top 10 sires, etc.).
5. The model never receives another user's data under any code path.

## AI Safety Rules (System Prompt)

- Read-only: refuses to create, update, delete, or revoke records.
- No invented data: if context is insufficient, says "Not enough recorded data."
- Veterinary caution: summarises recorded events, always recommends a local vet.
- No market price predictions: explains limitation, discusses readiness from recorded weights.
- Confidence labelled on every answer: `high | medium | low | insufficient`.

## Prompt Categories

1. Herd Overview
2. Ram / Sire Performance
3. Ewe Maternal Performance
4. Lamb Growth
5. Breeding & Lambing
6. Health Records
7. Data Quality
8. Auction / Market Readiness
9. Animal Profile Help

## Context Builder

**File:** `server/ai/breedlog-ai-context.ts`

Collects and structures workspace data:
- Herd distribution (rams, ewes, lambs, culled, classification)
- Sire performance (top 10 by offspring, avg birth/weaning weight)
- Ewe maternal (active, lambed, barren, twin-bearing, top performers, watchlist)
- Lamb growth (count, avg birth weight, avg weaning weight, avg ADG)
- Reproductive (ewes joined/lambed, lambing rate, lambs per ewe)
- Health (flock events, animal records, treatments, mortality)
- Missing data counts (no birth date, no weaning weight, no sire link, etc.)
- Data quality score (0–100) with warnings
- Selected animal profile (when `animalId` provided)

Token control: all lists capped at 10 items; no raw animal dumps.

## Frontend UI

- **Floating "Ask BreedLog" button** — visible for all authenticated users, positioned above the mobile bottom nav.
- **AI Panel** — bottom sheet (mobile) / side drawer (desktop) with:
  - Category dropdown
  - Suggested prompt chips
  - Question textarea (Enter to send)
  - Bouncing dots loading state
  - Structured answer display (confidence badge, data used, caveats)
  - Follow-up question buttons
- **Data tab "Ask" buttons** — each section card has an inline "Ask" button that pre-fills the panel with the relevant category and section context.

## Tests

**File:** `tests/ai-assistant.test.ts`

Covers:
- `/api/ai/health` — returns 200, no key leak, publicly accessible
- `/api/ai/suggested-prompts` — requires auth, returns valid categories
- `/api/ai/context-summary` — requires auth, does not expose userId/token
- `/api/ai/chat` — rejects unauthenticated, validates question length, validates category, does not mutate data
- Context builder unit tests — empty input, rams/ewes count, sire performance, selectedAnimal

## Limitations

- AI is read-only. Cannot perform any app actions.
- Market price data is not connected. Readiness is based on recorded weights only.
- Veterinary advice is limited to recorded events — always consult a local vet.
- Context is limited to the current workspace. Multi-season analysis uses all-seasons data.
- Rate limit: 20 requests per 60 seconds per user.

## Next Phase

- Per-animal "Ask about this animal" button on AnimalDetail page (backend already supports `animalId` param).
- Season-aware context filtering.
- Streaming responses for longer answers.
- Conversation history (multi-turn chat).
- Export AI summary to PDF.
