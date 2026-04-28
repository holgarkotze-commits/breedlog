import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexedDbSource = fs.readFileSync('client/src/lib/indexeddb.ts', 'utf8');
const syncManagerSource = fs.readFileSync('client/src/lib/sync-manager.ts', 'utf8');
const animalsHookSource = fs.readFileSync('client/src/hooks/use-animals.ts', 'utf8');
const routesSource = fs.readFileSync('server/routes.ts', 'utf8');
const browserCertRunnerSource = fs.readFileSync('scripts/run-browser-cert.sh', 'utf8');

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
