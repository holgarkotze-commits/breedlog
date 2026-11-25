const DB_NAME = 'breedlog-offline';
const DB_VERSION = 4; // Keep fixed for certification checks

// Storage availability state for incognito mode detection
let storageAvailable = true;
let storageWarningShown = false;

// Check if IndexedDB is available (fails in incognito/private mode)
export async function checkStorageAvailability(): Promise<boolean> {
  try {
    const testDbName = 'breedlog-storage-test';
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(testDbName, 1);
      request.onerror = () => reject(new Error('IndexedDB not available'));
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase(testDbName);
        resolve();
      };
    });
    storageAvailable = true;
    return true;
  } catch (error) {
    console.warn('[IndexedDB] Storage not available (likely incognito mode):', error);
    storageAvailable = false;
    return false;
  }
}

export function isStorageAvailable(): boolean {
  return storageAvailable;
}

export function markStorageWarningShown(): void {
  storageWarningShown = true;
}

export function hasStorageWarningBeenShown(): boolean {
  return storageWarningShown;
}

export function hasVisibleFlockTreatments(data: { treatments?: { animalId: number }[] }, visibleIds: Set<number>): boolean {
  return (data.treatments ?? []).every(({ animalId }) => visibleIds.has(animalId));
}

export interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  data: unknown;
  clientOperationId?: string;
  idempotencyKey?: string;
  localEntityId?: number;
  accountId?: string;
  operationId?: string;
  tempId?: number;
  timestamp: number;
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
  synced: number; // Use 0/1 instead of boolean for IndexedDB key compatibility
  failedAttempts?: number; // Track number of failed sync attempts
}

export type PendingSyncInput = Omit<SyncQueueItem, 'id' | 'timestamp' | 'synced'>;

function getTargetId(item: { action: SyncQueueItem['action']; data: unknown; tempId?: number }): number | undefined {
  if (typeof item.tempId === "number") return item.tempId;
  const maybe = item.data as { id?: unknown };
  return typeof maybe?.id === "number" ? maybe.id : undefined;
}

export function mergePendingSyncItems(existing: SyncQueueItem[], incoming: PendingSyncInput): {
  deleteIds: string[];
  upsertExisting?: SyncQueueItem;
  skipInsert: boolean;
} {
  const targetId = getTargetId(incoming);
  const related = existing.filter((item) => item.entity === incoming.entity);
  const relatedSameTarget = typeof targetId === "number"
    ? related.filter((item) => getTargetId(item) === targetId)
    : [];

  // Deduplicate creates with same tempId
  if (incoming.action === "create" && incoming.operationId) {
    const existingByOp = related.find((item) => item.operationId === incoming.operationId);
    if (existingByOp) return { deleteIds: [], skipInsert: true };
  }

  if (incoming.action === "create" && typeof incoming.tempId === "number") {
    const dupCreate = relatedSameTarget.find((item) => item.action === "create");
    if (dupCreate) return { deleteIds: [], skipInsert: true };
  }

  // Collapse multiple updates for the same target
  if (incoming.action === "update" && relatedSameTarget.length > 0) {
    const latestUpdate = relatedSameTarget
      .filter((item) => item.action === "update")
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (latestUpdate) {
      return {
        deleteIds: relatedSameTarget
          .filter((item) => item.action === "update" && item.id !== latestUpdate.id)
          .map((item) => item.id),
        upsertExisting: {
          ...latestUpdate,
          data: { ...(latestUpdate.data as object), ...(incoming.data as object) },
          tempId: incoming.tempId ?? latestUpdate.tempId,
          timestamp: Date.now(),
        },
        skipInsert: true,
      };
    }
  }

  // Delete supersedes pending updates and duplicate deletes for same target
  if (incoming.action === "delete" && relatedSameTarget.length > 0) {
    const createForSameTarget = relatedSameTarget.find((item) => item.action === "create");
    if (createForSameTarget) {
      return {
        deleteIds: relatedSameTarget.map((item) => item.id),
        skipInsert: true,
      };
    }
    const toDelete = relatedSameTarget.filter((item) => item.action === "update" || item.action === "delete");
    return {
      deleteIds: toDelete.map((item) => item.id),
      skipInsert: false,
    };
  }

  return { deleteIds: [], skipInsert: false };
}

