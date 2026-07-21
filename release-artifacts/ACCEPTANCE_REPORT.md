# BreedLog PR #44 Acceptance Report

- Product build source branch: `breedlog-production-completion`
- Product build source commit: `fff61484dea330ba5921780d92af7c49bbe1d147`
- Release pack refreshed: `2026-07-16T19:26:43.997Z`
- PR: [#44](https://github.com/holgarkotze-commits/breedlog/pull/44)
- PR state: draft, merge state `CLEAN`

## Verification summary

- `npm ci`: PASS
- `npm run check`: PASS
- `npm run build`: PASS
- `npm run test:cert`: PASS
  - totals: `572` tests, `568` pass, `0` fail, `4` skipped
- `npm run android:sync`: PASS with `BREEDLOG_NATIVE_BUILD_TARGET=android` and `VITE_BREEDLOG_API_ORIGIN=https://app.breedlog.com`
- `cargo check --manifest-path src-tauri/Cargo.toml`: PASS
- `npm run windows:build`: PASS with `BREEDLOG_NATIVE_BUILD_TARGET=windows` and `VITE_BREEDLOG_API_ORIGIN=https://app.breedlog.com`
- `git diff --check`: PASS before staging the release-pack refresh

## CI verification on `fff6148`

- Android wrapper build: PASS
  - [run/job](https://github.com/holgarkotze-commits/breedlog/actions/runs/29526730583/job/87716890808)
- Type-check, Build & Test: PASS
  - [run/job](https://github.com/holgarkotze-commits/breedlog/actions/runs/29526726852/job/87716877760)
- Type-check, Build & Test: PASS
  - [run/job](https://github.com/holgarkotze-commits/breedlog/actions/runs/29526730553/job/87716890417)
- Windows desktop shell build: PASS
  - [run/job](https://github.com/holgarkotze-commits/breedlog/actions/runs/29526730555/job/87716890629)

## Final defect closure in this pass

- `fff6148` fixed the remaining route-level reactivation failure by returning the contractual `403 ACTIVE_ANIMAL_LIMIT_REACHED` response instead of crashing `PUT /api/animals/:id`.
- `fff6148` extended deterministic regression coverage for the Free-plan `aiActions` ledger and inactive-to-active reactivation over the 30-animal cap.
- The prior correction head `ff7e4da` remains the fixing head for the Premium device-limit scope, cancellation downgrade, backup evaluations, AI quota reservation wiring, deletion-route suspension, recovery-status bypass, field-issue purge ordering, hidden EID leakage, Windows localhost build contract, and Android signing contract.
- All 23 valid PR review threads were replied to with root cause, fixing commit, regression coverage, and verification summary, then resolved on GitHub.

## Windows physical acceptance

- Rebuilt candidate artifacts:
  - `src-tauri/target/release/breedlog-desktop.exe`
  - `src-tauri/target/release/bundle/nsis/BreedLog_1.0.2_x64-setup.exe`
  - `src-tauri/target/release/bundle/msi/BreedLog_1.0.2_x64_en-US.msi`
- Silent NSIS install on the refreshed build: PASS (`EXIT_CODE=0`)
- Installed paths present:
  - `C:\Users\User\AppData\Local\BreedLog\breedlog-desktop.exe`
  - `C:\Users\User\AppData\Local\BreedLog\uninstall.exe`
- Registry uninstall entry present:
  - `DisplayName: BreedLog`
  - `DisplayVersion: 1.0.2`
  - `InstallLocation: C:\Users\User\AppData\Local\BreedLog`
- Installed-app launch proof on refreshed build: PASS
  - observed running process after launch: `PID 7076`
- Release-origin proof:
  - no `http://127.0.0.1:5000` match in rebuilt release bundle or installed executable
  - rebuilt production web assets resolve against `https://app.breedlog.com`

## Android evidence

- Current CI artifact downloaded into the release pack:
  - `release-artifacts/ci-artifacts/android/app-debug.apk`
- Artifact provenance:
  - Actions artifact `breedlog-android-debug-apk`
  - workflow run `29526730583`
  - head SHA `fff61484dea330ba5921780d92af7c49bbe1d147`
  - GitHub-reported digest `sha256:2a82b1970a4c74060e1fd6bad17cd097aed1ac40bab81c8e5f3fb3ce5c590478`
- Local physical Android install remains blocked on this Windows seat because no Android SDK/device environment is configured locally.
- Release signing remains honestly blocked pending the real signing-secret set.

## Current artifact hashes

- `src-tauri/target/release/breedlog-desktop.exe`
  - size: `12731904`
  - SHA-256: `E436B7DCFF4AD438D2E55049885C037C114C899539AB94C1E9B63109BD8CD147`
- `src-tauri/target/release/bundle/nsis/BreedLog_1.0.2_x64-setup.exe`
  - size: `6035759`
  - SHA-256: `259D7C0D88B27A051638E4318925D4F555170D3BAC9A79C8BDFB682DADF704C7`
- `src-tauri/target/release/bundle/msi/BreedLog_1.0.2_x64_en-US.msi`
  - size: `6983680`
  - SHA-256: `CCF45BFE62749FE2FBE5939993FDC41D3C6F465139C2ECBED2B634ACB9B2D1BB`
- `release-artifacts/ci-artifacts/android/app-debug.apk`
  - size: `8670684`
  - SHA-256: `010ADA1BC63A2349B281F3670D29F5797A025904CCE1A08B519D3220F6419D94`

## Remaining external blockers

- Live payment-provider merchant activation and credentials
- Google Play publisher ownership and release-signing secrets
- Windows Authenticode certificate and updater-signing keys
- Production DNS/TLS/hosting/database/storage credentials for `breedlog.com` and `app.breedlog.com`
- Professional legal review/approval of the policy and commercial documents

## Independent final senior-architect review pass (2026-07-21)

Performed on branch `breedlog-production-completion` continuing head `e1a4ce8`,
in a clean Linux cloud environment from a fresh clone and `npm ci`.

### Independent revalidation of all prior P1/P2 findings

Every defect listed in the PR #44 body and every review-thread fix claim was
re-verified against the actual code (not the thread replies). All 14 PR-body
defects and all 23 review-thread fixes are present on the head. Verified
production paths include: device-limit entitlement scope
(`server/managed-auth.ts`), cancellation downgrade (`server/commercial.ts`),
full backup collection coverage incl. evaluations (`server/backup.ts`),
AI quota reservation (`server/ai/breedlog-ai-routes.ts`), deletion-suspension
ordering and bypass list (`server/routes.ts`), raw-body webhook verification,
billing test-route gating, reactivation/CSV caps, hidden-EID scan events,
revoked-device rejection (`server/device-auth.ts`), transactional managed
account purge incl. `field_issues` (`server/storage.ts`), Windows API-origin
build contract and Android signing contract (workflows + `android/app/build.gradle`).

### New defects found and fixed in this pass

- P1 `2499dc2` — the `test:cert` glob `tests/**/*.test.ts` collapses to a
  single path segment under POSIX `sh`, so CI (and any Linux/Replit run of
  `npm run test:cert`) executed only `tests/isolation/phase1-data-isolation.test.ts`
  — 4 of 572 tests. All earlier "CI: certification tests PASS" results on this
  branch proved only those 4 tests. (Windows-local runs expanded the glob via
  Node and did run the full suite, so local totals reported earlier were real.)
  Fixed with explicit globs plus a CI executed-test-count floor (>= 500).
- P2 `cfb8b51` — the API request logger wrote full response bodies (365-day
  device tokens, recovery tokens, encrypted backup payloads) into production
  logs. Now redacted and truncated; regression `tests/api-log-redaction.test.ts`.
- P3 `e3f82b7` — `BILLING_TEST_ROUTES=1` could enable the entitlement-minting
  test billing routes in production; now structurally impossible.
  `/api/device/status` no longer discloses `NODE_ENV`/`PGHOST` unauthenticated.
- P3 `e348ed9` — downgrade-visibility now also enforced on evaluations,
  genetics animal-bloodline, and mating-risk routes; expired-deletion sweep no
  longer re-reports cancelled/completed requests as failed; dead code removed.
- Cleanup `fc8bfea` — removed 331 unreferenced tracked files
  (~71 MB `attached_assets/` Replit paste bucket, Playwright `test-results/`,
  empty `cookies.txt`, `.canvas/`), tracked files 800 → 470.

### Verification on this pass (Linux, clean clone)

- `npm ci`: PASS
- `npm run check`: PASS
- `npm run test:cert` (now the full tree): PASS — 582 tests, 578 pass, 0 fail,
  4 skipped (DB-gated seed tests; they run in CI where DATABASE_URL exists)
- `npm run build`: PASS
- `npx cap sync android`: PASS
- `cargo check --manifest-path src-tauri/Cargo.toml`: PASS
- `git diff --check`: PASS
- Runtime smoke test against an isolated in-memory server: 31/31 PASS —
  empty normal workspaces, animal CRUD/archive/reactivate, breeding/health/
  performance/evaluation records, pedigree resolution, encrypted backup →
  reset → restore round-trip with matching collection counts, cross-user
  direct-ID isolation, backup owner-binding rejection, U2A2ZAVQ activation
  with the Kwantam demonstration herd (541 animals) and zero leakage into
  normal workspaces, deletion suspension (423) and recovery cancellation,
  unauthenticated AI rejection.
- `npm run windows:build`: not runnable in this Linux environment (NSIS/MSI
  require Windows). Proof source: the Windows Build workflow on the final head.
- Android Gradle build: proof source: the Android Build workflow on the final head.
- Prior physical Windows install/launch acceptance (above) was performed on
  `fff6148` artifacts; no client, Tauri, or Android source changed in this
  pass, so that evidence is inherited, not re-executed.
