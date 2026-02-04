import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MatingGroup, InsertMatingGroup } from "@shared/schema";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { 
  getAllFromStore, 
  putManyInStore, 
  putInStore, 
  deleteFromStore,
  addToSyncQueue 
} from "@/lib/indexeddb";

export function useMatingGroups() {
  const { isOnline } = useNetworkStatus();

  return useQuery<MatingGroup[]>({
    queryKey: ["/api/mating-groups"],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useMatingGroups] Offline - fetching from IndexedDB');
        return await getAllFromStore<MatingGroup>('matingGroups');
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/mating-groups", { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch mating groups");
      const data = await res.json();
      
      if (data.length > 0) {
        await putManyInStore('matingGroups', data);
      }
      
      return data;
    },
  });
}

export function useCreateMatingGroup() {
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async (data: InsertMatingGroup) => {
      const tempId = -Date.now();
      const tempRecord = { ...data, id: tempId } as MatingGroup;

      await putInStore('matingGroups', tempRecord);

      if (!isOnline) {
        console.log('[useCreateMatingGroup] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'matingGroups',
          action: 'create',
          data: data,
          tempId: tempId,
        });
        return tempRecord;
      }

      const res = await apiRequest("POST", "/api/mating-groups", data);
      const created = await res.json();
      
      await putInStore('matingGroups', created);
      
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mating-groups"] });
    },
  });
}

export function useUpdateMatingGroup() {
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertMatingGroup> }) => {
      const existing = await getAllFromStore<MatingGroup>('matingGroups');
      const current = existing.find(g => g.id === id);
      
      if (!current && !isOnline) {
        throw new Error('Cannot update: record not found in offline cache');
      }
      
      const updated = { ...(current || {}), ...data, id } as MatingGroup;
      
      await putInStore('matingGroups', updated);

      if (!isOnline) {
        console.log('[useUpdateMatingGroup] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'matingGroups',
          action: 'update',
          data: updated,
          tempId: id < 0 ? id : undefined,
        });
        return updated;
      }

      const res = await apiRequest("PATCH", `/api/mating-groups/${id}`, data);
      const serverUpdated = await res.json();
      
      await putInStore('matingGroups', serverUpdated);
      
      return serverUpdated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mating-groups"] });
    },
  });
}

export function useDeleteMatingGroup() {
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async (id: number) => {
      await deleteFromStore('matingGroups', id);

      if (!isOnline) {
        console.log('[useDeleteMatingGroup] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'matingGroups',
          action: 'delete',
          data: { id },
        });
        return;
      }

      await apiRequest("DELETE", `/api/mating-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mating-groups"] });
    },
  });
}
