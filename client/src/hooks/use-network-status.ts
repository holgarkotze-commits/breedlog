import { useState, useEffect, useCallback } from 'react';
import { syncManager, SyncState, FullSyncResult } from '@/lib/sync-manager';
import { useQueryClient } from '@tanstack/react-query';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());
  const queryClient = useQueryClient();

  // Handle sync completion - invalidate caches to refresh data
  const handleSyncComplete = useCallback(() => {
    console.log('[useNetworkStatus] Sync complete, invalidating caches');
    // Invalidate all application queries to refresh from IndexedDB/server
    queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
    queryClient.invalidateQueries({ queryKey: ['/api/breeding-events'] });
    queryClient.invalidateQueries({ queryKey: ['/api/mating-groups'] });
    queryClient.invalidateQueries({ queryKey: ['/api/health-records'] });
    queryClient.invalidateQueries({ queryKey: ['/api/performance-records'] });
    queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    queryClient.invalidateQueries({ queryKey: ['/api/farm-settings'] });
  }, [queryClient]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = syncManager.subscribe(setSyncState);
    const unsubscribeSyncComplete = syncManager.subscribeToSyncComplete(handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      unsubscribeSyncComplete();
    };
  }, [handleSyncComplete]);

  // Simple sync trigger (existing behavior)
  const triggerSync = async (): Promise<boolean> => {
    if (isOnline) {
      return syncManager.sync();
    }
    return false;
  };

  // Robust manual sync with lie-fi detection (new requirement)
  const performFullSync = async (): Promise<FullSyncResult> => {
    return syncManager.performFullSyncAction();
  };

  // Reload data from local cache only (no network)
  const reloadLocalData = async (): Promise<void> => {
    await syncManager.reloadLocalData();
  };

  // Check if sync is in progress
  const isSyncing = (): boolean => {
    return syncManager.isSyncing();
  };

  return {
    isOnline,
    syncState,
    triggerSync,
    performFullSync,
    reloadLocalData,
    isSyncing,
  };
}
