import { useState, useEffect } from 'react';
import { syncManager, SyncState } from '@/lib/sync-manager';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = syncManager.subscribe(setSyncState);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

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
