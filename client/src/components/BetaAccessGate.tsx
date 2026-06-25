import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Lock, Shield, WifiOff, Loader2, RefreshCw, Download, Smartphone, Monitor, Share, Plus, ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { apiRequest, setDeviceToken, getDeviceToken } from "@/lib/queryClient";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { cn } from "@/lib/utils";

interface AccessStatus {
  hasAccess: boolean;
  reason?: string;
  needsCode?: boolean;
  offlineGraceExpired?: boolean;
  expiresAt?: string;
}

const OFFLINE_GRACE_DAYS = 7;
const LOCAL_STORAGE_KEY = "breedlog_beta_access";
const SAVED_CODE_KEY = "breedlog_saved_code";
const INSTALL_SKIPPED_KEY = "breedlog_install_skipped";

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

function getSavedCode(): string {
  try {
    return localStorage.getItem(SAVED_CODE_KEY) || "";
  } catch {
    return "";
  }
}

function saveCode(code: string): void {
  try {
    localStorage.setItem(SAVED_CODE_KEY, code);
  } catch {}
}

function clearSavedCode(): void {
  try {
    localStorage.removeItem(SAVED_CODE_KEY);
  } catch {}
}

function hasSkippedInstall(): boolean {
  try {
    const ts = localStorage.getItem(INSTALL_SKIPPED_KEY);
    if (!ts) return false;
    // Reset skip after 24h so we remind them again
    const skippedAt = parseInt(ts, 10);
    return Date.now() - skippedAt < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markInstallSkipped(): void {
  try {
    localStorage.setItem(INSTALL_SKIPPED_KEY, Date.now().toString());
  } catch {}
}

// Platform detection
function detectPlatform(): "ios" | "android" | "desktop-chrome" | "desktop-edge" | "other" {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) && /webkit/.test(ua) && !/crios|fxios/.test(ua);
  if (isIOS) return "ios";
  const isAndroid = /android/.test(ua);
  if (isAndroid) return "android";
  const isEdge = /edg\//.test(ua);
  if (isEdge) return "desktop-edge";
  const isChrome = /chrome/.test(ua) && !isEdge;
  if (isChrome) return "desktop-chrome";
  return "other";
}

function isMobilePlatform(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android/.test(ua);
}

// ============================================================
// Install-first screen component
// ============================================================
function InstallFirstScreen({ onSkip }: { onSkip: () => void }) {
  const { isInstallable, isIOS, promptInstall } = usePWAInstall();
  const platform = detectPlatform();
  const isMobile = isMobilePlatform();

  const handleInstall = async () => {
    if (isInstallable) {
      const ok = await promptInstall();
      if (ok) return; // app will reload in standalone mode
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {isMobile
              ? <Smartphone className="h-8 w-8 text-primary" />
              : <Monitor className="h-8 w-8 text-primary" />
            }
          </div>
          <CardTitle className="text-xl">Install BreedLog First</CardTitle>
          <CardDescription className="text-sm mt-1">
            For the best experience — especially offline in the field — install BreedLog as an app on your device before entering your access code.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* iOS Safari */}
          {platform === "ios" && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3" data-testid="install-instructions-ios">
              <p className="text-sm font-semibold">iPhone / iPad (Safari)</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary shrink-0">1.</span>
                  <span>Tap the <Share className="inline h-4 w-4 mx-0.5 text-primary" /> <strong>Share</strong> button at the bottom of Safari</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary shrink-0">2.</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <Plus className="inline h-3.5 w-3.5 mx-0.5" /></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary shrink-0">3.</span>
                  <span>Tap <strong>"Add"</strong> — then open BreedLog from your home screen</span>
                </li>
              </ol>
              <Alert className="py-2">
                <AlertDescription className="text-xs">
                  On iPhone, you must use <strong>Safari</strong>. Chrome on iPhone does not support Add to Home Screen.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Android */}
          {platform === "android" && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3" data-testid="install-instructions-android">
              <p className="text-sm font-semibold">Android Phone (Chrome)</p>
              {isInstallable ? (
                <>
                  <p className="text-sm text-muted-foreground">Tap the button below to install BreedLog directly.</p>
                  <Button className="w-full" onClick={handleInstall} data-testid="button-install-pwa-android">
                    <Download className="mr-2 h-4 w-4" />
                    Install BreedLog
                  </Button>
                </>
              ) : (
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">1.</span>
                    <span>Tap the <strong>three-dot menu</strong> (⋮) in Chrome</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">2.</span>
                    <span>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">3.</span>
                    <span>Tap <strong>"Install"</strong> — then open BreedLog from your home screen</span>
                  </li>
                </ol>
              )}
            </div>
          )}

          {/* Desktop Chrome/Edge */}
          {(platform === "desktop-chrome" || platform === "desktop-edge") && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3" data-testid="install-instructions-desktop">
              <p className="text-sm font-semibold">
                Desktop {platform === "desktop-edge" ? "Edge" : "Chrome"}
              </p>
              {isInstallable ? (
                <>
                  <p className="text-sm text-muted-foreground">Click the button below to install BreedLog as a desktop app.</p>
                  <Button className="w-full" onClick={handleInstall} data-testid="button-install-pwa-desktop">
                    <Download className="mr-2 h-4 w-4" />
                    Install BreedLog App
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Or look for the <Monitor className="inline h-3.5 w-3.5 mx-0.5" /> install icon in your browser address bar
                  </p>
                </>
              ) : (
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">1.</span>
                    <span>Look for the <strong>install icon</strong> <Monitor className="inline h-3.5 w-3.5 mx-0.5" /> in the browser address bar (top right)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">2.</span>
                    <span>Click it and select <strong>"Install"</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">3.</span>
                    <span>BreedLog opens as a standalone app — use it from there</span>
                  </li>
                </ol>
              )}
            </div>
          )}

          {/* Other browser */}
          {platform === "other" && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3" data-testid="install-instructions-other">
              <p className="text-sm font-semibold">Install BreedLog</p>
              <p className="text-sm text-muted-foreground">
                For the best experience, open BreedLog in <strong>Chrome</strong> or <strong>Edge</strong> on desktop, or <strong>Safari</strong> on iPhone/iPad, and use the install option in the browser menu.
              </p>
            </div>
          )}

          {/* Why install */}
          <div className="rounded-lg bg-primary/5 border border-primary/15 p-3">
            <p className="text-xs font-semibold text-primary mb-1.5">Why install?</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Works fully offline — record data without internet</li>
              <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Opens instantly from home screen or dock</li>
              <li className="flex items-center gap-1.5"><span className="text-primary">✓</span> Syncs automatically when you reconnect</li>
            </ul>
          </div>

          <button
            onClick={() => { markInstallSkipped(); onSkip(); }}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1"
            data-testid="button-skip-install"
          >
            Skip — continue in browser
            <ChevronRight className="h-3 w-3" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// useBetaAccess hook
