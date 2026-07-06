import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexedDbSource = fs.readFileSync('client/src/lib/indexeddb.ts', 'utf8');
const syncManagerSource = fs.readFileSync('client/src/lib/sync-manager.ts', 'utf8');
const animalsHookSource = fs.readFileSync('client/src/hooks/use-animals.ts', 'utf8');
const routesSource = fs.readFileSync('server/routes.ts', 'utf8');
const browserCertRunnerSource = fs.readFileSync('scripts/run-browser-cert.sh', 'utf8');
const settingsSource = fs.readFileSync('client/src/pages/Settings.tsx', 'utf8');
const networkStatusSource = fs.readFileSync('client/src/hooks/use-network-status.ts', 'utf8');
const animalCardSource = fs.readFileSync('client/src/components/AnimalCard.tsx', 'utf8');
const syncUtilsSource = fs.readFileSync('client/src/lib/sync-utils.ts', 'utf8');
const schemaSource = fs.readFileSync('shared/schema.ts', 'utf8');
const animalsPageSource = fs.readFileSync('client/src/pages/Animals.tsx', 'utf8');
const animalDetailSource = fs.readFileSync('client/src/pages/AnimalDetail.tsx', 'utf8');
const lambsPageSource = fs.readFileSync('client/src/pages/Lambs.tsx', 'utf8');

// These are release-certification guard tests.
// They verify critical sync/offline architecture invariants directly from source.

test('sync queue persistence uses numeric synced state and migration exists', () => {
  assert.match(indexedDbSource, /const DB_VERSION =\s*4/);
  assert.match(indexedDbSource, /synced:\s*number/);
  assert.match(indexedDbSource, /runMigrations\(\)/);
  assert.match(indexedDbSource, /item\.synced === 0 \|\| item\.synced === false/);
});

