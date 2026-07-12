# Data Ownership and Isolation Map — Phase 1

## Current identity model

Current BreedLog identity is access-code and device based. `server/device-auth.ts` registers a device, issues an HMAC device token, stores it client-side, and resolves requests to `req.deviceAuth.userId`. `server/routes.ts` wraps protected APIs with `requireDeviceAuth` and obtains the effective workspace user ID before calling storage.

`/api/beta/validate` in `server/routes.ts` uppercases the access code, loads `invite_codes`, checks status/expiry, identifies the device type, evaluates slot availability through `server/invite-activation.ts`, creates or updates `user_activations`, persists a per-code workspace identity in `system_settings` as `workspace:invite_code:<id>`, and sets `shared_user_id` when a secondary device or workspace switch should point to an existing workspace.

## Ownership fields and boundaries

| Entity | Primary identifier | Owner field | Boundary implementation | Leakage risk |
|---|---:|---|---|---|
| Access code | `invite_codes.id`, `code` | global | Admin and activation routes query by code; workspace mapping stored in `system_settings` | Access-code identity is coupled to workspace creation until future auth phase. |
| User/device | `users.id`, `device_id` | user row/effective workspace | `shared_user_id` points secondary devices to primary workspace | Device token/localStorage theft could expose workspace. |
| Session | session ID/device token | `userId`, `deviceId` | `requireDeviceAuth` and token validation | Session secret and token storage remain critical. |
| Workspace | effective `userId` | `users.id` or persisted stub | `workspace:invite_code:<id>` mapping and `shared_user_id` | Future migration must preserve mapping. |
| Farm profile | `farm_settings.id` | `userId` | storage methods `getFarmSettings`/`saveFarmSettings` require userId | Low if storage boundary is preserved. |
| Animal/status/parentage | `animals.id` | `userId` | `getAnimals`, `getAnimal`, `createAnimal`, `updateAnimal`, `deleteAnimal` filter/write by userId | Parent IDs are numeric; route/storage owner checks are mandatory. |
| Mating/breeding/progeny | table IDs | `userId` | storage methods require userId; route calls pass effective userId | Relationship IDs require same-workspace validation discipline. |
| Health/treatment/weight/performance | table IDs | `userId` | storage methods require userId | Low for reads; route validation gaps should be monitored. |
| Images/documents/evaluations | table IDs | `userId` | reads are scoped by `userId`, but current image/evaluation create routes stamp caller `userId` onto the submitted `animalId` without first proving the animal belongs to that workspace | Cross-workspace foreign-key misuse must be closed in a future hardening phase. |
| Export records | `exported_documents.id` | `userId` | `getExportedDocuments(userId, subfolder)` filters by userId | Export generation must keep using scoped inputs. |
| Backup/import | CSV import routes and future backup surfaces | effective userId | CSV import creates records under current userId | Future `.breedlogbackup` not implemented in Phase 1. |

## `U2A2ZAVQ` complete trace

`U2A2ZAVQ` is centralized in `shared/master-simulation.ts` as `MASTER_SIMULATION_ACCESS_CODE`. `server/invite-activation.ts` recognizes the code and allows up to `MASTER_SIMULATION_MAX_DEVICES` unique active devices rather than the normal one-mobile/one-desktop slot policy. `server/routes.ts` calls `seedMasterSimulationIfNeeded(effectiveUserId, inviteCode.code)` only after `/api/beta/validate` has resolved the effective workspace for the code.

`seedMasterSimulationIfNeeded` immediately returns unless `isMasterSimulationCode(code)` is true. For the master code only, it checks existing animals in the target workspace for `MASTER_SIMULATION_BATCH_MARKER` and then inserts the deterministic Kwantam dataset from `shared/breedlog-simulation.ts`: animals, parent relationships, mating groups, breeding events, health records, flock health events/treatments, and demo genetics bloodlines. This idempotency marker prevents repeated activation from accumulating duplicate simulation animals.

Normal accounts are prevented from receiving Kwantam data by three current boundaries: the master-code guard in `server/routes.ts`, per-code workspace resolution before seeding, and storage reads/writes scoped by `userId`. The residual risk is that `seedMasterSimulationIfNeeded` is private to `server/routes.ts` and tested through integration/static tests rather than a separately exported pure function; future auth/migration work must preserve the guard and workspace mapping.

## Phase 1 isolation proof

`tests/isolation/phase1-data-isolation.test.ts` adds deterministic in-memory tests proving clean ordinary workspaces, scoped animal reads by ID, export-record scoping, simulation marker idempotency, master-code constant recognition, and fixture metadata determinism. Existing tests also cover master-code multi-device behavior and workspace switching.
