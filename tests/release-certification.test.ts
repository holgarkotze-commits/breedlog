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
  assert.match(breedingHookSource, /\[\.\.\.(data|server|patchedBreedingData),\s*\.\.\.pending/);
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

// ── Task #23: Offline breeding-event updates patched into useBreedingEvents ──
test('offline-breeding-update: useBreedingEvents applies pending syncQueue updates on top of server data', () => {
  assert.match(breedingHookSource, /entity.*'breedingEvents'.*action.*'update'/s);
  assert.match(breedingHookSource, /patch\.id != null/);
  assert.match(breedingHookSource, /pendingBreedingUpdates\[evt\.id\]/);
});

test('offline-breeding-update: update patch is spread on top of existing event (latest-write-wins)', () => {
  assert.match(breedingHookSource, /\{\s*\.\.\.evt,\s*\.\.\.pendingBreedingUpdates/);
});
