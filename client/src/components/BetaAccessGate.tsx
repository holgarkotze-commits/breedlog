import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Shield, WifiOff, Loader2, RefreshCw } from "lucide-react";
import { apiRequest, setDeviceToken, getDeviceToken } from "@/lib/queryClient";

interface AccessStatus {
  hasAccess: boolean;
  reason?: string;
  needsCode?: boolean;
  offlineGraceExpired?: boolean;
  expiresAt?: string;
}

const OFFLINE_GRACE_DAYS = 7;
const LOCAL_STORAGE_KEY = "breedlog_beta_access";

export function clearBetaAccessStorage(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

function getStoredAccess(): { hasAccess: boolean; lastCheck: string; expiresAt?: string } | null {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function storeAccess(expiresAt?: string): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
    hasAccess: true,
    lastCheck: new Date().toISOString(),
    expiresAt
  }));
}

export function useBetaAccess(deviceId?: string) {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  
  // Always try the server query - don't gate on navigator.onLine
  // navigator.onLine is unreliable on mobile (reports false even with 4G)
  // If the fetch fails, React Query error handling + offline fallback kicks in
  const { data: accessStatus, isLoading, error, refetch } = useQuery<AccessStatus>({
    queryKey: ["/api/beta/access"],
    enabled: !!deviceId,
    retry: 1,
    retryDelay: 2000,
    staleTime: 1000 * 60 * 5,
  });
  
  const getOfflineAccess = (): AccessStatus => {
    if (!deviceId) return { hasAccess: false, needsCode: true };
    
    const stored = getStoredAccess();
    if (!stored || !stored.hasAccess) return { hasAccess: false, needsCode: true };
    
    const lastCheck = new Date(stored.lastCheck);
    const gracePeriod = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    
    if (Date.now() - lastCheck.getTime() > gracePeriod) {
      return { 
        hasAccess: false, 
        offlineGraceExpired: true,
        reason: "Offline grace period expired. Please connect to the internet."
      };
    }
    
    return { hasAccess: true };
  };
  
  // Determine if we actually got a server response
  const serverReachable = !!accessStatus && !error;
  
  useEffect(() => {
    if (accessStatus?.hasAccess && serverReachable) {
      storeAccess(accessStatus.expiresAt);
    }
  }, [accessStatus, serverReachable]);
  
  // Use server response if available; fall back to offline check only on actual failure
  const effectiveStatus = serverReachable
    ? accessStatus!
    : (error || (!isLoading && !accessStatus))
      ? getOfflineAccess()
      : { hasAccess: false, needsCode: true };
  
  return {
    hasAccess: effectiveStatus.hasAccess,
    needsCode: effectiveStatus.needsCode,
    reason: effectiveStatus.reason,
    offlineGraceExpired: effectiveStatus.offlineGraceExpired,
    isLoading: isLoading,
    isOnline: isOnline || serverReachable,
    refetch,
    queryClient
  };
}

interface BetaAccessGateProps {
  children: React.ReactNode;
  deviceId: string;
}

export function BetaAccessGate({ children, deviceId }: BetaAccessGateProps) {
  const queryClient = useQueryClient();
  const { hasAccess, needsCode, reason, offlineGraceExpired, isLoading, isOnline, refetch } = useBetaAccess(deviceId);
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  
  const handleRetryConnection = async () => {
    setIsRetrying(true);
    setErrorMessage("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch("/api/version", { 
        signal: controller.signal,
        cache: "no-store" 
      });
      clearTimeout(timeout);
      if (response.ok) {
        // Server is reachable - refetch beta access status
        // This will either grant access (if activation exists) or show invite code screen
        const result = await refetch();
        if (result.data?.hasAccess) {
          storeAccess(result.data.expiresAt);
        }
        // Force reload to reset all state cleanly
        window.location.reload();
      } else {
        setErrorMessage("Server responded with an error. Please try again.");
      }
    } catch {
      setErrorMessage("Could not reach the server. Please check your internet connection and try again.");
    } finally {
      setIsRetrying(false);
    }
  };
  
  const validateMutation = useMutation({
    mutationFn: async (inputCode: string) => {
      const response = await apiRequest("POST", "/api/beta/validate", { 
        code: inputCode,
        deviceId 
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        // Store device token for future API requests (more reliable than cookies)
        if (data.token) {
          setDeviceToken(data.token);
          console.log("[BetaAccess] Token stored successfully");
        }
        queryClient.invalidateQueries({ queryKey: ["/api/beta/access"] });
        queryClient.invalidateQueries({ queryKey: ["/api/device/info"] });
        storeAccess(data.expiresAt);
        setErrorMessage("");
      }
    },
    onError: (err: Error) => {
      // Extract user-friendly message from error
      let message = err.message || "Invalid access code";
      // Remove status code prefix if present (e.g., "400: {...")
      if (message.includes('{"message":')) {
        try {
          const jsonStart = message.indexOf('{');
          const json = JSON.parse(message.substring(jsonStart));
          message = json.message || message;
        } catch {
          // Keep original message
        }
      } else if (message.match(/^\d{3}:/)) {
        message = message.replace(/^\d{3}:\s*/, '');
      }
      setErrorMessage(message);
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      validateMutation.mutate(code.trim().toUpperCase());
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (offlineGraceExpired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <WifiOff className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">Connection Required</CardTitle>
            <CardDescription>
              Your offline access period has expired. Please connect to the internet to continue using BreedLog.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                BreedLog works offline for up to {OFFLINE_GRACE_DAYS} days. After that, you need to reconnect to verify your access.
              </AlertDescription>
            </Alert>
            
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            <Button 
              onClick={handleRetryConnection} 
              className="w-full"
              disabled={isRetrying}
              data-testid="button-retry-connection"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Connection...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Connection
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Show access code entry screen
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Enter Access Code</CardTitle>
          <CardDescription>
            BreedLog is currently in beta testing. Enter your invite code to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter your access code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest font-mono"
                maxLength={16}
                data-testid="input-access-code"
                autoComplete="off"
                autoFocus
              />
            </div>
            
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            
            {reason && (
              <Alert>
                <AlertDescription>{reason}</AlertDescription>
              </Alert>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!code.trim() || validateMutation.isPending}
              data-testid="button-validate-code"
            >
              {validateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Activate Access
                </>
              )}
            </Button>
          </form>
          
          <p className="text-xs text-muted-foreground text-center mt-4">
            Don't have a code? Contact the BreedLog team to request beta access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
