import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Animals from "@/pages/Animals";
import AnimalDetail from "@/pages/AnimalDetail";
import Breeding from "@/pages/Breeding";
import AiValuation from "@/pages/AiValuation";
import Settings from "@/pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/animals" component={Animals} />
      <Route path="/animals/:id" component={AnimalDetail} />
      <Route path="/breeding" component={Breeding} />
      {/* Records can route to Animals view with records tab open logic, or separate page. 
          For MVP, Records Link in nav also goes to Animals or a specific hub. 
          Let's make /records reuse Animals page or make a simple placeholder if distinct.
          Actually, let's map /records to Animals for now as it holds the data.
       */}
      <Route path="/records" component={Animals} />
      <Route path="/ai-valuation" component={AiValuation} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
