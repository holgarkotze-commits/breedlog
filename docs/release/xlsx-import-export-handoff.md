# XLSX Import/Export Handoff (Phase 10)

## Blocker summary
Real XLSX support is blocked in this environment by package policy.

- **Package attempted:** `xlsx`
- **Command attempted:** `npm install xlsx --save-exact`
- **Observed error:** `npm ERR! code E403` and `403 Forbidden - GET https://registry.npmjs.org/xlsx`

Because the dependency cannot be installed, XLSX import/export is not marked complete in this build.

## Current approved spreadsheet path
- **CSV is the active and supported spreadsheet format** for export/import.
- Settings UI keeps XLSX explicitly marked as blocked.
- CSV remains the official user path until XLSX is green.

## Files to update once dependency is available
- `client/src/pages/Settings.tsx` (replace blocked XLSX action with true workbook export/import flow)
- `shared/import-export.ts` (add workbook conversion helpers)
- `server/routes.ts` (accept/parse XLSX payload path in addition to CSV)
- `tests/import-export-hardening.test.ts` (enable real XLSX roundtrip + duplicate checks)

## Acceptance tests required after dependency becomes available
1. Real `.xlsx` workbook export is generated (not XML/CSV masquerading).
2. XLSX import parses workbook rows into BreedLog import parser.
3. XLSX roundtrip (export -> import) preserves key livestock fields.
4. Duplicate prevention blocks canonical tag and EID duplicates on XLSX re-import.
5. Required Phase 10 command suite passes with XLSX assertions enabled.
