# BreedLog Web/PWA Field-Test Release Notes

## Build identity
- Version label: **BreedLog Web/PWA Field Test RC1**
- Build date: **2026-04-28**

## Purpose of this field-test build
This release candidate is for controlled real-user Web/PWA field testing to validate offline usage, syncing behavior, and day-to-day herd workflows before Android wrapper packaging.

## Major improvements completed
- Offline-first create/update/delete workflow hardening with queue merge/idempotency improvements.
- Duplicate protection for canonical tags, EIDs, and names.
- CSV import/export standardization and template-based import path.
- Health Plan in-app guidance and advanced Analysis UI.
- Mobile performance hardening on Animals page (windowed rendering + load more + export dialog lazy-loading).

## Offline/sync hardening status
- Implemented and covered by automated sync/runtime/release-cert tests.
- Browser-level certification remains externally blocked in this environment (missing Playwright dependency).

## Access-code/device hardening status
- One-phone + one-desktop access code path and slot enforcement tests pass.

## Tag-prefix logic status
- Canonical prefix parsing and sequence logic tests pass.

## Animal lifecycle edit status
- Lifecycle editing and weaning/estimated-value tests pass.

## Analysis upgrade status
- Advanced analysis engine and selector UI are implemented and tested.
- Analysis remains route-loaded and not preloaded into initial app shell.

## Simulation/test dataset status
- Simulation dataset is test-focused and not imported by normal runtime pages.

## Import/export status
- CSV is the active and validated exchange format.
- PDF export remains available.
- XLSX remains blocked and is clearly labeled as blocked.
- JSON is not exposed as normal user export.

## Health Plan status
- Health Plan guide content is available in app.
- Guide module remains lazy-loaded when Health Plan pane is opened.

## Mobile performance hardening status
- Animals page now renders an initial limited window and supports load more.
- Export dialog on Animals page is lazy-loaded.

## Known blockers
1. Browser certification is externally blocked where `@playwright/test`/browser binaries cannot be installed.
2. Android APK/AAB path is blocked until an Android wrapper/build system is added.
3. XLSX dependency remains blocked; CSV is current production path.

## What testers must focus on
- Offline add/edit flows and reconnect sync behavior.
- Duplicate prevention around tag/EID/name.
- Health event + Health Plan bridge actions.
- Analysis usability and data completeness messaging.
- Large herd browsing performance (Load More + search/filter).
- CSV export/import template roundtrip.

## What is not included yet
- Android APK/AAB packaging in this phase.
- Full Playwright browser certification pass in this environment.
- XLSX export/import support.

## PWA update note
If your PWA appears to run an older cached build, open the app while online and use reload/refresh once to pull the newest assets.
