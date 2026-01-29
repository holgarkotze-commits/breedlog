import { 
  getPendingSyncItems, 
  markSynced, 
  removeSyncedItems,
  putManyInStore,
  getAllFromStore,
  setLastSyncTime,
  SyncQueueItem
} from './indexeddb';
import { apiRequest } from './queryClient';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: number | null;
  error: string | null;
}

type SyncCallback = (state: SyncState) => void;

class SyncManager {
  private listeners: Set<SyncCallback> = new Set();
  private state: SyncState = {
    status: navigator.onLine ? 'idle' : 'offline',
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
  };
  private syncInProgress = false;

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

    this.updatePendingCount();
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

  async updatePendingCount() {
    try {
      const pending = await getPendingSyncItems();
      this.updateState({ pendingCount: pending.length });
    } catch (error) {
      console.log('[SyncManager] Database not ready yet, will retry');
      setTimeout(() => this.updatePendingCount(), 1000);
    }
  }

  async sync(): Promise<boolean> {
    if (this.syncInProgress || !navigator.onLine) {
      return false;
    }

    this.syncInProgress = true;
    this.updateState({ status: 'syncing', error: null });

    try {
      await this.pushChanges();
      await this.pullData();
      await removeSyncedItems();
      
      const now = Date.now();
      await setLastSyncTime(now);
      
      this.updateState({ 
        status: 'synced', 
        lastSyncTime: now,
        pendingCount: 0 
      });
      
      console.log('[SyncManager] Sync completed successfully');
      return true;
    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);
      this.updateState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Sync failed' 
      });
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
      evaluations: '/api/evaluations',
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
        await apiRequest('POST', endpoint, item.data);
        break;
      case 'update':
        const updateData = item.data as { id: number; [key: string]: unknown };
        await apiRequest('PATCH', `${endpoint}/${updateData.id}`, item.data);
        break;
      case 'delete':
        const deleteData = item.data as { id: number };
        await apiRequest('DELETE', `${endpoint}/${deleteData.id}`);
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
