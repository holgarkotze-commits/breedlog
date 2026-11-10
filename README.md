# BreedLog

BreedLog is an offline-capable livestock breeding and flock-management application for Meatmaster sheep farmers. The repository contains the web/PWA application, API server, shared domain contracts, automated tests, and Android/Windows wrappers.

## Quick start

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

The development server uses port `5000` by default.

## Verification

```bash
npm run check
npm test
npm run build
```

Additional platform and certification commands are listed in `package.json`.

## Repository structure

- `client/` — React/Vite frontend and PWA assets.
- `server/` — Express API, authentication, storage and AI provider adapters.
- `shared/` — shared schemas, API contracts and domain logic.
- `tests/` — unit, integration, isolation and browser certification tests.
- `android/` — Capacitor Android wrapper.
- `src-tauri/` — Tauri Windows desktop wrapper.
- `scripts/` and `script/` — executable build, certification and maintenance tooling.

Durable product requirements, architecture assessments, plans, handoffs, evidence and release records are maintained in the `holgarkotze-commits/PROJECT-ASSETS` repository under `breedlog/`. Generated output belongs in ignored local `artifacts/` or the relevant CI/release storage.

## Environment

Copy `.env.example` and provide the values needed for the mode being run. Production must use managed secrets; never commit credentials or real farm data.

### Controlled public trials

Farmer accounts use `/auth/register`, `/auth/login`, and `/auth/recovery`; existing invitation workspaces remain under `/beta`. Public registration always creates a new empty workspace. Paid plans and AI are not available to public trial accounts.

`BREEDLOG_PUBLIC_TRIAL_SIGNUP=disabled` pauses only new registrations, without preventing existing farmers from signing in. Recovery works with the one-time saved recovery code; email recovery is unavailable unless the existing SMTP configuration is supplied. Never log or persist the plaintext recovery code.

For an isolated preview, use `USE_IN_MEMORY_STORAGE=1 npm run dev` (or `npm start` after building). This mode never connects to SQL, skips startup migrations, and loses its test records on restart. Deployment still uses the normal database-backed start command; do not enable in-memory storage in a real release.

### PayToday annual candidate — NOT enabled

The server-only candidate reuses the observed FMD transport from
`Digital-Landing-Page/app.py` blob `497b6919764a875afec4f62ecfebd270d0eeaf37`.
It does **not** copy FMD's unsigned JWT decoding or infer merchant/currency
authorization. No real provider request is wired into the application.

`BREEDLOG_PAYTODAY_ENABLED` defaults off; setting it alone cannot enable payments.
No provider-confirmed contract is installed. Checkout and reconciliation return
unavailable until a reviewed contract verifies JWTs and exact merchant, currency
and amount units, and an explicitly approved merchant and versioned annual price
are composed into the existing billing lane. There is no approved new public
price, buy button, automatic recurring charge or settlement assertion.

`migrations/0001_paytoday_annual_candidate.sql` is prepared only: no startup
migration applies it. Apply/review only under separate deployment authority.
The existing Free/public-trial restrictions and public price catalogue are unchanged.
Intent tokens are encrypted at rest; only order IDs/status and approved hosted
checkout URLs may reach a client. Reconciliation uses the stored intent, never
browser-supplied payment status or tokens. Annual periods expire to Free without
deleting records; new annual access requires a fresh customer-authorized purchase.

Run `npm run test:paytoday` for fake-network/in-memory checks. SQL proof requires
the explicitly isolated `breedlog_test` certification database and
`BREEDLOG_ISOLATED_SQL_CERT=1 CI=true npm run test:paytoday-db`.
Synthetic test signing/context mappings are **not** PayToday contract evidence.

## Repository rules

Read `AGENTS.md` and `.stitchworx/project.yaml` before substantial changes. Keep runtime code, tests and code-facing configuration here. Do not add work orders, agent memory, build diaries, evidence packs or generated release output to this repository.
