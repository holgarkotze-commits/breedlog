# Phase 16 Field-Test Blocker Fixes

## Reported issues
Route reload failures, blank mobile pages, unsynced data-loss risk, dark-button contrast concerns, and incomplete health-plan guidance/calendar.

## Root cause found
- SPA fallback did not explicitly exclude `/api/*` in both production and Vite middleware fallback chains.
- Lazy chunk/runtime failures could still render a blank experience without a route error boundary.
- Health-plan disclaimer and practical guidance/calendar depth were incomplete.

## Files changed
- `server/static.ts`
- `server/vite.ts`
- `client/src/App.tsx`
- `client/src/lib/health-plan-guide.ts`
- `tests/field-test-blocker-fixes.test.ts`

## Route reload fix
Added SPA catch-all GET fallback with explicit `/api/*` passthrough in production and dev middleware.

## Mobile blank-page fix
Added `RouteErrorBoundary` around lazy route `Suspense` tree with a readable reload action.

## Data safety fix
Existing unsynced guard logic in Settings was retained; Phase 16 tests validate guard surfaces and sync-status signals.

## Backup behaviour
CSV backup remains available in Settings and can be used before risky actions.

## Image backup status
CSV export includes record data and image references where present; full image-file backup remains future work.

## Button contrast audit
Shared primary button variant uses `text-primary-foreground`; critical actions validated by source checks.

## Health disclaimer correction
Disclaimer replaced with the required BreedLog in-app wording.

## Treatment/remedy option guidance
Added structured treatment/remedy/route option fields in health guide cards.

## Health calendar upgrade
Added monthly and seasonal calendar data exports.

## Tests run
See terminal run list in implementation output.

## Remaining risks
Needs browser-level manual confirmation in deployed environment for service-worker edge cases and direct URL reload behavior.

## Manual verification checklist
- Open `/records`, `/analysis`, `/settings`, `/health`, `/animals`, `/breeding` directly.
- Validate route error boundary message on forced chunk/network failure.
- Validate backup export and unsynced warnings in Settings.