let dbInstance: IDBDatabase | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[IndexedDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[IndexedDB] Database opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[IndexedDB] Upgrading database...');

      if (!db.objectStoreNames.contains('animals')) {
        const animalsStore = db.createObjectStore('animals', { keyPath: 'id' });
        animalsStore.createIndex('tagId', 'tagId', { unique: false });
        animalsStore.createIndex('status', 'status', { unique: false });
        animalsStore.createIndex('sex', 'sex', { unique: false });
      }

      if (!db.objectStoreNames.contains('breedingEvents')) {
        const breedingStore = db.createObjectStore('breedingEvents', { keyPath: 'id' });
        breedingStore.createIndex('eweId', 'eweId', { unique: false });
        breedingStore.createIndex('ramId', 'ramId', { unique: false });
      }

      if (!db.objectStoreNames.contains('matingGroups')) {
        const matingStore = db.createObjectStore('matingGroups', { keyPath: 'id' });
        matingStore.createIndex('ramId', 'ramId', { unique: false });
        matingStore.createIndex('status', 'status', { unique: false });
      }

      if (!db.objectStoreNames.contains('performanceRecords')) {
        const perfStore = db.createObjectStore('performanceRecords', { keyPath: 'id' });
        perfStore.createIndex('animalId', 'animalId', { unique: false });
      }

      if (!db.objectStoreNames.contains('healthRecords')) {
        const healthStore = db.createObjectStore('healthRecords', { keyPath: 'id' });
        healthStore.createIndex('animalId', 'animalId', { unique: false });
      }

      if (!db.objectStoreNames.contains('evaluations')) {
        const evalStore = db.createObjectStore('evaluations', { keyPath: 'id' });
        evalStore.createIndex('animalId', 'animalId', { unique: false });
      }

      if (!db.objectStoreNames.contains('farmSettings')) {
        db.createObjectStore('farmSettings', { keyPath: 'id' });
      }


      if (!db.objectStoreNames.contains('documents')) {
        const docsStore = db.createObjectStore('documents', { keyPath: 'id' });
        docsStore.createIndex('animalId', 'animalId', { unique: false });
      }

      if (!db.objectStoreNames.contains('exportedDocuments')) {
        const exportedStore = db.createObjectStore('exportedDocuments', { keyPath: 'id' });
        exportedStore.createIndex('subfolder', 'subfolder', { unique: false });
      }

      if (!db.objectStoreNames.contains('animalImages')) {
        const imagesStore = db.createObjectStore('animalImages', { keyPath: 'id' });
        imagesStore.createIndex('animalId', 'animalId', { unique: false });
      }

      if (!db.objectStoreNames.contains('flockHealthEvents')) {
        const flockHealthStore = db.createObjectStore('flockHealthEvents', { keyPath: 'id' });
        flockHealthStore.createIndex('eventDate', 'eventDate', { unique: false });
      }

      if (!db.objectStoreNames.contains('flockHealthTreatments')) {
        const treatmentsStore = db.createObjectStore('flockHealthTreatments', { keyPath: 'id' });
        treatmentsStore.createIndex('eventId', 'eventId', { unique: false });
        treatmentsStore.createIndex('animalId', 'animalId', { unique: false });
      }

      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('synced', 'synced', { unique: false });
        syncStore.createIndex('entity', 'entity', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
      
      // Migration for version 4: Convert boolean synced values to numbers
      if (event.oldVersion < 4 && db.objectStoreNames.contains('syncQueue')) {
        console.log('[IndexedDB] Migrating syncQueue boolean values to numbers');
      }
    };
  });
}

