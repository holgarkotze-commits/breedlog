import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { applyPendingPwaUpdate, subscribeToRuntimeUpdates } from "@/lib/runtime-updates";
import { RefreshCw } from "lucide-react";

export function AppUpdateBanner() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToRuntimeUpdates((state) => {
      setWaiting(state.waiting);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-amber-600/30 bg-amber-50 text-amber-950 dark:bg-amber-950/70 dark:text-amber-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <p>A BreedLog update is ready. Apply it when you are finished with the current edit to refresh safely.</p>
        <Button size="sm" variant="outline" onClick={() => applyPendingPwaUpdate()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Update now
        </Button>
      </div>
    </div>
  );
}
