import { useNetworkStatus } from '@/hooks/use-network-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, Check, AlertCircle, Cloud, CloudOff } from 'lucide-react';
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
          size="icon" 
          className="h-6 w-6"
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
  const { isOnline, syncState } = useNetworkStatus();

  if (isOnline && syncState.status !== 'error') return null;

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium",
        !isOnline 
          ? "bg-amber-900/90 text-amber-100" 
          : "bg-red-900/90 text-red-100"
      )}
      data-testid="offline-banner"
    >
      <div className="flex items-center justify-center gap-2">
        {!isOnline ? (
          <>
            <CloudOff className="w-4 h-4" />
            <span>You're offline. Changes will sync when connection returns.</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Sync error: {syncState.error}. Tap to retry.</span>
          </>
        )}
      </div>
    </div>
  );
}