// Run migration to fix any old boolean values in syncQueue
export async function runMigrations(): Promise<void> {
  try {
    const db = await openDatabase();
    
    // Check if syncQueue store exists before trying to access it
    if (!db.objectStoreNames.contains('syncQueue')) {
      console.log('[IndexedDB] No syncQueue store yet, skipping migration');
      return;
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction('syncQueue', 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const request = store.getAll();
        
        request.onsuccess = () => {
          const items = request.result || [];
          let migratedCount = 0;
          
          for (const item of items) {
            // Convert boolean to number if needed
            if (typeof item.synced === 'boolean') {
              item.synced = item.synced ? 1 : 0;
              store.put(item);
              migratedCount++;
            }
          }
          
          if (migratedCount > 0) {
            console.log(`[IndexedDB] Migrated ${migratedCount} syncQueue items from boolean to number`);
          }
        };
        
        request.onerror = () => {
          console.warn('[IndexedDB] Migration getAll failed:', request.error);
        };
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        console.warn('[IndexedDB] Migration transaction error:', error);
        resolve(); // Don't crash if migration fails
      }
    });
  } catch (error) {
    console.warn('[IndexedDB] Migration check failed:', error);
  }
}

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getFromStore<T>(storeName: string, key: number | string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putInStore<T>(storeName: string, data: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function putManyInStore<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    items.forEach((item) => store.put(item));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Replace the authoritative server view atomically, rather than accumulating
// records that were deleted, moved, or hidden by a plan change. Pending writes
// remain in syncQueue even when their target is no longer readable. They can be
// retried after access is restored without exposing the old row in offline UI.
export async function replaceServerSnapshot(snapshot: Record<string, any[]>): Promise<void> {
  const db = await openDatabase();
  const allowed = new Set((snapshot.animals ?? []).map(row => row.id));
  const previousAnimals = await getAllFromStore<{ id: number }>('animals');
  const revoked = previousAnimals.some(row => row.id > 0 && !allowed.has(row.id));
  const relatedStores = ['breedingEvents', 'matingGroups', 'healthRecords', 'performanceRecords', 'documents', 'evaluations', 'animalImages', 'exportedDocuments', 'flockHealthEvents', 'flockHealthTreatments'];
  snapshot = { ...snapshot };
  const cachedRows = await Promise.all(relatedStores.map(name => snapshot[name] ?? getAllFromStore<any>(name)));
  for (const [index, name] of relatedStores.entries()) {
    const isCached = snapshot[name] === undefined;
    snapshot[name] = cachedRows[index].filter(row => {
      if (isCached && revoked && ['documents', 'exportedDocuments', 'flockHealthEvents'].includes(name)) return false;
      return [row.animalId, row.ramId, row.eweId, ...(row.eweIds ?? [])].every(ref =>
        typeof ref !== 'number' || ref < 0 || allowed.has(ref));
    });
  }
  const names = Object.keys(snapshot).sort((a, b) => Number(b === "animals") - Number(a === "animals"));
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...names, 'syncQueue', 'metadata'], 'readwrite');
    const queue = tx.objectStore('syncQueue').getAll();
    const metadata = tx.objectStore('metadata').getAll();
    const localAnimals = tx.objectStore('animals').getAll();
    let applied = false;
    const overlay = () => {
      if (applied || [queue, metadata, localAnimals].some(request => request.readyState !== 'done')) return;
      applied = true;
      const ids = new Map<string, number>(metadata.result.map(row => [row.key, row.serverId]));
      const pending = (queue.result as SyncQueueItem[]).filter(item => !item.synced).sort((a, b) => a.timestamp - b.timestamp);
      let visibleIds = new Set((snapshot.animals ?? []).map(row => row.id));
      for (const name of names) {
        const rows = new Map<number, Record<string, any>>((snapshot[name] ?? []).map(row => [row.id, row]));
        if (name === 'animals') {
          for (const row of localAnimals.result) {
            if (row.id < 0 && !ids.has(`tempId:animals:${row.id}`)) {
              const { dam, sire, grandparents, offspringAsDam, offspringAsSire, ...safe } = row;
              for (const parent of ['damId', 'sireId']) {
                if (safe[parent] > 0 && !visibleIds.has(safe[parent])) {
                  safe[parent] = null;
                  safe[parent === 'damId' ? 'externalDamInfo' : 'externalSireInfo'] = null;
                }
              }
              rows.set(row.id, safe);
            }
          }
        }
        for (const item of pending.filter(item => item.entity === name)) {
          const data = item.data as Record<string, any>;
          const localId = item.tempId ?? data.id;
          const id = ids.get(`tempId:${name}:${localId}`) ?? localId;
          if (typeof id !== 'number') continue;
          // Hidden server rows stay only in the retained retry queue. A local
          // create has a negative ID and has never been accepted by the server.
          if (id > 0 && !rows.has(id)) continue;
          if (id < 0 && item.action === 'update' && !rows.has(id)) continue;
          if (name !== 'animals' && [data.animalId, data.ramId, data.eweId, ...(data.eweIds ?? [])]
            .some(ref => typeof ref === 'number' && ref > 0 && !visibleIds.has(ref))) continue;
          if (item.action === 'delete') { rows.delete(id); continue; }
          const row: Record<string, any> = { ...rows.get(id), ...data, id };
          if (name === 'animals') {
            // Derived detail objects from an older Premium read are not writes.
            // Never let a retained patch reintroduce their hidden nested rows.
            for (const key of ['dam', 'sire', 'grandparents', 'offspringAsDam', 'offspringAsSire']) delete row[key];
            for (const parent of ['dam', 'sire']) {
              if (row[`${parent}Id`] > 0 && !visibleIds.has(row[`${parent}Id`])) {
                row[`${parent}Id`] = null;
                row[`external${parent === 'dam' ? 'Dam' : 'Sire'}Info`] = null;
              }
            }
          }
          rows.set(id, row);
        }
        if (name === "animals") visibleIds = new Set(rows.keys());
        if (name === "flockHealthEvents") {
          for (const [id, report] of rows) {
            if (!Array.isArray(report.treatments)) continue;
            const treatments = report.treatments.map(row => ({
              ...row,
              animalId: ids.get(`tempId:animals:${row.animalId}`) ?? row.animalId,
            }));
            if (hasVisibleFlockTreatments({ treatments }, visibleIds)) rows.set(id, { ...report, treatments });
            else rows.delete(id);
          }
        }
        const store = tx.objectStore(name);
        store.clear();
        rows.forEach(row => store.put(row));
      }
    };
    queue.onsuccess = metadata.onsuccess = localAnimals.onsuccess = overlay;
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Offline snapshot was not committed'));
  });
}

