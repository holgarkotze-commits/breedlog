import { useState, useEffect, useCallback } from 'react';
import { syncManager, SyncState } from '@/lib/sync-manager';
import { useQueryClient } from '@tanstack/react-query';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());
  const queryClient = useQueryClient();

  // Handle sync completion - invalidate caches to refresh data
  const handleSyncComplete = useCallback(() => {
    console.log('[useNetworkStatus] Sync complete, invalidating caches');
    // Invalidate all animal-related queries to refresh from IndexedDB/server
    queryClient.invalidateQueries({ queryKey: ['/api/animals'] });
    queryClient.invalidateQueries({ queryKey: ['/api/breeding-events'] });
    queryClient.invalidateQueries({ queryKey: ['/api/mating-groups'] });
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

  const triggerSync = async () => {
    if (isOnline) {
      return syncManager.sync();
    }
    return false;
  };

  return {
    isOnline,
    syncState,
    triggerSync,
  };
}