// ============================================================
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
      return { hasAccess: false, offlineGraceExpired: true, reason: "Offline grace period expired. Please connect to the internet." };
    }
    return { hasAccess: true };
  };

  const serverReachable = !!accessStatus && !error;

  useEffect(() => {
    if (accessStatus?.hasAccess && serverReachable) {
      storeAccess(accessStatus.expiresAt);
    }
  }, [accessStatus, serverReachable]);

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
    isLoading,
    isOnline: isOnline || serverReachable,
    refetch,
    queryClient
  };
}

// ============================================================
// BetaAccessGate main component
// ============================================================
interface BetaAccessGateProps {
  children: React.ReactNode;
  deviceId: string;
}

export function BetaAccessGate({ children, deviceId }: BetaAccessGateProps) {
  const queryClient = useQueryClient();
  const { hasAccess, needsCode, reason, offlineGraceExpired, isLoading, isOnline, refetch } = useBetaAccess(deviceId);
  const { isInstalled } = usePWAInstall();

  const savedCode = getSavedCode();
  const [code, setCode] = useState(savedCode);
  const [rememberCode, setRememberCode] = useState(!!savedCode);
  const [errorMessage, setErrorMessage] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [showInstallFirst, setShowInstallFirst] = useState(false);

  // Decide if we should show the install-first screen
  useEffect(() => {
    if (!isInstalled && !hasSkippedInstall() && !isLoading) {
      setShowInstallFirst(true);
    }
  }, [isInstalled, isLoading]);

  useEffect(() => {
    setErrorMessage("");
  }, []);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    setErrorMessage("");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch("/api/version", { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      if (response.ok) {
        const result = await refetch();
        if (result.data?.hasAccess) {
          storeAccess(result.data.expiresAt);
        }
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
      const response = await apiRequest("POST", "/api/beta/validate", { code: inputCode, deviceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        if (data.token) {
          setDeviceToken(data.token);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/beta/access"] });
        queryClient.invalidateQueries({ queryKey: ["/api/device/info"] });
        storeAccess(data.expiresAt);
        if (rememberCode) {
          saveCode(code.trim().toUpperCase());
        } else {
          clearSavedCode();
        }
        setErrorMessage("");
      }
    },
    onError: (err: Error) => {
      let message = err.message || "Invalid access code";
      if (message.includes('{"message":')) {
        try {
          const jsonStart = message.indexOf('{');
          const json = JSON.parse(message.substring(jsonStart));
          message = json.message || message;
        } catch {}
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

  // Loading state
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

  // Has access — render the app
  if (hasAccess) {
    return <>{children}</>;
  }

  // Offline grace period expired
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
            <Button onClick={handleRetryConnection} className="w-full" disabled={isRetrying} data-testid="button-retry-connection">
              {isRetrying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking Connection...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" />Retry Connection</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show install-first screen if running in browser (not installed) and not yet skipped
  if (showInstallFirst) {
    return <InstallFirstScreen onSkip={() => setShowInstallFirst(false)} />;
  }

  // Access code entry screen
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
            <div className="space-y-1.5">
              <Input
                type="text"
                placeholder="Enter your access code"
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setErrorMessage(""); }}
                className="text-center text-lg tracking-widest font-mono"
                maxLength={16}
                data-testid="input-access-code"
                autoComplete="off"
                autoFocus={!savedCode}
              />
              {savedCode && code === savedCode && (
                <p className="text-xs text-center text-muted-foreground">
                  Saved code pre-filled.{" "}
                  <button
                    type="button"
                    className="underline hover:text-foreground transition-colors"
                    onClick={() => { clearSavedCode(); setCode(""); setRememberCode(false); }}
                  >
                    Clear
                  </button>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-code"
                checked={rememberCode}
                onCheckedChange={(v) => setRememberCode(!!v)}
                data-testid="checkbox-remember-code"
              />
              <Label htmlFor="remember-code" className="text-sm text-muted-foreground cursor-pointer select-none">
                Remember my access code on this device
              </Label>
            </div>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={!code.trim() || validateMutation.isPending} data-testid="button-validate-code">
              {validateMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" />Activate Access</>
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
