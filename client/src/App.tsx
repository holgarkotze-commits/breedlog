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
import { useState, useEffect } from "react";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Animals from "@/pages/Animals";
import AnimalDetail from "@/pages/AnimalDetail";
import Breeding from "@/pages/Breeding";
import MatingGroupDetail from "@/pages/MatingGroupDetail";
import BreedingEventDetail from "@/pages/BreedingEventDetail";
import Health from "@/pages/Health";
import HealthEventDetail from "@/pages/HealthEventDetail";
import Settings from "@/pages/Settings";
import Lambs from "@/pages/Lambs";
import Records from "@/pages/Records";
import Admin from "@/pages/Admin";

function Router() {
  return (
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
  const { user, isLoading: authLoading } = useAuth();
  
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-primary mb-4">BreedLog</h1>
          <p className="text-muted-foreground mb-6">
            Livestock management for Meatmaster sheep farmers
          </p>
          <a 
            href="/api/login" 
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            data-testid="button-login"
          >
            Sign in with Replit
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <BetaAccessGate userId={user.id}>
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
