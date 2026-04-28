# Offline + Sync Browser Certification Runbook

## Purpose
This runbook defines the **required browser-level release certification** for BreedLog offline and reconnect sync behavior.

> Release cannot be declared complete until all scenarios in this document pass in a browser-capable environment.

## Required environment
- Node 20+
- Browser automation framework: Playwright (or equivalent)
- Browser binary available (Chromium recommended)
- Network access to package registry (if Playwright not preinstalled)
- App started with deterministic test auth bypass:
  - `NODE_ENV=test`
  - `USE_IN_MEMORY_STORAGE=1` (or test database)
  - `SESSION_SECRET`
  - `ADMIN_PIN`

## Preflight setup
1. Install browser tooling (if available in environment):
   - `npm i -D @playwright/test`
   - `npx playwright install chromium`
2. Start app:
   - `NODE_ENV=test USE_IN_MEMORY_STORAGE=1 SESSION_SECRET=test-secret ADMIN_PIN=1234 npm run dev`
3. Ensure reset endpoint works for deterministic setup:
   - `POST /api/reset-all-data` with `{ "confirmPhrase": "RESET BREEDLOG" }`
4. Run the browser certification suite:
   - `npm run test:browser-cert`
   - This writes pass/fail evidence to `artifacts/browser-certification/RESULT.json` for release-gate consumption.

## Scenario suite (must pass)

### 1) Offline create + immediate UI presence
- Start online
- Create baseline animal
- Toggle browser offline
- Create animal while offline
- Assert UI row appears immediately
- Assert IndexedDB `animals` contains offline record
- Assert IndexedDB `syncQueue` contains queued create item

### 2) Offline reload persistence
- Stay offline
- Reload page
- Assert no crash
- Assert offline animal still visible
- Assert queued sync item still present

### 3) Reconnect + sync drain
- Re-enable network
- Wait for sync state transition to `synced`
- Assert sync queue drained
- Assert no duplicate records in UI or server list
- Assert temp ID resolved to positive server ID

### 4) Multi-record offline workflow
- Go offline
- Create 3 animals
- Edit one animal offline
- Reload while offline
- Reconnect
- Assert all 3 records persisted
- Assert edited fields persisted
- Assert no duplicate IDs/records

### 5) Final local/server consistency
- Fetch server dataset (`/api/animals`)
- Read local IndexedDB `animals`
- Compare final canonical fields (`id`, `tagId`, `electronicId`, `name`, `status`)
- Assert no ghost-only local records remain after successful sync

## Evidence artifacts required
- Browser trace/video (if enabled)
- Console logs with sync transitions
- JSON snapshot of server animals list (post-sync)
- JSON snapshot of IndexedDB `animals` and `syncQueue` (post-sync)
- Test report summary

## Pass/Fail criteria
- **Pass**: all scenarios above pass with evidence artifacts.
- **Fail**: any scenario fails, crashes, produces duplicates, leaves stale temp records, or mismatches local/server state.