export async function deleteFromStore(storeName: string, key: number | string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingAnimal(row: { id: number }, item: PendingSyncInput): Promise<string> {
  const db = await openDatabase();
  const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["animals", "syncQueue"], "readwrite");
    tx.objectStore("animals").put(row);
    tx.objectStore("syncQueue").put({ ...item, id, synced: 0, syncStatus: "pending", timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  return id;
}

export async function finishPendingAnimal(tempId: number, queueId: string, created?: { id: number }): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["animals", "syncQueue", "metadata"], "readwrite");
    const animals = tx.objectStore("animals");
    if (created) {
      animals.put(created);
      tx.objectStore("metadata").put({ key: `tempId:animals:${tempId}`, tempId, serverId: created.id, entity: "animals" });
    }
    animals.delete(tempId);
    tx.objectStore("syncQueue").delete(queueId);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

export async function addToSyncQueue(item: PendingSyncInput): Promise<void> {
  const pending = await getPendingSyncItems();
  const mergeResult = mergePendingSyncItems(pending, item);

  for (const id of mergeResult.deleteIds) {
    await deleteFromStore('syncQueue', id);
  }

  if (mergeResult.upsertExisting) {
    await putInStore('syncQueue', mergeResult.upsertExisting);
  }

  if (mergeResult.skipInsert) {
    return;
  }

  const queueItem: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    syncStatus: 'pending',
    synced: 0, // Use 0 for false (IndexedDB doesn't support boolean keys)
  };
  await putInStore('syncQueue', queueItem);
}

