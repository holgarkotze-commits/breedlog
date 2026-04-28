# Phase 15 Web/PWA Field-Test Validation

Date: 2026-04-28

## Outcome
BreedLog Web/PWA is prepared for a controlled field-test release with build identity, tester instructions, and release documentation.

## Version identity
- Field-test label: `BreedLog Web/PWA Field Test RC1`
- Visible in Settings under Field-Test Release Info.

## Field-test documentation delivered
- `docs/release/field-test-release-notes.md`
- `docs/release/field-test-checklist.md`
- `docs/release/next-upgrade-android-aab-package.md`

## Tester reporting path
- Settings includes a report instruction and working mailto link.
- Template includes device/browser/screen/steps/expected-vs-actual + artifact capture fields.

## PWA refresh/update safety note
- Release notes and Settings now instruct testers to open online and refresh/reload if stale cache is observed.

## Phase 14 performance safeguards retained
- Animals list remains windowed with load-more.
- Animals export dialog remains lazy-loaded.
- Health Plan guide remains lazy-loaded.
- Simulation dataset remains outside normal runtime page imports.
- JSON not exposed as normal export path.
- XLSX remains explicitly blocked.

## Remaining blockers (honest)
1. Browser certification still externally blocked where Playwright dependency is unavailable.
2. Android APK/AAB still blocked until wrapper/build system is implemented.
3. XLSX dependency access remains blocked.
