import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FlockHealthEvent, InsertFlockHealthEvent, FlockHealthTreatment } from "@shared/schema";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { getAllFromStore, putManyInStore, putInStore, addToSyncQueue, getPendingSyncItems } from "@/lib/indexeddb";

export type FlockHealthEventWithTreatments = FlockHealthEvent & {
  treatments?: FlockHealthTreatment[];
};

export function useFlockHealthEvents() {
  const { isOnline } = useNetworkStatus();

  return useQuery<FlockHealthEvent[]>({
    queryKey: ["/api/flock-health-events"],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useFlockHealthEvents] Offline - fetching from IndexedDB');
        return await getAllFromStore<FlockHealthEvent>('flockHealthEvents');
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/flock-health-events", { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch flock health events");
      const serverData: FlockHealthEvent[] = await res.json();
      
      if (serverData.length > 0) {
        await putManyInStore('flockHealthEvents', serverData);
      }

      // Merge any pending offline creates not yet synced to the server.
      // This ensures follow-up alerts generated from this data include records
      // the farmer created while offline that haven't reached the server yet.
      const pendingItems = await getPendingSyncItems();
      const pendingHealthEvents = pendingItems
        .filter(item => item.entity === 'flockHealthEvents' && item.action === 'create')
        .map(item => ({
          ...(item.data as object),
          id: item.tempId ?? -(item.timestamp),
          createdAt: new Date(item.timestamp).toISOString(),
        } as unknown as FlockHealthEvent));

      // Deduplicate: filter out pending items whose eventName+eventDate already appear
      // in the server response. This prevents duplicates during the race window between
      // the sync manager writing the record to the server and marking the queue item
      // as synced (synced=1) / removing it from the queue.
      const serverEventKeys = new Set(
        serverData.map(e => `${e.eventName}::${e.eventDate}`)
      );
      const uniquePendingHealthEvents = pendingHealthEvents.filter(
        e => !serverEventKeys.has(`${e.eventName}::${e.eventDate}`)
      );

      if (uniquePendingHealthEvents.length > 0) {
        console.log(`[useFlockHealthEvents] Merging ${uniquePendingHealthEvents.length} pending offline health event(s) into results`);
      }
      if (pendingHealthEvents.length > uniquePendingHealthEvents.length) {
        console.log(`[useFlockHealthEvents] Deduplicated ${pendingHealthEvents.length - uniquePendingHealthEvents.length} pending item(s) already present in server response`);
      }

      return [...serverData, ...uniquePendingHealthEvents];
    },
  });
}

export function useFlockHealthEvent(id: number) {
  const { isOnline } = useNetworkStatus();

  return useQuery<FlockHealthEventWithTreatments>({
    queryKey: ["/api/flock-health-events", id],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useFlockHealthEvent] Offline - fetching from IndexedDB');
        const events = await getAllFromStore<FlockHealthEvent>('flockHealthEvents');
        const event = events.find(e => e.id === id);
        if (!event) throw new Error("Event not found offline");
        return event as FlockHealthEventWithTreatments;
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/flock-health-events/${id}`, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch flock health event");
      const data = await res.json();
      await putInStore('flockHealthEvents', data);
      return data;
    },
    enabled: !!id,
  });
}

export interface CreateFlockHealthEventInput {
  eventType?: string;
  eventName: string;
  eventDate: string;
  productName: string;
  route: string;
  dose?: string;
  nextFollowUpDate?: string;
  withdrawalPeriodNotes?: string;
  treatAllAnimals?: boolean;
  notes?: string;
  treatments: {
    animalId: number;
    quantity?: string;
    route?: string;
    notes?: string;
  }[];
}

export function useCreateFlockHealthEvent() {
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async (data: CreateFlockHealthEventInput) => {
      const tempId = -Date.now();
      const tempRecord = { 
        ...data, 
        id: tempId,
        createdAt: new Date().toISOString(),
      } as unknown as FlockHealthEvent;

      await putInStore('flockHealthEvents', tempRecord);

      if (!isOnline) {
        console.log('[useCreateFlockHealthEvent] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'flockHealthEvents',
          action: 'create',
          data: data,
          tempId: tempId,
        });
        return tempRecord;
      }

      const res = await apiRequest("POST", "/api/flock-health-events", data);
      const created = await res.json();
      await putInStore('flockHealthEvents', created);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flock-health-events"] });
    },
  });
}
