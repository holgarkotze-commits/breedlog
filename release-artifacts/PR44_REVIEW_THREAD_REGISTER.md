# PR #44 Review Thread Register

All previously unresolved actionable PR #44 review threads are now resolved on GitHub.

| Severity | Thread ID | Root Comment ID | File | Status | Fixing commit(s) | Regression proof |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | `PRRT_kwDOR9e-ls6RBRgx` | `3585525574` | `server/backup.ts` | `resolved`, `outdated` | `be6ff65`, `ff7e4da` | `tests/backup-restore-production.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RBRg0` | `3585525578` | `server/routes.ts` | `resolved`, `outdated` | `be6ff65` | `tests/review-route-fixes.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RBRg4` | `3585525582` | `server/device-auth.ts` | `resolved`, `current` | `fff6148` revalidation | `tests/review-route-fixes.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RBRg8` | `3585525585` | `client/src/lib/runtime-updates.ts` | `resolved`, `outdated` | `be6ff65` | `tests/update-runtime-production.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RBRhA` | `3585525594` | `server/routes.ts` | `resolved`, `outdated` | `be6ff65` | `tests/billing-test-route-gating.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RBRhC` | `3585525597` | `server/account-deletion.ts` | `resolved`, `outdated` | `be6ff65`, `ff7e4da` | `tests/account-deletion-production.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RBRhE` | `3585525600` | `client/src/pages/AnimalDetail.tsx` | `resolved`, `outdated` | `be6ff65` | `tests/review-route-fixes.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RBRhG` | `3585525603` | `server/routes.ts` | `resolved`, `current` | `fff6148` revalidation | `tests/review-route-fixes.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RBRhJ` | `3585525607` | `server/managed-auth.ts` | `resolved`, `outdated` | `be6ff65` | `tests/managed-auth-production.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RBRhO` | `3585525613` | `server/routes.ts` | `resolved`, `current` | `fff6148` revalidation | `tests/managed-auth-production.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RBRhS` | `3585525620` | `client/src/hooks/use-animals.ts` | `resolved`, `outdated` | `be6ff65` | `tests/review-client-cache-regressions.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RBRhX` | `3585525626` | `client/src/hooks/use-animals.ts` | `resolved`, `outdated` | `be6ff65` | `tests/review-client-cache-regressions.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RQ8uB` | `3591257048` | `server/managed-auth.ts` | `resolved`, `outdated` | `ff7e4da` | `tests/managed-auth-production.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RQ8uH` | `3591257057` | `server/commercial.ts` | `resolved`, `current` | `ff7e4da` | `tests/production-commercial.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RQ8uL` | `3591257062` | `server/backup.ts` | `resolved`, `current` | `ff7e4da` | `tests/backup-restore-production.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RQ8uO` | `3591257065` | `shared/commercial.ts` | `resolved`, `current` | `ff7e4da`, `fff6148` | `tests/production-commercial.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RQ8uT` | `3591257071` | `server/routes.ts` | `resolved`, `current` | `ff7e4da` | `tests/account-deletion-route-enforcement.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RQ8uZ` | `3591257078` | `server/routes.ts` | `resolved`, `current` | `ff7e4da` | `tests/account-deletion-route-enforcement.test.ts` |
| P1 | `PRRT_kwDOR9e-ls6RQ8ud` | `3591257084` | `.github/workflows/windows-build.yml` | `resolved`, `outdated` | `ff7e4da` | `tests/native-shell-build-contract.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RQ8ug` | `3591257088` | `server/routes.ts` | `resolved`, `current` | `fff6148` | `tests/review-route-fixes.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RQ8uk` | `3591257093` | `server/storage.ts` | `resolved`, `current` | `ff7e4da` | `tests/account-deletion-production.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RQ8up` | `3591257100` | `server/routes.ts` | `resolved`, `current` | `ff7e4da` | `tests/review-route-fixes.test.ts` |
| P2 | `PRRT_kwDOR9e-ls6RQ8us` | `3591257105` | `.github/workflows/android-build.yml` | `resolved`, `outdated` | `ff7e4da` | `tests/native-shell-build-contract.test.ts` |

Verification attached to the thread replies:

- local `npm ci`
- local `npm run check`
- local `npm run build`
- local `npm run test:cert` with `572` tests, `568` pass, `0` fail, `4` skipped
- local `npm run android:sync`
- local `cargo check --manifest-path src-tauri/Cargo.toml`
- local `npm run windows:build`
- local `git diff --check`
- GitHub Actions on `fff61484dea330ba5921780d92af7c49bbe1d147`:
  - Android wrapper build PASS
  - both Type-check, Build & Test jobs PASS
  - Windows desktop shell build PASS
