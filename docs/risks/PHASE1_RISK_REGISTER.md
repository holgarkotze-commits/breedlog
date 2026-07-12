# Phase 1 Risk Register

| Risk | Evidence | Severity | Pre-existing | Future owner | Blocks Phase 1 |
|---|---|---|---|---|---|
| Access-code identity coupled to workspaces | `/api/beta/validate` in `server/routes.ts`; `users`, `invite_codes`, `user_activations` in `shared/schema.ts` | High | Yes | Auth/account migration phase | No |
| Device-token/localStorage exposure | `client/src/lib/queryClient.ts`; `server/device-auth.ts` | High | Yes | Auth/security phase | No |
| `U2A2ZAVQ` data leakage if guard weakened | `server/routes.ts`, `shared/master-simulation.ts`, `shared/breedlog-simulation.ts` | Critical | Yes risk, current guard present | All future phases | No |
| Relationship IDs are numeric and require owner checks | `animals.sireId/damId`, `breeding_events`, `mating_groups` in `shared/schema.ts` | Medium | Yes | Data migration/API hardening | No |
| User-facing JSON export remnants | `client/src/lib/feature-flags.ts` defines `export_json` though UI tests assert no normal JSON export | Medium | Yes | Export/governance phase | No |
| Backup integrity absent | No `.breedlogbackup` production implementation in current repo | High | Yes | Backup/reset/restore phase | No |
| Environment separation incomplete | Replit/config scripts and runtime env assumptions in `server/index.ts`, `replit.nix`, package scripts | Medium | Yes | Deployment phase | No |
| AI privacy | `server/ai/*` sends workspace summaries to provider when configured | High | Yes | AI/privacy governance | No |
| File storage assumptions | Base64/text image/document fields in `shared/schema.ts` and storage methods | Medium | Yes | Storage/backups phase | No |
| PWA cache update risk | `client/public/sw.js` caches app shell/API reads | Medium | Yes | PWA release phase | No |
| Missing monitoring and rollback evidence | No production monitoring/rollback manifest evidence before Phase 1 | High | Yes | Monitoring/final release phases | No |
| Test gaps around exported pure seeding function | `seedMasterSimulationIfNeeded` is private in `server/routes.ts` | Medium | Yes | Auth/data isolation hardening | No |
| Release reproducibility blocked by network | `git fetch`/`npm ci` logs in `evidence/baseline/` show environment blockers | High | Environment | Repository/network owner | Yes for full acceptance if unresolved |
