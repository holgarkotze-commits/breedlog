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

## Repository rules

Read `AGENTS.md` and `.stitchworx/project.yaml` before substantial changes. Keep runtime code, tests and code-facing configuration here. Do not add work orders, agent memory, build diaries, evidence packs or generated release output to this repository.
