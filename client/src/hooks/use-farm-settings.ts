import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertFarmSettings, type FarmSettings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { 
  getAllFromStore, 
  putManyInStore, 
  addToSyncQueue 
} from "@/lib/indexeddb";

const STORE_NAME = 'farmSettings';

export function useFarmSettings() {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: [api.farmSettings.get.path],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useFarmSettings] Offline - fetching from IndexedDB');
        const cached = await getAllFromStore<FarmSettings>(STORE_NAME);
        return cached.length > 0 ? cached[0] : null;
      }

      const res = await fetch(api.farmSettings.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch farm settings");
      const data = await res.json() as FarmSettings | null;
      
      if (data) {
        await putManyInStore(STORE_NAME, [data]);
      }
      
      return data;
    },
  });
}

export function useSaveFarmSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (data: InsertFarmSettings) => {
      const existingSettings = await getAllFromStore<FarmSettings>(STORE_NAME);
      const existingId = existingSettings.length > 0 ? existingSettings[0].id : 1;
      const settingsWithId = { ...data, id: existingId } as FarmSettings;
      
      // Always save to IndexedDB first for instant local persistence
      await putManyInStore(STORE_NAME, [settingsWithId]);

      if (!isOnline) {
        console.log('[useSaveFarmSettings] Offline - queuing for sync');
        await addToSyncQueue({
          entity: STORE_NAME,
          action: 'update',
          data: settingsWithId,
        });
        return settingsWithId;
      }

      // Try to save to server, but don't fail the whole operation if it fails
      // Data is already in IndexedDB and will sync later
      try {
        const res = await apiRequest("POST", api.farmSettings.save.path, data);
        const saved = await res.json();
        await putManyInStore(STORE_NAME, [saved]);
        return saved;
      } catch (serverError) {
        console.warn('[useSaveFarmSettings] Server save failed, queuing for sync:', serverError);
        // Queue for later sync
        await addToSyncQueue({
          entity: STORE_NAME,
          action: 'update',
          data: settingsWithId,
        });
        // Return local data - it's saved locally and will sync later
        return settingsWithId;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.farmSettings.get.path] });
      toast({
        title: "Farm settings saved",
        description: "Your farm details have been saved.",
      });
    },
    onError: (error: Error) => {
      console.error('[useSaveFarmSettings] Critical error:', error);
      toast({
        title: "Failed to save",
        description: "Could not save settings. Please try again.",
        variant: "destructive",
      });
    },
  });
}
