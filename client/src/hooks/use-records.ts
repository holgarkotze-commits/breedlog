import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertPerformanceRecord, type InsertHealthRecord, type PerformanceRecord, type HealthRecord } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { 
  getAllFromStore, 
  putManyInStore, 
  putInStore, 
  addToSyncQueue,
  getPendingSyncItems
} from "@/lib/indexeddb";

const STORE_NAME = 'performanceRecords';

export function usePerformanceRecords(animalId: number) {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: [api.records.performance.list.path, animalId],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[usePerformanceRecords] Offline - fetching from IndexedDB');
        const allRecords = await getAllFromStore<PerformanceRecord>(STORE_NAME);
        return allRecords.filter(r => r.animalId === animalId);
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = buildUrl(api.records.performance.list.path, { id: animalId });
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch records");
      const data = api.records.performance.list.responses[200].parse(await res.json());
      
      if (data.length > 0) {
        await putManyInStore(STORE_NAME, data);
      }
      
      return data;
    },
    enabled: !!animalId,
  });
}

export function useCreatePerformanceRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async (data: InsertPerformanceRecord) => {
      const tempId = -Date.now();
      const tempRecord = { ...data, id: tempId, createdAt: new Date().toISOString() } as unknown as PerformanceRecord;

      await putInStore(STORE_NAME, tempRecord);

      if (!isOnline) {
        console.log('[useCreatePerformanceRecord] Offline - queuing for sync');
        await addToSyncQueue({
          entity: STORE_NAME,
          action: 'create',
          data: data,
          tempId: tempId,
        });
        return tempRecord;
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(api.records.performance.create.path, {
        method: api.records.performance.create.method,
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add record");
      const created = api.records.performance.create.responses[201].parse(await res.json());
      
      await putInStore(STORE_NAME, created);
      
      return created;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.records.performance.list.path, variables.animalId] });
      toast({ title: "Success", description: "Weight record added" });
    },
  });
}

export function useHealthRecords(animalId: number) {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: [api.records.health.list.path, animalId],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useHealthRecords] Offline - fetching from IndexedDB');
        const allRecords = await getAllFromStore<HealthRecord>('healthRecords');
        return allRecords.filter(r => r.animalId === animalId);
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const url = buildUrl(api.records.health.list.path, { id: animalId });
      const res = await fetch(url, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch health records");
      const data = api.records.health.list.responses[200].parse(await res.json());
      
      if (data.length > 0) {
        await putManyInStore('healthRecords', data);
      }

      // Apply any pending offline updates on top of server data so the
      // Health page shows edited values before the sync queue drains.
      const pendingItems = await getPendingSyncItems();
      const pendingUpdates = pendingItems
        .filter(item => item.entity === 'healthRecords' && item.action === 'update')
        .sort((a, b) => a.timestamp - b.timestamp)
        .reduce<Record<number, Partial<HealthRecord>>>((acc, item) => {
          const patch = item.data as { id?: number } & Partial<HealthRecord>;
          if (patch.id != null) {
            acc[patch.id] = { ...(acc[patch.id] ?? {}), ...patch };
          }
          return acc;
        }, {});

      const updateCount = Object.keys(pendingUpdates).length;
      if (updateCount > 0) {
        console.log(`[useHealthRecords] Applying ${updateCount} pending offline update(s) to health records`);
      }

      const patchedData = updateCount > 0
        ? data.map(r => pendingUpdates[r.id] ? { ...r, ...pendingUpdates[r.id] } : r)
        : data;

      return patchedData;
    },
    enabled: !!animalId,
  });
}

export function useCreateHealthRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async (data: InsertHealthRecord) => {
      const tempId = -Date.now();
      const tempRecord = { ...data, id: tempId, createdAt: new Date().toISOString() } as unknown as HealthRecord;

      await putInStore('healthRecords', tempRecord);

      if (!isOnline) {
        console.log('[useCreateHealthRecord] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'healthRecords',
          action: 'create',
          data: data,
          tempId: tempId,
        });
        return tempRecord;
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(api.records.health.create.path, {
        method: api.records.health.create.method,
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add record");
      const created = api.records.health.create.responses[201].parse(await res.json());
      
      await putInStore('healthRecords', created);
      
      return created;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.records.health.list.path, variables.animalId] });
      toast({ title: "Success", description: "Health record added" });
    },
  });
}
