import { 
  getPendingSyncItems, 
  markSynced, 
  removeSyncedItems,
  purgeStuckSyncItems,
  incrementSyncItemFailures,
  putManyInStore,
  getAllFromStore,
  setLastSyncTime,
  deleteFromStore,
  getFromStore,
  putInStore,
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

// Result types for performFullSyncAction
export type FullSyncResult = 'SYNC_COMPLETE' | 'SYNC_PARTIAL_ERROR' | 'OFFLINE_MODE';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: number | null;
  error: string | null;
  failedItems: number; // Items that failed permanently (4xx errors)
  backendReachable: boolean; // True connectivity status based on ping
}

type SyncCallback = (state: SyncState) => void;
type SyncCompleteCallback = () => void;

const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds

// Robust backend ping with timeout (the "Lie-Fi" check)
async function pingBackend(timeoutMs: number = 5000): Promise<boolean> {
  // First check browser status
  if (!navigator.onLine) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch('/api/version', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (err) {
    console.log('[SyncManager] Backend ping failed:', err);
    return false;
  }
}

class SyncManager {
  private listeners: Set<SyncCallback> = new Set();
  private syncCompleteListeners: Set<SyncCompleteCallback> = new Set();
  private state: SyncState = {
    status: navigator.onLine ? 'idle' : 'offline',
    pendingCount: 0,
    lastSyncTime: null,
    error: null,
    failedItems: 0,
    backendReachable: navigator.onLine,
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

  subscribeToSyncComplete(callback: SyncCompleteCallback): () => void {
    this.syncCompleteListeners.add(callback);
    return () => this.syncCompleteListeners.delete(callback);
  }

  private notifySyncComplete() {
    this.syncCompleteListeners.forEach((callback) => callback());
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
      const pushResult = await this.pushChanges();
      if (pushResult.retryableCount > 0) {
        throw new Error(`${pushResult.retryableCount} items could not be synced`);
      }
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
      
      // Notify listeners that sync is complete (for cache invalidation)
      this.notifySyncComplete();
      
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

  private async pushChanges(): Promise<{ successCount: number; failedCount: number; retryableCount: number }> {
    const pendingItems = await getPendingSyncItems();
    console.log(`[SyncManager] Pushing ${pendingItems.length} changes`);

    let successCount = 0;
    let failedCount = 0; // Permanent failures (4xx)
    let retryableCount = 0; // Network/server errors (5xx, timeout)

    for (const item of pendingItems) {
      try {
        await putInStore('syncQueue', { ...item, syncStatus: 'syncing' });
        await this.processSyncItem(item);
        await markSynced(item.id);
        successCount++;
      } catch (error) {
        console.error(`[SyncManager] Failed to sync item ${item.id}:`, error);
        
        // Classify the error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusMatch = errorMessage.match(/^(\d{3}):/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        
        // Increment failure count for this item
        await incrementSyncItemFailures(item.id);
        
        if (statusCode >= 400 && statusCode < 500) {
          const conflict = statusCode === 409;
          console.log(`[SyncManager] Client-side failure (${statusCode}) for item ${item.id}, keeping in queue for resolution/retry`);
          await putInStore('syncQueue', { ...item, syncStatus: conflict ? 'conflict' : 'failed' });
          retryableCount++;
        } else {
          // Network error or 5xx - keep in queue for retry (failure count incremented above)
          console.log(`[SyncManager] Retryable error for item ${item.id}, keeping in queue with incremented failure count`);
          await putInStore('syncQueue', { ...item, syncStatus: 'failed' });
          retryableCount++;
        }
      }
    }

    return { successCount, failedCount, retryableCount };
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
        const payloadData = item.data as Record<string, unknown>;
        const idempotencyKey = item.operationId || (typeof payloadData.clientId === "string" ? payloadData.clientId : undefined);
        const payload = idempotencyKey
          ? { ...payloadData, clientId: idempotencyKey }
          : payloadData;
        const response = await apiRequest('POST', endpoint, payload, {
          headers: idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : undefined,
        });
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
          await apiRequest('PUT', `${endpoint}/${updateId}`, dataWithId);
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

  private async pullData(): Promise<{ successCount: number; failedCount: number }> {
    console.log('[SyncManager] Pulling latest data from server');
    
    // Get auth token for API calls
    const token = localStorage.getItem('breedlog_device_token');
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const endpoints = [
      { url: '/api/animals', store: 'animals' },
      { url: '/api/breeding-events', store: 'breedingEvents' },
      { url: '/api/mating-groups', store: 'matingGroups' },
      { url: '/api/farm-settings', store: 'farmSettings' },
      { url: '/api/health-records', store: 'healthRecords' },
      { url: '/api/performance-records', store: 'performanceRecords' },
      { url: '/api/documents', store: 'documents' },
    ];

    let successCount = 0;
    let failedCount = 0;

    // Pull data in parallel for faster sync
    await Promise.all(endpoints.map(async ({ url, store }) => {
      try {
        const response = await fetch(url, { 
          credentials: 'include',
          headers 
        });
        
        // Check content type before parsing
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType?.includes('application/json')) {
          console.warn(`[SyncManager] Pull ${store}: Non-JSON response or error (status: ${response.status})`);
          failedCount++;
          return;
        }
        
        const data = await response.json();
        const items = Array.isArray(data) ? data : data ? [data] : [];
        if (store === 'animals' && items.length === 0) {
          const localAnimals = await getAllFromStore<any>('animals');
          if (Array.isArray(localAnimals) && localAnimals.length > 0) {
            console.warn('[SyncManager] Server returned no animals, but local animal records exist. Keeping local data to prevent silent replacement.');
            failedCount++;
            return;
          }
        }
        if (items.length > 0) {
          await putManyInStore(store, items);
        }
        successCount++;
      } catch (error) {
        console.warn(`[SyncManager] Failed to pull ${store}:`, error);
        failedCount++;
      }
    }));
    
    return { successCount, failedCount };
  }

  async getOfflineData<T>(storeName: string): Promise<T[]> {
    return getAllFromStore<T>(storeName);
  }

  // Reload data from local IndexedDB cache without network calls
  async reloadLocalData(): Promise<void> {
    console.log('[SyncManager] Reloading data from local cache');
    await this.updatePendingCount();
    // Notify complete to trigger query invalidation
    this.notifySyncComplete();
  }

  // Check if sync is currently in progress (for debouncing)
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  // Purge sync items that have failed more than maxFailures times (default 3)
  async purgeFailedSyncs(maxFailures: number = 3): Promise<number> {
    console.log('[SyncManager] Purging sync items with >' + maxFailures + ' failures...');
    const purgedCount = await purgeStuckSyncItems(maxFailures);
    await this.updatePendingCount();
    this.notifySyncComplete();
    return purgedCount;
  }

  // The robust manual sync function as per requirements
  async performFullSyncAction(): Promise<FullSyncResult> {
    console.log('[SyncManager] performFullSyncAction() initiated');
    
    // Prevent duplicate sync calls (debouncing)
    if (this.syncInProgress) {
      console.log('[SyncManager] Sync already in progress, aborting');
      return this.state.backendReachable ? 'SYNC_COMPLETE' : 'OFFLINE_MODE';
    }

    // STEP A: ROBUST NETWORK REACHABILITY CHECK
    // A1: Browser check first
    if (!navigator.onLine) {
      console.log('[SyncManager] Browser reports offline');
      this.updateState({ status: 'offline', backendReachable: false });
      await this.reloadLocalData();
      return 'OFFLINE_MODE';
    }

    // A2: Backend ping (the "Lie-Fi" check)
    console.log('[SyncManager] Performing backend ping...');
    const backendReachable = await pingBackend(5000);
    this.updateState({ backendReachable });

    if (!backendReachable) {
      // A3: Treat as offline
      console.log('[SyncManager] Backend ping failed - treating as offline');
      this.updateState({ status: 'offline' });
      await this.reloadLocalData();
      return 'OFFLINE_MODE';
    }

    // STEP B: ONLINE SYNC CYCLE
    this.syncInProgress = true;
    this.updateState({ status: 'syncing', error: null });

    try {
      // B1: PUSH (upstream with error classification)
      const pushResult = await this.pushChanges();
      console.log('[SyncManager] Push results:', pushResult);

      // B2: PULL & REFRESH (downstream)
      const pullResult = await this.pullData();
      console.log('[SyncManager] Pull results:', pullResult);
      
      await removeSyncedItems();

      const now = Date.now();
      await setLastSyncTime(now);

      // Update pending count to reflect retryable items
      await this.updatePendingCount();
      
      this.retryCount = 0;

      // Update failed items count in state for accurate status badge
      this.updateState({ failedItems: pushResult.failedCount });

      // Determine result based on push AND pull phases
      const hasErrors = pushResult.failedCount > 0 || pullResult.failedCount > 0;
      
      if (hasErrors) {
        const errorParts = [];
        if (pushResult.failedCount > 0) {
          errorParts.push(`${pushResult.failedCount} item(s) failed to push`);
        }
        if (pullResult.failedCount > 0) {
          errorParts.push(`${pullResult.failedCount} endpoint(s) failed to pull`);
        }
        
        this.updateState({
          status: 'synced',
          lastSyncTime: now,
          error: errorParts.join('; ')
        });
        this.notifySyncComplete();
        return 'SYNC_PARTIAL_ERROR';
      }

      this.updateState({
        status: 'synced',
        lastSyncTime: now,
        error: null
      });

      console.log('[SyncManager] Full sync completed successfully');
      this.notifySyncComplete();
      return 'SYNC_COMPLETE';

    } catch (error) {
      console.error('[SyncManager] Full sync failed:', error);
      
      // On complete failure, still reload from local
      this.updateState({
        status: 'error',
        error: 'Sync failed - data reloaded from local cache'
      });
      await this.reloadLocalData();
      return 'SYNC_PARTIAL_ERROR';
      
    } finally {
      this.syncInProgress = false;
    }
  }
}

export const syncManager = new SyncManager();
