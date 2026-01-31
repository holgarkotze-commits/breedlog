const DB_NAME = 'breedlog-offline';
const DB_VERSION = 4; // Updated to fix boolean key issue in syncQueue

export interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  data: unknown;
  tempId?: number;
  timestamp: number;
  synced: number; // Use 0/1 instead of boolean for IndexedDB key compatibility
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
    };
  });
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

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'synced'>): Promise<void> {
  const queueItem: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    synced: 0, // Use 0 for false (IndexedDB doesn't support boolean keys)
  };
  await putInStore('syncQueue', queueItem);
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readonly');
    const store = transaction.objectStore('syncQueue');
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(0)); // 0 = not synced

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markSynced(id: string): Promise<void> {
  const item = await getFromStore<SyncQueueItem>('syncQueue', id);
  if (item) {
    item.synced = 1; // 1 = synced
    await putInStore('syncQueue', item);
  }
}

export async function removeSyncedItems(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('syncQueue', 'readwrite');
    const store = transaction.objectStore('syncQueue');
    const index = store.index('synced');
    const request = index.openCursor(IDBKeyRange.only(1)); // 1 = synced

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
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
