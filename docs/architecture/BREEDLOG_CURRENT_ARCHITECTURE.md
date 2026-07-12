# BreedLog Current Architecture — Phase 1 verified baseline

Issue #32 scope: document the current repository before commercial production changes. This file is evidence, not a future-state design.

## Repository baseline

The local repository began on branch `work` at `8bdff7db99af70a37a45e3596edf25507deca845`. The container initially had no Git remote configured; `origin` was added as `https://github.com/holgarkotze-commits/breedlog.git`, but `git fetch origin --prune` was blocked by `CONNECT tunnel failed, response 403`, so `origin/main` could not be verified in this environment. Evidence is in `evidence/baseline/repository-truth-2026-07-11.md` and command logs in `evidence/baseline/`.

## Frontend

BreedLog is a Vite React 18 TypeScript application. The Vite entry points are `client/index.html`, `client/src/main.tsx`, and `client/src/App.tsx`; build configuration is in `vite.config.ts`, TypeScript configuration in `tsconfig.json`, Tailwind in `tailwind.config.ts`, and PostCSS in `postcss.config.js`. Routing is client-side with `wouter` and page modules under `client/src/pages/` including `Dashboard.tsx`, `Animals.tsx`, `AnimalDetail.tsx`, `Breeding.tsx`, `Health.tsx`, `Records.tsx`, `Analysis.tsx`, `Genetics.tsx`, `Settings.tsx`, `Admin.tsx`, and `ReportIssue.tsx`.

State and server synchronization use TanStack Query through `client/src/lib/queryClient.ts` plus domain hooks in `client/src/hooks/` (`use-animals.ts`, `use-breeding.ts`, `use-records.ts`, `use-farm-settings.ts`, `use-ai-status.ts`, and related hooks). Forms use React Hook Form and Zod resolver dependencies. Component architecture combines app components in `client/src/components/` with shadcn/Radix-style UI primitives in `client/src/components/ui/`. Styling uses Tailwind CSS and `client/src/index.css`.

Client persistence exists in localStorage for device token handling in `client/src/lib/queryClient.ts` and IndexedDB helpers in `client/src/lib/indexeddb.ts`; offline request handling is in `client/src/lib/offline-data.ts` and `client/src/lib/sync-manager.ts`. PWA assets are under `client/public/manifest.json`, `client/public/sw.js`, and `client/public/icons/`. The service worker caches shell assets and selected API reads including exported documents; update and install behavior is surfaced by `client/src/hooks/use-pwa-install.ts` and `client/src/components/PWAInstallPrompt.tsx`.

## Backend

The server is Express on Node/TypeScript. The entry point is `server/index.ts`; HTTP route registration is centralized in `server/routes.ts`; Vite/static serving helpers are in `server/vite.ts` and `server/static.ts`. Authentication is current device/access-code auth in `server/device-auth.ts` and invite-code activation rules in `server/invite-activation.ts`. Routes require device auth via `requireDeviceAuth` for livestock data, use admin PIN middleware for admin routes, and resolve the effective workspace user ID before calling storage.

API conventions are JSON request/response with shared route/schema definitions in `shared/routes.ts` and `shared/schema.ts`. Validation uses Zod schemas from the shared API definitions and Drizzle-generated insert schemas. Error handling is route-local for validation and duplicate-record errors, then falls through to Express error handling. File-upload and binary-like storage are mostly base64/text fields for animal photos, animal images, documents, evaluation documents, generated export metadata, and imported CSV content.

AI functionality is the authenticated BreedLog assistant registered from `server/ai/breedlog-ai-routes.ts`; provider logic is in `server/ai/gemini-provider.ts`, prompts/rules/context in `server/ai/`, and local fallback in `server/ai/local-fallback.ts`. Replit template chat/image/audio routes exist under `server/replit_integrations/` but `server/routes.ts` explicitly does not register the unauthenticated template AI surfaces.

## Database and storage

The production persistence layer is PostgreSQL through Drizzle ORM. Connection setup is in `server/db.ts`; schema is in `shared/schema.ts` plus auth/chat models under `shared/models/`; Drizzle configuration is `drizzle.config.ts`. Startup bootstrap SQL and migration hardening live in `server/index.ts`. A full in-memory implementation for tests is in `server/storage.ts` and selected by `USE_IN_MEMORY_STORAGE=1`.

Major owned tables include `animals`, `mating_groups`, `breeding_events`, `offspring`, `performance_records`, `health_records`, `evaluations`, `farm_settings`, `documents`, `animal_images`, `eid_scan_events`, `exported_documents`, `flock_health_events`, `flock_health_treatments`, genetics tables, field issues, activity events, and app sessions. Each domain table uses `user_id`/`userId` ownership. Identity tables include `users`, `invite_codes`, `user_activations`, `sessions`, and `system_settings`.

## Domain data and exports

Domain modules cover animals, statuses/classification, parentage (`sireId`, `damId`, external sire/dam info), mating groups, breeding events, offspring, health records, flock health/treatments, weights/performance fields, lambing/weaning status, documents/images/evaluations, genetics, analysis, notes, and exported documents. Export code includes PDF utilities in `client/src/lib/pdf-utils.ts`, CSV import/export in `shared/import-export.ts`, Stamboek CSV field builders in `client/src/lib/stamboek-export-fields.ts`, and export history APIs in `server/routes.ts`. Existing docs state JSON is not presented as a normal user export, but `client/src/lib/feature-flags.ts` still defines an `export_json` flag; this is recorded as a future risk rather than removed in Phase 1.

## Build, CI, and release

Package scripts in `package.json` define `npm ci`, `npm run check`, `npm run test:cert`, `npm run build`, `npm test`, browser certification, release gate, and field-test seed/cleanup scripts. CI is `.github/workflows/ci.yml`; branch protection notes are `.github/BRANCH_PROTECTION.md`. Release handoff and historical verification documents are under `docs/release/`; no immutable manifest schema existed before this Phase 1 change.
