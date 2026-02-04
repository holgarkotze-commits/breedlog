import { useState, useEffect, useRef } from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle, Cloud, CloudOff, X, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { checkStorageAvailability, isStorageAvailable, markStorageWarningShown, hasStorageWarningBeenShown } from '@/lib/indexeddb';

// Status indicator badge (green/yellow/red dot)
export function SyncStatusBadge() {
  const { syncState } = useNetworkStatus();
  
  // Determine dot color based on state
  const getDotColor = () => {
    if (!syncState.backendReachable) {
      return 'bg-red-500'; // Red: Backend unreachable
    }
    if (syncState.pendingCount > 0 || syncState.failedItems > 0) {
      return 'bg-yellow-500'; // Yellow: Items waiting in queue
    }
    return 'bg-green-500'; // Green: Backend reachable + queues empty
  };

  const getTooltip = () => {
    if (!syncState.backendReachable) {
      return 'Backend unreachable';
    }
    if (syncState.failedItems > 0) {
      return `${syncState.failedItems} failed items`;
    }
    if (syncState.pendingCount > 0) {
      return `${syncState.pendingCount} pending`;
    }
    return 'Synced';
  };

  return (
    <div 
      className={cn("w-2.5 h-2.5 rounded-full", getDotColor())}
      title={getTooltip()}
      data-testid="sync-status-dot"
    />
  );
}

// Global refresh button for header
export function GlobalRefreshButton({ location = 'header' }: { location?: 'header' | 'sidebar' }) {
  const { syncState, performFullSync, isSyncing } = useNetworkStatus();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || isSyncing()) return;
    
    setIsRefreshing(true);
    try {
      const result = await performFullSync();
      
      switch (result) {
        case 'SYNC_COMPLETE':
          toast({
            title: "Data synced",
            description: "All data synchronized successfully",
          });
          break;
        case 'OFFLINE_MODE':
          toast({
            title: "Backend unreachable",
            description: "Reloaded local data. Changes saved to device.",
            variant: "default",
          });
          break;
        case 'SYNC_PARTIAL_ERROR':
          toast({
            title: "Sync complete with warnings",
            description: "Some items failed to sync",
            variant: "destructive",
          });
          break;
      }
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Unable to sync data",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const isBusy = isRefreshing || syncState.status === 'syncing';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRefresh}
      disabled={isBusy}
      className="flex items-center gap-1.5"
      data-testid={`button-refresh-${location}`}
    >
      <RefreshCw className={cn("w-4 h-4", isBusy && "animate-spin")} />
      <span className="hidden sm:inline text-xs">Refresh</span>
    </Button>
  );
}

export function NetworkStatusIndicator() {
  const { isOnline, syncState, triggerSync } = useNetworkStatus();

  const getStatusIcon = () => {
    if (!isOnline) return <WifiOff className="w-3.5 h-3.5" />;
    
    switch (syncState.status) {
      case 'syncing':
        return <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
      case 'synced':
        return <Check className="w-3.5 h-3.5" />;
      case 'error':
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return <Cloud className="w-3.5 h-3.5" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline Mode';
    
    switch (syncState.status) {
      case 'syncing':
        return 'Syncing...';
      case 'synced':
        return 'Synced';
      case 'error':
        return 'Sync Error';
      default:
        return syncState.pendingCount > 0 ? `${syncState.pendingCount} pending` : 'Online';
    }
  };

  const getStatusVariant = (): 'default' | 'secondary' | 'destructive' => {
    if (!isOnline) return 'secondary';
    if (syncState.status === 'error') return 'destructive';
    return 'default';
  };

  return (
    <div className="flex items-center gap-2" data-testid="network-status">
      <SyncStatusBadge />
      <Badge 
        variant={getStatusVariant()}
        className={cn(
          "flex items-center gap-1.5 text-xs",
          !isOnline && "bg-amber-900/50 text-amber-200 border-amber-700"
        )}
        data-testid="status-badge"
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </Badge>
      
      {isOnline && syncState.pendingCount > 0 && syncState.status !== 'syncing' && (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={triggerSync}
          data-testid="button-sync"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

export function OfflineBanner() {
  const { isOnline, syncState, triggerSync } = useNetworkStatus();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const lastErrorRef = useRef<string | null>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset collapsed state when status changes significantly
  useEffect(() => {
    const currentError = syncState.error;
    if (currentError !== lastErrorRef.current) {
      setIsCollapsed(false);
      lastErrorRef.current = currentError;
    }
  }, [syncState.error]);

  // Auto-collapse after 5 seconds (but keep minimal indicator visible)
  useEffect(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }

    const shouldShow = !isOnline || syncState.status === 'error';
    if (shouldShow && !isCollapsed) {
      collapseTimerRef.current = setTimeout(() => {
        setIsCollapsed(true);
      }, 5000);
    }

    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, [isOnline, syncState.status, isCollapsed]);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await triggerSync();
    } finally {
      setTimeout(() => setIsRetrying(false), 2000);
    }
  };

  const handleExpand = () => {
    setIsCollapsed(false);
  };

  const handleCollapse = () => {
    setIsCollapsed(true);
  };

  // Don't show if online and no error
  if (isOnline && syncState.status !== 'error') return null;

  // Collapsed minimal indicator (small floating badge)
  if (isCollapsed) {
    return (
      <button
        onClick={handleExpand}
        className={cn(
          "fixed top-2 left-2 z-50 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all hover-elevate",
          !isOnline 
            ? "bg-amber-900/90 text-amber-100" 
            : "bg-card/95 text-foreground border border-border"
        )}
        data-testid="offline-indicator-collapsed"
        aria-label="Expand offline status"
      >
        {!isOnline ? (
          <CloudOff className="w-3 h-3" />
        ) : (
          <AlertCircle className="w-3 h-3 text-primary" />
        )}
        <span className="sr-only sm:not-sr-only">
          {!isOnline ? "Offline" : "Sync"}
        </span>
      </button>
    );
  }

  // Expanded banner
  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium animate-in slide-in-from-top duration-300",
        !isOnline 
          ? "bg-amber-900/90 text-amber-100" 
          : "bg-card/95 text-foreground border-b border-border"
      )}
      data-testid="offline-banner"
    >
      <div className="flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <CloudOff className="w-4 h-4 text-primary" />
            <span>Offline mode - changes saved locally</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 text-primary" />
            <span>Sync issue - data saved locally</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="h-6 px-2 text-xs"
              data-testid="button-retry-sync"
            >
              {isRetrying ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                'Retry'
              )}
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCollapse}
          className="h-6 w-6 ml-2"
          data-testid="button-collapse-banner"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// Storage warning banner for incognito/private mode
export function StorageWarningBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check storage availability on mount
    const checkStorage = async () => {
      const available = await checkStorageAvailability();
      if (!available && !hasStorageWarningBeenShown()) {
        setIsVisible(true);
      }
    };
    checkStorage();
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    markStorageWarningShown();
    setIsVisible(false);
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 py-3 px-4 text-center text-sm font-medium bg-amber-900/95 text-amber-100 animate-in slide-in-from-top duration-300"
      data-testid="storage-warning-banner"
    >
      <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto">
        <HardDrive className="w-4 h-4 flex-shrink-0" />
        <span>Browser storage restricted. Offline data may not be saved. Use a regular browser window for full functionality.</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-6 w-6 ml-2 flex-shrink-0 text-amber-100 hover:text-white hover:bg-amber-800"
          data-testid="button-dismiss-storage-warning"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
