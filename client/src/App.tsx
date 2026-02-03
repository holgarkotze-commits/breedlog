import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { OfflineBanner } from "@/components/NetworkStatusIndicator";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { BetaAccessGate } from "@/components/BetaAccessGate";
import { useState, useEffect, lazy, Suspense } from "react";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";

// Lazy load less frequently used pages for faster initial load
const Animals = lazy(() => import("@/pages/Animals"));
const AnimalDetail = lazy(() => import("@/pages/AnimalDetail"));
const Breeding = lazy(() => import("@/pages/Breeding"));
const MatingGroupDetail = lazy(() => import("@/pages/MatingGroupDetail"));
const BreedingEventDetail = lazy(() => import("@/pages/BreedingEventDetail"));
const Health = lazy(() => import("@/pages/Health"));
const HealthEventDetail = lazy(() => import("@/pages/HealthEventDetail"));
const Settings = lazy(() => import("@/pages/Settings"));
const Lambs = lazy(() => import("@/pages/Lambs"));
const Records = lazy(() => import("@/pages/Records"));
const Admin = lazy(() => import("@/pages/Admin"));

// Loading fallback for lazy loaded pages
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/animals" component={Animals} />
        <Route path="/animals/:id" component={AnimalDetail} />
        <Route path="/lambs" component={Lambs} />
        <Route path="/breeding" component={Breeding} />
        <Route path="/breeding/groups/:id" component={MatingGroupDetail} />
        <Route path="/breeding/events/:id" component={BreedingEventDetail} />
        <Route path="/health" component={Health} />
        <Route path="/health/:id" component={HealthEventDetail} />
        <Route path="/records" component={Records} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AuthenticatedApp() {
  return (
    <>
      <OfflineBanner />
      <PWAInstallPrompt />
      <Router />
    </>
  );
}

// Version stored locally to check against server
const LOCAL_VERSION_KEY = "breedlog_app_version";

async function checkAndReloadIfVersionMismatch() {
  try {
    const response = await fetch("/api/version", { 
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" }
    });
    if (response.ok) {
      const { version } = await response.json();
      const localVersion = localStorage.getItem(LOCAL_VERSION_KEY);
      
      if (localVersion && localVersion !== version) {
        console.log(`[Version] Mismatch detected: local=${localVersion}, server=${version}. Reloading...`);
        localStorage.setItem(LOCAL_VERSION_KEY, version);
        // Force reload to get fresh assets
        window.location.reload();
        return true;
      }
      
      // Store current version
      localStorage.setItem(LOCAL_VERSION_KEY, version);
    }
  } catch (err) {
    console.log("[Version] Check failed, continuing...", err);
  }
  return false;
}

function AppContent() {
  const { user, isLoading: authLoading, deviceId } = useAuth();
  const [location] = useLocation();
  const [versionChecked, setVersionChecked] = useState(false);
  
  // Check version on startup
  useEffect(() => {
    checkAndReloadIfVersionMismatch().then(reloading => {
      if (!reloading) {
        setVersionChecked(true);
      }
    });
  }, []);
  
  if (!versionChecked || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing BreedLog...</p>
        </div>
      </div>
    );
  }
  
  // Admin route bypasses beta access gate (protected by PIN instead)
  if (location === "/admin") {
    return (
      <Suspense fallback={<PageLoader />}>
        <Admin />
      </Suspense>
    );
  }
  
  // Device is auto-registered, now check beta access
  return (
    <BetaAccessGate deviceId={deviceId}>
      <AuthenticatedApp />
    </BetaAccessGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
