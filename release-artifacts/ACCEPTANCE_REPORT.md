# BreedLog Production Completion Acceptance Report

- Source branch: `breedlog-production-completion`
- Artifact source commit: `868117297ac63799da58f28a04c99ce2e511d778`
- Evidence refresh date: `2026-07-15`
- Pricing version: `2026-07-locked-commercial-model`
- Verification clone: `C:\Users\User\Documents\GitHub\breedlog-verify-pr44-final`

## Verified engineering scope

- Managed account authentication, deterministic verification and recovery, device registration, and device-limit enforcement.
- Server-authoritative Free and Premium entitlements, downgrade projection, restoration, usage quotas, add-ons, and billing reconciliation scaffolding.
- Encrypted `.breedlogbackup` export, preview, restore, wrong-account rejection, corruption rejection, weekly scheduler, and retention worker behavior.
- Account deletion recovery workflow, suspension, purge worker, retry path, and audit-safe lifecycle handling.
- PWA and native-wrapper runtime update handling, trusted native backend-origin bridging, and release-gate CORS coverage.
- Windows and Android shell build pipelines, release evidence pack surfaces, and legal / operations documentation required for production review.
- Individual animal export now generates a real A4 PDF blob and uses the native Windows save bridge before browser fallback.

## Local verification

- `npm.cmd ci`: PASS in `C:\Users\User\Documents\GitHub\breedlog-verify-pr44-final`
- `npm.cmd run check`: PASS
- `npm.cmd run build`: PASS
- `npm.cmd run test:cert`: PASS
  - totals: `551` tests, `547` passed, `0` failed, `4` skipped
- `npm.cmd run android:sync`: PASS
- `cargo check --manifest-path src-tauri\Cargo.toml`: PASS
- `npm.cmd run windows:build`: PASS
  - certification build used `VITE_BREEDLOG_API_ORIGIN=http://127.0.0.1:5000`
- `git diff --check`: PASS with CRLF warnings only, no whitespace failures

## GitHub Actions

- `CI` PASS: [run 29397572720](https://github.com/holgarkotze-commits/breedlog/actions/runs/29397572720)
- `CI` PASS: [run 29397575540](https://github.com/holgarkotze-commits/breedlog/actions/runs/29397575540)
- `Android wrapper build` PASS: [run 29397575526](https://github.com/holgarkotze-commits/breedlog/actions/runs/29397575526)
- `Windows desktop shell build` PASS: [run 29397575558](https://github.com/holgarkotze-commits/breedlog/actions/runs/29397575558)

## Physical proof

### Windows

- Installed-shell ordinary workspace activation, animal creation, restart persistence, backup, reset, restore, PDF export, and uninstall were physically completed on Windows.
- Ordinary workspace proof used non-`U2A2ZAVQ` activation and remained isolated from the Kwantam simulation workspace.
- Animal save and persistence evidence:
  - `release-artifacts\windows-proof\pr44-post-activation-dashboard.png`
  - `release-artifacts\windows-proof\pr44-completed-add-animal-form-1.png`
  - `release-artifacts\windows-proof\pr44-after-first-animal-save.png`
  - `release-artifacts\windows-proof\pr44-animal-profile-first.png`
  - `release-artifacts\windows-proof\pr44-post-restart-persistence-success.png`
  - backend request log: `release-artifacts\windows-proof\local-proof-server.out.log`
- Backup / reset / restore evidence:
  - backup artifact: `release-artifacts\windows-proof\breedlog-094c5558-2026-07-15.breedlogbackup`
  - `release-artifacts\windows-proof\pr44-pre-reset-two-animals.png`
  - `release-artifacts\windows-proof\pr44-reset-confirmation-dialog.png`
  - `release-artifacts\windows-proof\pr44-post-reset-empty-state.png`
  - `release-artifacts\windows-proof\pr44-restore-preview.png`
  - `release-artifacts\windows-proof\pr44-restored-herd.png`
  - `release-artifacts\windows-proof\pr44-post-restart-restored-persistence.png`
- PDF export evidence:
  - saved toast: `release-artifacts\windows-proof\pr44-pdf-export-saved-toast-final.png`
  - exported PDF: `release-artifacts\windows-proof\pr44-individual-animal-export.pdf`
  - rendered proof pages:
    - `release-artifacts\windows-proof\pr44-individual-animal-export-page-1.png`
    - `release-artifacts\windows-proof\pr44-individual-animal-export-page-2.png`
  - footer/page-number crops:
    - `release-artifacts\windows-proof\pr44-individual-animal-export-page-1-footer-crop.png`
    - `release-artifacts\windows-proof\pr44-individual-animal-export-page-2-footer-crop.png`
  - result: real A4 portrait PDF, no visible overflow, footer line and page numbers visible, no user-facing JSON export.
- Uninstall evidence:
  - log: `release-artifacts\windows-proof\pr44-uninstall-check.txt`
  - native install directory and uninstall executable are removed
  - native BreedLog Start Menu shortcut is removed
  - user data directory is retained at `C:\Users\User\AppData\Local\com.stitchworx.breedlog`
  - an existing Chrome Apps shortcut remains because it belongs to the browser/PWA install path, not the native Tauri shell
- This pass does not claim signed Windows installers or signed updater activation.

### Android

- GitHub Android wrapper build passes and the unsigned debug APK is present at `release-artifacts\ci-artifacts\android\app-debug.apk`.
- Physical Android installation proof blocked because no Android device or emulator is available.

## Review guardrails

- No fake production payment evidence is claimed.
- No live merchant activation is claimed.
- No signed release or signed updater evidence is claimed.
- No private farm data is included in the release pack.
- No U2A2ZAVQ simulation data is attached to ordinary workspaces in certification.
- No user-facing JSON export is exposed in the product surface.