export async function findPendingSyncItemByOperationId(entity: string, operationId: string): Promise<SyncQueueItem | undefined> {
  const pending = await getPendingSyncItems();
  return pending.find((item) => {
    if (item.entity !== entity) return false;
    if (item.operationId === operationId) return true;
    const payload = item.data as { clientId?: string };
    return payload?.clientId === operationId;
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDatabase();
  
  // Check if syncQueue store exists
  if (!db.objectStoreNames.contains('syncQueue')) {
    return [];
  }
  
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction('syncQueue', 'readonly');
      const store = transaction.objectStore('syncQueue');
      
      // Use getAll and filter manually to avoid IDBKeyRange errors with mixed key types
      // This is safer than using the index which can throw if boolean keys exist
      const request = store.getAll();

      request.onsuccess = () => {
        // Filter to only get unsynced items (handles both boolean and number values)
        const items = (request.result || []).filter(item =>
          item.synced === 0 || item.synced === false
        );
        items.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
        resolve(items);
      };
      
      request.onerror = () => {
        console.warn('[IndexedDB] getPendingSyncItems getAll failed:', request.error);
        resolve([]);
      };
      
      transaction.onerror = () => {
        console.warn('[IndexedDB] getPendingSyncItems transaction failed:', transaction.error);
        resolve([]);
      };
    } catch (error) {
      console.error('[IndexedDB] getPendingSyncItems error:', error);
      resolve([]); // Return empty array on error to prevent crashes
    }
  });
}

export async function markSynced(id: string): Promise<void> {
  const item = await getFromStore<SyncQueueItem>('syncQueue', id);
  if (item) {
    item.syncStatus = 'synced';
    item.synced = 1; // 1 = synced
    await putInStore('syncQueue', item);
  }
}

export async function removeSyncedItems(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction('syncQueue', 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      // Get all items and delete synced ones (handles both boolean and number values)
      const allRequest = store.getAll();
      allRequest.onsuccess = () => {
        const items = allRequest.result || [];
        for (const item of items) {
          if (item.synced === 1 || item.synced === true) {
            store.delete(item.id);
          }
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (error) {
      console.error('[IndexedDB] removeSyncedItems error:', error);
      resolve(); // Don't crash on cleanup errors
    }
  });
}

// Increment failure count for a sync queue item
export async function incrementSyncItemFailures(id: string): Promise<void> {
  const item = await getFromStore<SyncQueueItem>('syncQueue', id);
  if (item) {
    item.failedAttempts = (item.failedAttempts || 0) + 1;
    await putInStore('syncQueue', item);
    console.log(`[IndexedDB] Incremented failure count for ${id}: ${item.failedAttempts}`);
  }
}

// Purge sync items that have failed more than maxFailures times
// Also removes orphaned temp animals that no longer have valid sync queue entries
export async function purgeStuckSyncItems(maxFailures: number = 3): Promise<number> {
  const db = await openDatabase();
  let purgedCount = 0;
  
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['syncQueue', 'animals'], 'readwrite');
      const syncStore = transaction.objectStore('syncQueue');
      const animalsStore = transaction.objectStore('animals');
      
      const allRequest = syncStore.getAll();
      allRequest.onsuccess = async () => {
        const items = allRequest.result || [];
        
        for (const item of items) {
          let shouldPurge = false;
          
          // Rule 1: Delete items that have failed more than maxFailures times
          if ((item.failedAttempts || 0) > maxFailures) {
            shouldPurge = true;
            console.log(`[IndexedDB] Purging failed sync item: ${item.id}, failures: ${item.failedAttempts}`);
          }
          
          // Rule 2: Delete orphaned animal sync items where the temp animal doesn't exist
          if (!shouldPurge && item.entity === 'animals' && item.tempId && item.tempId < 0) {
            const animalRequest = animalsStore.get(item.tempId);
            animalRequest.onsuccess = () => {
              if (!animalRequest.result) {
                // Temp animal doesn't exist anymore - orphaned sync item
                syncStore.delete(item.id);
                purgedCount++;
                console.log(`[IndexedDB] Purging orphaned sync item: ${item.id}, tempId: ${item.tempId}`);
              }
            };
          }
          
          if (shouldPurge) {
            syncStore.delete(item.id);
            purgedCount++;
            
            // Also clean up orphaned temp animals from the animals store
            if (item.tempId && item.tempId < 0 && item.entity === 'animals') {
              animalsStore.delete(item.tempId);
              console.log(`[IndexedDB] Also purged orphaned temp animal: ${item.tempId}`);
            }
          }
        }
      };

      transaction.oncomplete = () => {
        console.log(`[IndexedDB] Purged ${purgedCount} stuck sync items`);
        resolve(purgedCount);
      };
      transaction.onerror = () => reject(transaction.error);
    } catch (error) {
      console.error('[IndexedDB] purgeStuckSyncItems error:', error);
      resolve(0);
    }
  });
}

