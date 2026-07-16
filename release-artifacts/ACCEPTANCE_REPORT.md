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
