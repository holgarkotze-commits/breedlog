import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useAnimals } from "@/hooks/use-animals";
import { useAuth } from "@/hooks/use-auth";
import { OfflineBanner } from "@/components/NetworkStatusIndicator";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { BetaAccessGate } from "@/components/BetaAccessGate";
import { getOnboardingCompleted } from "@/lib/indexeddb";
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
  const { data: farmSettings, isLoading: farmLoading } = useFarmSettings();
  const { data: animals, isLoading: animalsLoading } = useAnimals();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      if (farmLoading || animalsLoading) return;
      
      const onboardingCompleted = await getOnboardingCompleted();
      
      const hasNoAnimals = !animals || animals.length === 0;
      const isFirstTimeUser = !onboardingCompleted && (!farmSettings || hasNoAnimals);
      
      setShowOnboarding(!!isFirstTimeUser);
      setOnboardingChecked(true);
    }
    
    checkOnboarding();
  }, [farmSettings, farmLoading, animals, animalsLoading]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  if (!onboardingChecked && (farmLoading || animalsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading BreedLog...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <OfflineBanner />
      <PWAInstallPrompt />
      {showOnboarding ? (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      ) : (
        <Router />
      )}
    </>
  );
}

function AppContent() {
  const { user, isLoading: authLoading, deviceId } = useAuth();
  
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing BreedLog...</p>
        </div>
      </div>
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