test('sync manager performs push + pull and reconnect checks', () => {
  assert.match(syncManagerSource, /window\.addEventListener\('online'/);
  assert.match(syncManagerSource, /await this\.pushChanges\(\)/);
  assert.match(syncManagerSource, /await this\.pullData\(\)/);
  assert.match(syncManagerSource, /await removeSyncedItems\(\)/);
  assert.match(syncManagerSource, /performFullSyncAction\(\)/);
  assert.match(syncManagerSource, /backendReachable/);
});

test('animals workflow supports offline-first create with queued sync', () => {
  assert.match(animalsHookSource, /await putInStore\("animals", offlineAnimal\)/);
  assert.match(animalsHookSource, /await addToSyncQueue\(\{\s*action:\s*"create",\s*entity:\s*"animals"/s);
  assert.match(animalsHookSource, /idempotencyKey:\s*operationId/);
  assert.match(animalsHookSource, /clientOperationId:\s*operationId/);
  assert.match(animalsHookSource, /syncManager\.sync\(\)/);
});

test('animals workflow supports offline-safe delete queueing and sync status states', () => {
  assert.match(animalsHookSource, /action:\s*"delete"/);
  assert.match(animalsHookSource, /await addToSyncQueue\(\{/);
  assert.match(syncManagerSource, /syncStatus:\s*'syncing'/);
  assert.match(syncManagerSource, /syncStatus:\s*'failed'/);
  assert.match(syncManagerSource, /'conflict'/);
});

test('server exposes core CRUD routes used by sync endpoints', () => {
  assert.match(routesSource, /app\.post\(api\.animals\.create\.path/);
  assert.match(routesSource, /app\.put\(api\.animals\.update\.path/);
  assert.match(routesSource, /app\.delete\(api\.animals\.delete\.path/);
  assert.match(routesSource, /app\.post\(api\.breeding\.create\.path/);
  assert.match(routesSource, /app\.post\(api\.records\.health\.create\.path/);
  assert.match(routesSource, /app\.post\(api\.records\.performance\.create\.path/);
});

test('browser certification automation is wired for release gate evidence', () => {
  assert.ok(fs.existsSync('tests/browser-cert/playwright.config.ts'));
  assert.ok(fs.existsSync('tests/browser-cert/specs/offline-sync.spec.ts'));
  assert.match(browserCertRunnerSource, /npx playwright test --config tests\/browser-cert\/playwright\.config\.ts/);
  assert.match(browserCertRunnerSource, /\"passed\": true/);
});

// ── Task #1: Purge Failed Syncs ────────────────────────────────────────────
test('purge-failed-syncs: sync manager exposes purgeFailedSyncs with default 3-retry threshold', () => {
  assert.match(syncManagerSource, /async purgeFailedSyncs\(/);
  assert.match(syncManagerSource, /maxFailures.*=.*3/);
});

test('purge-failed-syncs: network-status hook re-exports purgeFailedSyncs to components', () => {
  assert.match(networkStatusSource, /purgeFailedSyncs/);
});

test('purge-failed-syncs: Settings page has button wired with testid and purge handler', () => {
  assert.match(settingsSource, /handlePurgeFailedSyncs/);
  assert.match(settingsSource, /data-testid="button-purge-failed-syncs"/);
  assert.match(settingsSource, /purgeFailedSyncs\(\)/);
});

// ── Task #2: Hide phantom animals (temp IDs not in sync queue) ─────────────
test('phantom-animals: indexeddb exposes tempIdInSyncQueue and animalExistsInCache guards', () => {
  assert.match(indexedDbSource, /export async function tempIdInSyncQueue/);
  assert.match(indexedDbSource, /export async function animalExistsInCache/);
});

test('phantom-animals: AnimalCard imports and uses phantom guards before rendering', () => {
  assert.match(animalCardSource, /tempIdInSyncQueue/);
  assert.match(animalCardSource, /animalExistsInCache/);
  assert.match(animalCardSource, /phantom/i);
});

// ── Task #3: Background refresh after save to confirm cloud sync status ─────
test('background-refresh: create-animal mutation schedules delayed invalidation after optimistic save', () => {
  assert.match(animalsHookSource, /background.*refresh/i);
  assert.match(animalsHookSource, /setTimeout/);
  assert.match(animalsHookSource, /invalidateQueries/);
});

// ── Task #21: Offline breeding events merged into useBreedingEvents ─────────
const breedingHookSource = fs.readFileSync('client/src/hooks/use-breeding.ts', 'utf8');

test('offline-breeding-events: useBreedingEvents merges pending syncQueue creates before returning', () => {
  assert.match(breedingHookSource, /getPendingSyncItems/);
  assert.match(breedingHookSource, /entity.*breedingEvents.*action.*create|filter.*breedingEvents/s);
  assert.match(breedingHookSource, /\[\.\.\.(data|server|patchedBreedingData|visibleData),\s*\.\.\.(pending|visiblePending)/);
});

// ── Task #20: Offline mating-group updates patched into useMatingGroups ──────
test('offline-mating-update: useMatingGroups applies pending syncQueue updates on top of server data', () => {
  assert.match(breedingHookSource, /action.*===.*'update'|action.*update.*matingGroups/);
  assert.match(breedingHookSource, /patch\.id\s*!=\s*null|patch\.id != null/);
  assert.match(breedingHookSource, /pendingUpdates\[g\.id\]/);
});

test('offline-mating-update: update patch is spread on top of existing group (latest-write-wins)', () => {
  assert.match(breedingHookSource, /\{\s*\.\.\.g,\s*\.\.\.pendingUpdates/);
});

// ── Task #24: Offline-deleted mating groups suppressed from useMatingGroups ──
test('offline-mating-delete: useMatingGroups builds deletedIds set from pending delete entries', () => {
  assert.match(breedingHookSource, /action.*===.*'delete'.*matingGroups|entity.*matingGroups.*action.*delete/s);
  assert.match(breedingHookSource, /deletedIds/);
  assert.match(breedingHookSource, /new Set\(/);
});

test('offline-mating-delete: server groups and pending creates with a deleted id are both filtered out', () => {
  assert.match(breedingHookSource, /visibleData/);
  assert.match(breedingHookSource, /visiblePending/);
  assert.match(breedingHookSource, /deletedIds\.has\(g\.id\)/);
});

// ── Task #27: Offline health-record updates patched into useHealthRecords ─────
const healthRecordsHookSource = fs.readFileSync('client/src/hooks/use-records.ts', 'utf8');

test('offline-health-update: useHealthRecords imports getPendingSyncItems', () => {
  assert.match(healthRecordsHookSource, /getPendingSyncItems/);
});

test('offline-health-update: useHealthRecords builds patch map from pending healthRecords updates', () => {
  assert.match(healthRecordsHookSource, /entity.*healthRecords.*action.*update|filter.*healthRecords/s);
  assert.match(healthRecordsHookSource, /patch\.id\s*!=\s*null|patch\.id != null/);
});

test('offline-health-update: patch is spread on top of server record (latest-write-wins)', () => {
  assert.match(healthRecordsHookSource, /\{\s*\.\.\.r,\s*\.\.\.pendingUpdates/);
});

// ── Task #26: Offline-deleted flock health events suppressed ─────────────────
const flockHealthSource = fs.readFileSync('client/src/hooks/use-flock-health.ts', 'utf8');

test('offline-health-delete: useFlockHealthEvents builds deletedIds Set from pending delete entries', () => {
  assert.match(flockHealthSource, /entity.*flockHealthEvents.*action.*delete|filter.*flockHealthEvents.*delete/s);
  assert.match(flockHealthSource, /deletedIds/);
  assert.match(flockHealthSource, /new Set\(/);
});

test('offline-health-delete: both server events and pending creates with a deleted id are excluded', () => {
  assert.match(flockHealthSource, /visibleServer/);
  assert.match(flockHealthSource, /visiblePending/);
  assert.match(flockHealthSource, /deletedIds\.has\(e\.id\)/);
});

// ── Task #28: Deterministic timestamp ordering for all update patch-maps ──────
test('deterministic-updates: breedingEvents update patch-map sorts by timestamp (via buildPatchMap helper)', () => {
  // Task #34 extracted the inline filter→sort→reduce into buildPatchMap() in sync-utils.ts
  assert.match(breedingHookSource, /buildPatchMap/);
  assert.match(syncUtilsSource, /\.sort\(\(a, b\) => a\.timestamp - b\.timestamp\)/);
});

test('deterministic-updates: matingGroups update patch-map sorts by timestamp before reducing', () => {
  assert.match(breedingHookSource, /\.filter\(item => item\.entity === 'matingGroups' && item\.action === 'update'\)\s*\n\s*\.sort\(\(a, b\) => a\.timestamp - b\.timestamp\)/);
});

test('deterministic-updates: healthRecords update patch-map sorts by timestamp before reducing', () => {
  assert.match(healthRecordsHookSource, /\.filter\(item => item\.entity === 'healthRecords' && item\.action === 'update'\)\s*\n\s*\.sort\(\(a, b\) => a\.timestamp - b\.timestamp\)/);
});

// ── Ram Breeding Status (separate from classification/ramType) ──────────────
test('ram-breeding-status: schema has ramBreedingStatus column separate from ramType and classification', () => {
  assert.match(schemaSource, /ram_breeding_status/);
  assert.match(schemaSource, /ram_type/);
  assert.match(schemaSource, /classification/);
});

test('ram-breeding-status: schema accepts breeding_ram, marketable_ram, not_selected, unknown values', () => {
  assert.match(schemaSource, /breeding_ram.*marketable_ram.*not_selected.*unknown|ramBreedingStatus.*text/s);
});

test('ram-breeding-status: add animal form shows breeding status field with all four options', () => {
  assert.match(animalsPageSource, /select-ram-breeding-status/);
  assert.match(animalsPageSource, /marketable_ram/);
  assert.match(animalsPageSource, /not_selected/);
  assert.match(animalsPageSource, /watchedSex.*===.*'ram'/);
});

test('ram-breeding-status: edit animal form shows breeding status field for rams', () => {
  assert.match(animalDetailSource, /select-edit-ram-breeding-status/);
  assert.match(animalDetailSource, /ramBreedingStatus/);
  assert.match(animalDetailSource, /formData\.sex.*===.*'ram'/);
});

test('ram-breeding-status: promote-to-rams dialog includes breeding status select (separate from ram type)', () => {
  assert.match(animalsPageSource, /select-promote-ram-breeding-status/);
  assert.match(lambsPageSource, /select-ram-breeding-status/);
});

test('ram-breeding-status: promote mutation passes ramBreedingStatus to move-to-rams endpoint', () => {
  assert.match(animalsHookSource, /ramBreedingStatus/);
  assert.match(animalsHookSource, /JSON\.stringify\(\{.*ramType.*ramBreedingStatus|JSON\.stringify\(\{.*ramBreedingStatus/s);
});

test('ram-breeding-status: server move-to-rams validates ramBreedingStatus values', () => {
  assert.match(routesSource, /validBreedingStatuses/);
  assert.match(routesSource, /marketable_ram/);
  assert.match(routesSource, /not_selected/);
});

test('ram-breeding-status: classification field still present alongside ramBreedingStatus (not replaced)', () => {
  assert.match(animalsPageSource, /select-classification/);
  assert.match(animalDetailSource, /select-edit-classification/);
});

// ── Task #23: Offline breeding-event updates patched into useBreedingEvents ──
test('offline-breeding-update: useBreedingEvents applies pending syncQueue updates on top of server data', () => {
  assert.match(breedingHookSource, /entity.*'breedingEvents'.*action.*'update'/s);
  assert.match(breedingHookSource, /patch\.id != null/);
  assert.match(breedingHookSource, /pendingBreedingUpdates\[evt\.id\]/);
});

test('offline-breeding-update: update patch is spread on top of existing event (latest-write-wins)', () => {
  assert.match(breedingHookSource, /\{\s*\.\.\.evt,\s*\.\.\.pendingBreedingUpdates/);
});

// ── Task #25: Offline-deleted breeding events suppressed from useBreedingEvents
test('offline-breeding-delete: useBreedingEvents builds deletedIds set from pending delete entries', () => {
  assert.match(breedingHookSource, /entity.*'breedingEvents'.*action.*'delete'|action.*===.*'delete'.*breedingEvents/s);
  assert.match(breedingHookSource, /deletedIds/);
  assert.match(breedingHookSource, /new Set\(/);
});

test('offline-breeding-delete: server events and pending creates with a deleted id are both filtered out', () => {
  assert.match(breedingHookSource, /visibleData/);
  assert.match(breedingHookSource, /visiblePending/);
  assert.match(breedingHookSource, /deletedIds\.has\(evt\.id\)/);
});
