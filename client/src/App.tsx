import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { useAnimals } from "@/hooks/use-animals";
import { OfflineBanner } from "@/components/NetworkStatusIndicator";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { OnboardingWizard } from "@/components/OnboardingWizard";
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
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
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
