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

      const res = await apiRequest("POST", api.farmSettings.save.path, data);
      const saved = await res.json();
      
      await putManyInStore(STORE_NAME, [saved]);
      
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.farmSettings.get.path] });
      toast({
        title: "Farm settings saved",
        description: "Your farm details have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
