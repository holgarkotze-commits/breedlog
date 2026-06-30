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
  // Treat all iPhone/iPad/iPod as iOS regardless of browser — Chrome/Firefox on iOS
  // still need Safari to install a PWA, so all get the iOS (Safari) guidance.
  const isIOS = /iphone|ipad|ipod/.test(ua);
  if (isIOS) return "ios";
  const isAndroid = /android/.test(ua);
  if (isAndroid) return "android";
  // Only classify as desktop when the UA is not a mobile/tablet browser.
  const isMobileUA = /mobile|tablet/.test(ua);
  const isEdge = /edg\//.test(ua);
  if (isEdge && !isMobileUA) return "desktop-edge";
  const isChrome = /chrome/.test(ua) && !isEdge;
  if (isChrome && !isMobileUA) return "desktop-chrome";
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
  const { isInstallable, promptInstall } = usePWAInstall();
  const platform = detectPlatform();

  const handleInstall = async () => {
    if (isInstallable) {
      const ok = await promptInstall();
      if (ok) return;
    }
  };

  const isCurrentPlatform = (p: string) =>
    platform === p || (p === "desktop" && (platform === "desktop-chrome" || platform === "desktop-edge"));

  const sectionClass = (p: string) =>
    cn(
      "rounded-lg border p-4 space-y-2.5",
      isCurrentPlatform(p)
        ? "border-primary/40 bg-primary/5"
        : "border-border bg-muted/20"
    );

  const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="font-bold text-primary shrink-0 w-5">{n}.</span>
      <span>{children}</span>
    </li>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Download className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Install BreedLog First</CardTitle>
          <CardDescription className="text-sm mt-1">
            Install BreedLog as an app before entering your access code — it works fully offline in the field.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">

          {/* iPhone / iPad */}
          <div className={sectionClass("ios")} data-testid="install-instructions-ios">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" /> iPhone / iPad (Safari)
              {isCurrentPlatform("ios") && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Your device</span>}
            </p>
            <ol className="space-y-1.5">
              <Step n={1}>Open BreedLog in <strong>Safari</strong> (not Chrome)</Step>
              <Step n={2}>Tap the <Share className="inline h-4 w-4 mx-0.5 align-text-bottom text-primary" /> <strong>Share</strong> button at the bottom of the screen</Step>
              <Step n={3}>Tap <strong>"Add to Home Screen"</strong></Step>
              <Step n={4}>Tap <strong>"Add"</strong> in the top right</Step>
              <Step n={5}>Open BreedLog from your home screen</Step>
            </ol>
          </div>

          {/* Android */}
          <div className={sectionClass("android")} data-testid="install-instructions-android">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" /> Android Phone (Chrome)
              {isCurrentPlatform("android") && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Your device</span>}
            </p>
            {isCurrentPlatform("android") && isInstallable ? (
              <Button className="w-full" size="sm" onClick={handleInstall} data-testid="button-install-pwa-android">
                <Download className="mr-2 h-4 w-4" /> Install BreedLog
              </Button>
            ) : (
              <ol className="space-y-1.5">
                <Step n={1}>Open BreedLog in <strong>Chrome</strong></Step>
                <Step n={2}>Tap the <strong>three-dot menu ⋮</strong> in the top right</Step>
                <Step n={3}>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></Step>
                <Step n={4}>Tap <strong>"Install"</strong> or <strong>"Add"</strong></Step>
                <Step n={5}>Open BreedLog from your home screen</Step>
              </ol>
            )}
          </div>

          {/* Desktop */}
          <div className={sectionClass("desktop")} data-testid="install-instructions-desktop">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" /> Desktop (Chrome or Edge)
              {isCurrentPlatform("desktop") && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Your device</span>}
            </p>
            {isCurrentPlatform("desktop") && isInstallable ? (
              <>
                <Button className="w-full" size="sm" onClick={handleInstall} data-testid="button-install-pwa-desktop">
                  <Download className="mr-2 h-4 w-4" /> Install BreedLog App
                </Button>
                <p className="text-xs text-muted-foreground text-center">or use the steps below</p>
              </>
            ) : null}
            <ol className="space-y-1.5">
              <Step n={1}>Open BreedLog in <strong>Chrome</strong> or <strong>Edge</strong></Step>
              <Step n={2}>Look for the <strong>install icon</strong> <Monitor className="inline h-3.5 w-3.5 mx-0.5 align-text-bottom" /> in the address bar — <strong>top-right of your browser</strong></Step>
              <Step n={3}>Click it and select <strong>"Install"</strong></Step>
              <Step n={4}>BreedLog opens as its own app window</Step>
            </ol>

            {/* Animated pointer — only shown on desktop */}
            {isCurrentPlatform("desktop") && (
              <div className="relative mt-1 rounded-lg bg-primary/8 border border-primary/20 px-3 py-2.5 overflow-hidden">
                <style>{`
                  @keyframes bl-pulse-ring {
                    0%   { transform: scale(1);   opacity: 0.7; }
                    50%  { transform: scale(1.55); opacity: 0; }
                    100% { transform: scale(1);   opacity: 0; }
                  }
                  @keyframes bl-bounce-arrow {
                    0%, 100% { transform: translate(0, 0);   }
                    40%      { transform: translate(6px, -6px); }
                    60%      { transform: translate(4px, -4px); }
                  }
                  @keyframes bl-flicker {
                    0%, 100% { opacity: 1; }
                    45%      { opacity: 1; }
                    50%      { opacity: 0.4; }
                    55%      { opacity: 1; }
                    80%      { opacity: 1; }
                    85%      { opacity: 0.6; }
                    90%      { opacity: 1; }
                  }
                  .bl-pulse-ring {
                    animation: bl-pulse-ring 1.6s ease-out infinite;
                  }
                  .bl-bounce-arrow {
                    animation: bl-bounce-arrow 1.6s ease-in-out infinite;
                  }
                  .bl-flicker {
                    animation: bl-flicker 2.4s ease-in-out infinite;
                  }
                `}</style>

                <div className="flex items-center gap-3">
                  {/* Animated glow + arrow icon */}
                  <div className="relative shrink-0 flex items-center justify-center w-10 h-10">
                    {/* Pulse rings */}
                    <div className="bl-pulse-ring absolute inset-0 rounded-full border-2 border-primary/60" />
                    <div className="bl-pulse-ring absolute inset-0 rounded-full border-2 border-primary/40" style={{ animationDelay: "0.4s" }} />
                    {/* Glowing background */}
                    <div className="bl-flicker absolute inset-0 rounded-full bg-primary/20 blur-sm" />
                    {/* Bouncing arrow */}
                    <div className="bl-bounce-arrow relative z-10">
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path
                          d="M5 17L17 5M17 5H8M17 5V14"
                          stroke="hsl(var(--primary))"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                  {/* Label */}
                  <div>
                    <p className="bl-flicker text-xs font-bold text-primary leading-tight">Look top-right of your browser</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">The install icon <Monitor className="inline h-3 w-3 mx-0.5 align-text-bottom" /> glows in your address bar</p>
                  </div>
                </div>
              </div>
            )}
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

  // Decide if we should show the install-first screen.
  // Check matchMedia directly (synchronous) to avoid the race condition where
  // isLoading → false before isInstalled → true, causing the install screen to
  // flash even when the app is already running as a standalone PWA.
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isInstalled || isStandalone) {
      setShowInstallFirst(false);
      return;
    }
    if (!hasSkippedInstall() && !isLoading) {
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