// Check if an animal with given ID exists in IndexedDB
export async function animalExistsInCache(animalId: number): Promise<boolean> {
  try {
    const animal = await getFromStore('animals', animalId);
    return !!animal;
  } catch {
    return false;
  }
}

// Check if a temp ID is in the pending sync queue
export async function tempIdInSyncQueue(tempId: number): Promise<boolean> {
  try {
    const pending = await getPendingSyncItems();
    return pending.some(item => 
      item.tempId === tempId || 
      (item.data as { id?: number })?.id === tempId
    );
  } catch {
    return false;
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  const metadata = await getFromStore<{ key: string; value: number }>('metadata', 'lastSync');
  return metadata?.value || null;
}

export async function setLastSyncTime(timestamp: number): Promise<void> {
  await putInStore('metadata', { key: 'lastSync', value: timestamp });
}

export async function clearAllOfflineData(): Promise<void> {
  const db = await openDatabase();
  const storeNames = [
    'animals',
    'breedingEvents',
    'matingGroups',
    'performanceRecords',
    'healthRecords',
    'evaluations',
    'farmSettings',
    'documents',
    'exportedDocuments',
    'animalImages',
    'flockHealthEvents',
    'flockHealthTreatments',
    'syncQueue',
    'metadata'
  ];

  const existingStores = Array.from(db.objectStoreNames);
  const storesToClear = storeNames.filter(name => existingStores.includes(name));

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storesToClear, 'readwrite');
    
    storesToClear.forEach(storeName => {
      transaction.objectStore(storeName).clear();
    });

    transaction.oncomplete = () => {
      console.log('[IndexedDB] All offline data cleared');
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getOnboardingCompleted(): Promise<boolean> {
  const metadata = await getFromStore<{ key: string; value: boolean }>('metadata', 'onboardingCompleted');
  return metadata?.value ?? false;
}

export async function setOnboardingCompleted(completed: boolean): Promise<void> {
  await putInStore('metadata', { key: 'onboardingCompleted', value: completed });
}

// User isolation - store current userId and clear data when user changes
export async function getCurrentUserId(): Promise<string | null> {
  const metadata = await getFromStore<{ key: string; value: string }>('metadata', 'currentUserId');
  return metadata?.value || null;
}

export async function setCurrentUserId(userId: string): Promise<void> {
  await putInStore('metadata', { key: 'currentUserId', value: userId });
}

// Called on login to ensure data isolation between users
export async function ensureUserIsolation(userId: string): Promise<boolean> {
  const storedUserId = await getCurrentUserId();
  
  if (storedUserId && storedUserId !== userId) {
    if ((await getPendingSyncItems()).length > 0) {
      throw new Error("This device has unsynced records for another workspace. Sign back into that workspace and sync before switching accounts.");
    }
    console.log(`[IndexedDB] User changed from ${storedUserId} to ${userId}, clearing offline data`);
    await clearAllOfflineData();
    await setCurrentUserId(userId);
    return true; // Data was cleared
  }
  
  if (!storedUserId) {
    await setCurrentUserId(userId);
  }
  
  return false; // No data cleared
}
