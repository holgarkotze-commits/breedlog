import { useState, useEffect, useRef } from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle, Cloud, CloudOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
