import { 
  getPendingSyncItems, 
  markSynced, 
  removeSyncedItems,
  putManyInStore,
  getAllFromStore,
  setLastSyncTime,
  deleteFromStore,
  putInStore,
  getFromStore,
  runMigrations,
  SyncQueueItem
} from './indexeddb';
import { apiRequest } from './queryClient';

interface TempIdMapping {
  tempId: number;
  serverId: number;
  entity: string;
}

async function getTempIdMappings(): Promise<TempIdMapping[]> {
  try {
    const mappings = await getAllFromStore<TempIdMapping>('metadata');
    return mappings.filter(m => (m as { key?: string }).key?.startsWith('tempId:'))
      .map(m => m as unknown as TempIdMapping);
  } catch {
    return [];
  }
}

async function saveTempIdMapping(tempId: number, serverId: number, entity: string): Promise<void> {
  const mapping = { key: `tempId:${entity}:${tempId}`, tempId, serverId, entity };
  await putInStore('metadata', mapping);
}

async function getServerIdForTemp(tempId: number, entity: string): Promise<number | null> {
  try {
    const mapping = await getFromStore<{ tempId: number; serverId: number }>('metadata', `tempId:${entity}:${tempId}`);
    return mapping?.serverId ?? null;
  } catch {
    return null;
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: number | null;
  error: string | null;
}

type SyncCallback = (state: SyncState) => void;

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds

class SyncManager {
  private listeners: Set<SyncCallback> = new Set();
  private state: SyncState = {
    status: navigator.onLine ? 'idle' : 'offline',
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
  };
  private syncInProgress = false;
  private retryCount = 0;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_REQUESTED') {
          this.sync();
        }
      });
    }

    // Run migrations on startup to fix any old data
    this.initialize(0);
  }
  
  private async initialize(attempt: number) {
    const maxAttempts = 5;
    try {
      await runMigrations();
      await this.updatePendingCount();
      console.log('[SyncManager] Initialization complete');
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(`[SyncManager] Initialization attempt ${attempt + 1}/${maxAttempts} failed, retrying...`);
        setTimeout(() => this.initialize(attempt + 1), 2000);
      } else {
        console.warn('[SyncManager] Initialization failed after max attempts:', error);
      }
    }
  }

  private handleOnline() {
    console.log('[SyncManager] Online - starting sync');
    this.updateState({ status: 'idle', error: null });
    this.sync();
  }

  private handleOffline() {
    console.log('[SyncManager] Offline');
    this.updateState({ status: 'offline', error: null });
  }

  private updateState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((callback) => callback(this.state));
  }

  subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  getState(): SyncState {
    return this.state;
  }

  async updatePendingCount(retryCount = 0): Promise<void> {
    const maxRetries = 3;
    try {
      const pending = await getPendingSyncItems();
      this.updateState({ pendingCount: pending.length });
    } catch (error) {
      if (retryCount < maxRetries) {
        setTimeout(() => this.updatePendingCount(retryCount + 1), 1000);
      } else {
        console.warn('[SyncManager] Failed to get pending count after retries');
        this.updateState({ pendingCount: 0 });
      }
    }
  }

  async sync(): Promise<boolean> {
    if (this.syncInProgress || !navigator.onLine) {
      return false;
    }

    // Clear any pending retry
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.syncInProgress = true;
    this.updateState({ status: 'syncing', error: null });

    try {
      await this.pushChanges();
      await this.pullData();
      await removeSyncedItems();
      
      const now = Date.now();
      await setLastSyncTime(now);
      
      // Reset retry count on success
      this.retryCount = 0;
      
      this.updateState({ 
        status: 'synced', 
        lastSyncTime: now,
        pendingCount: 0 
      });
      
      console.log('[SyncManager] Sync completed successfully');
      return true;
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);
      
      // Log detailed error info for debugging
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        retryCount: this.retryCount,
        timestamp: new Date().toISOString(),
        online: navigator.onLine
      };
      console.log('[SyncManager] Error details:', JSON.stringify(errorDetails));
      
      // Schedule retry with exponential backoff if under max retries
      if (this.retryCount < MAX_RETRIES && navigator.onLine) {
        const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, this.retryCount), MAX_RETRY_DELAY);
        this.retryCount++;
        console.log(`[SyncManager] Scheduling retry ${this.retryCount}/${MAX_RETRIES} in ${delay}ms`);
        
        this.retryTimeoutId = setTimeout(() => {
          this.retryTimeoutId = null;
          this.sync();
        }, delay);
        
        // Don't show error status during retry, keep syncing status
        this.updateState({ status: 'idle' });
      } else {
        // Max retries exceeded, show error but don't spam user
        this.updateState({ 
          status: 'error', 
          error: 'Sync failed - will retry automatically'
        });
        
        // Reset retry count for next manual attempt
        this.retryCount = 0;
      }
      
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async pushChanges(): Promise<void> {
    const pendingItems = await getPendingSyncItems();
    console.log(`[SyncManager] Pushing ${pendingItems.length} changes`);

    for (const item of pendingItems) {
      try {
        await this.processSyncItem(item);
        await markSynced(item.id);
      } catch (error) {
        console.error(`[SyncManager] Failed to sync item ${item.id}:`, error);
        throw error;
      }
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const entityEndpoints: Record<string, string> = {
      animals: '/api/animals',
      breedingEvents: '/api/breeding-events',
      matingGroups: '/api/mating-groups',
      performanceRecords: '/api/performance-records',
      healthRecords: '/api/health-records',
      documents: '/api/documents',
      farmSettings: '/api/farm-settings',
    };

    const endpoint = entityEndpoints[item.entity];
    if (!endpoint) {
      console.warn(`[SyncManager] Unknown entity: ${item.entity}`);
      return;
    }

    switch (item.action) {
      case 'create':
        const response = await apiRequest('POST', endpoint, item.data);
        const created = await response.json();
        if (item.tempId && created.id) {
          console.log(`[SyncManager] ID reconciliation: temp ${item.tempId} -> server ${created.id}`);
          await saveTempIdMapping(item.tempId, created.id, item.entity);
          await deleteFromStore(item.entity, item.tempId);
          await putInStore(item.entity, created);
        }
        break;
      case 'update':
        const updateData = item.data as { id: number; [key: string]: unknown };
        let updateId = updateData.id;
        if (item.tempId) {
          const mappedId = await getServerIdForTemp(item.tempId, item.entity);
          if (mappedId) {
            updateId = mappedId;
            console.log(`[SyncManager] Using mapped ID for update: ${item.tempId} -> ${updateId}`);
          }
        }
        if (updateId > 0) {
          const dataWithId = { ...(item.data as Record<string, unknown>), id: updateId };
          await apiRequest('PATCH', `${endpoint}/${updateId}`, dataWithId);
        } else {
          console.log(`[SyncManager] Skipping update for unsynced temp ID: ${updateId}`);
        }
        break;
      case 'delete':
        const deleteData = item.data as { id: number };
        let deleteId = deleteData.id;
        if (deleteId < 0) {
          const mappedId = await getServerIdForTemp(deleteId, item.entity);
          if (mappedId) deleteId = mappedId;
        }
        if (deleteId > 0) {
          await apiRequest('DELETE', `${endpoint}/${deleteId}`);
        }
        break;
    }
  }

  private async pullData(): Promise<void> {
    console.log('[SyncManager] Pulling latest data from server');

    const endpoints = [
      { url: '/api/animals', store: 'animals' },
      { url: '/api/breeding-events', store: 'breedingEvents' },
      { url: '/api/mating-groups', store: 'matingGroups' },
      { url: '/api/farm-settings', store: 'farmSettings' },
    ];

    for (const { url, store } of endpoints) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data) ? data : data ? [data] : [];
          if (items.length > 0) {
            await putManyInStore(store, items);
          }
        }
      } catch (error) {
        console.warn(`[SyncManager] Failed to pull ${store}:`, error);
      }
    }
  }

  async getOfflineData<T>(storeName: string): Promise<T[]> {
    return getAllFromStore<T>(storeName);
  }
}

export const syncManager = new SyncManager();
