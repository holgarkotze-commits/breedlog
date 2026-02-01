import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Shield, WifiOff, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AccessStatus {
  hasAccess: boolean;
  reason?: string;
  needsCode?: boolean;
  offlineGraceExpired?: boolean;
  expiresAt?: string;
}

const OFFLINE_GRACE_DAYS = 7;
const LOCAL_STORAGE_KEY_PREFIX = "breedlog_beta_access_";

function getStorageKey(userId: string): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
}

export function clearBetaAccessStorage(): void {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

export function useBetaAccess(userId?: string) {
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
  
  const { data: accessStatus, isLoading, error, refetch } = useQuery<AccessStatus>({
    queryKey: ["/api/beta/access"],
    enabled: isOnline && !!userId,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  
  const getOfflineAccess = (): AccessStatus => {
    if (!userId) return { hasAccess: false, needsCode: true };
    
    try {
      const stored = localStorage.getItem(getStorageKey(userId));
      if (!stored) return { hasAccess: false, needsCode: true };
      
      const data = JSON.parse(stored);
      const lastCheck = new Date(data.lastCheck);
      const gracePeriod = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
      
      if (Date.now() - lastCheck.getTime() > gracePeriod) {
        return { 
          hasAccess: false, 
          offlineGraceExpired: true,
          reason: "Offline grace period expired. Please connect to the internet."
        };
      }
      
      return { hasAccess: true };
    } catch {
      return { hasAccess: false, needsCode: true };
    }
  };
  
  useEffect(() => {
    if (accessStatus?.hasAccess && isOnline && userId) {
      localStorage.setItem(getStorageKey(userId), JSON.stringify({
        hasAccess: true,
        lastCheck: new Date().toISOString(),
        expiresAt: accessStatus.expiresAt
      }));
    }
  }, [accessStatus, isOnline, userId]);
  
  const effectiveStatus = isOnline 
    ? (accessStatus || { hasAccess: false, needsCode: true })
    : getOfflineAccess();
  
  return {
    hasAccess: effectiveStatus.hasAccess,
    needsCode: effectiveStatus.needsCode,
    reason: effectiveStatus.reason,
    offlineGraceExpired: effectiveStatus.offlineGraceExpired,
    isLoading: isOnline && isLoading,
    isOnline,
    refetch,
    queryClient
  };
}

interface BetaAccessGateProps {
  children: React.ReactNode;
  userId: string;
}

export function BetaAccessGate({ children, userId }: BetaAccessGateProps) {
  const queryClient = useQueryClient();
  const { hasAccess, needsCode, reason, offlineGraceExpired, isLoading, isOnline, refetch } = useBetaAccess(userId);
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
  const validateMutation = useMutation({
    mutationFn: async (inputCode: string) => {
      const response = await apiRequest("POST", "/api/beta/validate", { code: inputCode });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/beta/access"] });
        localStorage.setItem(getStorageKey(userId), JSON.stringify({
          hasAccess: true,
          lastCheck: new Date().toISOString(),
          expiresAt: data.expiresAt
        }));
        setErrorMessage("");
      }
    },
    onError: (err: Error) => {
      setErrorMessage(err.message || "Invalid access code");
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
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <WifiOff className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Offline Grace Period Expired</CardTitle>
            <CardDescription>
              Please connect to the internet to continue using BreedLog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Your offline access period has ended. Connect to verify your beta access.
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              onClick={() => refetch()}
              disabled={!isOnline}
              data-testid="button-retry-connection"
            >
              {isOnline ? "Check Access" : "Waiting for connection..."}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!needsCode && reason) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                Beta access expired or revoked. Contact admin for a new access code.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Beta Access Required</CardTitle>
          <CardDescription>
            Enter your invite code to access BreedLog beta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter access code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest uppercase"
                maxLength={8}
                data-testid="input-access-code"
              />
            </div>
            
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
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
                "Activate Access"
              )}
            </Button>
          </form>
          
          {!isOnline && (
            <Alert className="mt-4">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                You're offline. Connect to the internet to validate your code.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
