import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePendingSyncItems, type SyncQueueItem } from '../client/src/lib/indexeddb';

function makeItem(partial: Partial<SyncQueueItem>): SyncQueueItem {
  return {
    id: partial.id ?? 'id-' + Math.random(),
    action: partial.action ?? 'update',
    entity: partial.entity ?? 'animals',
    data: partial.data ?? { id: 1 },
    tempId: partial.tempId,
    timestamp: partial.timestamp ?? Date.now(),
    synced: 0,
    failedAttempts: partial.failedAttempts,
  };
}

test('mergePendingSyncItems collapses duplicate updates for same record', () => {
  const existing = [
    makeItem({ id: 'u1', action: 'update', data: { id: 5, name: 'Old' }, timestamp: 100 }),
    makeItem({ id: 'u2', action: 'update', data: { id: 5, notes: 'Note' }, timestamp: 200 }),
  ];

  const result = mergePendingSyncItems(existing, {
    action: 'update',
    entity: 'animals',
    data: { id: 5, name: 'Newest' },
  });

  assert.equal(result.skipInsert, true);
  assert.ok(result.upsertExisting);
  assert.equal((result.upsertExisting!.data as any).name, 'Newest');
  assert.equal((result.upsertExisting!.data as any).notes, 'Note');
  assert.deepEqual(result.deleteIds, ['u1']);
});

test('mergePendingSyncItems deduplicates create for same tempId', () => {
  const existing = [
    makeItem({ id: 'c1', action: 'create', tempId: -123, data: { tagId: 'A-1' }, timestamp: 100 }),
  ];

  const result = mergePendingSyncItems(existing, {
    action: 'create',
    entity: 'animals',
    tempId: -123,
    data: { tagId: 'A-1' },
  });

  assert.equal(result.skipInsert, true);
  assert.deepEqual(result.deleteIds, []);
});

test('mergePendingSyncItems makes delete supersede updates/deletes for same target', () => {
  const existing = [
    makeItem({ id: 'u1', action: 'update', data: { id: 9, name: 'x' }, timestamp: 100 }),
    makeItem({ id: 'd1', action: 'delete', data: { id: 9 }, timestamp: 120 }),
    makeItem({ id: 'u2', action: 'update', data: { id: 10, name: 'y' }, timestamp: 130 }),
  ];

  const result = mergePendingSyncItems(existing, {
    action: 'delete',
    entity: 'animals',
    data: { id: 9 },
  });

  assert.equal(result.skipInsert, false);
  assert.deepEqual(result.deleteIds.sort(), ['d1', 'u1']);
});
