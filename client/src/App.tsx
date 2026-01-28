import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFarmSettings } from "@/hooks/use-farm-settings";
import { FarmSetupDialog } from "@/components/FarmSetupDialog";
import { useState, useEffect } from "react";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Animals from "@/pages/Animals";
import AnimalDetail from "@/pages/AnimalDetail";
import Breeding from "@/pages/Breeding";
import Settings from "@/pages/Settings";
import Lambs from "@/pages/Lambs";
import Culled from "@/pages/Culled";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/animals" component={Animals} />
      <Route path="/animals/:id" component={AnimalDetail} />
      <Route path="/lambs" component={Lambs} />
      <Route path="/culled" component={Culled} />
      <Route path="/breeding" component={Breeding} />
      <Route path="/records" component={Animals} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { data: farmSettings, isLoading } = useFarmSettings();
  const [showSetup, setShowSetup] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(false);

  useEffect(() => {
    if (!isLoading && farmSettings === null && !setupCompleted) {
      setShowSetup(true);
    }
  }, [farmSettings, isLoading, setupCompleted]);

  const handleSetupComplete = () => {
    setShowSetup(false);
    setSetupCompleted(true);
  };

  return (
    <>
      <FarmSetupDialog open={showSetup} onComplete={handleSetupComplete} />
      <Router />
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
