import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertBreedingEvent, type InsertMatingGroup, type BreedingEvent, type MatingGroup } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { 
  getAllFromStore, 
  putManyInStore, 
  putInStore, 
  addToSyncQueue,
  getPendingSyncItems
} from "@/lib/indexeddb";

export function useBreedingEvents() {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: [api.breeding.list.path],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useBreedingEvents] Offline - fetching from IndexedDB');
        const cached = await getAllFromStore<BreedingEvent>('breedingEvents');
        return cached;
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(api.breeding.list.path, { credentials: "include", headers });
      if (!res.ok) throw new Error("Failed to fetch breeding events");
      const data = api.breeding.list.responses[200].parse(await res.json());
      
      if (data.length > 0) {
        await putManyInStore('breedingEvents', data);
      }

      // Merge any pending offline creates/updates not yet synced to the server.
      // Creates: append new events so analytics are accurate immediately.
      // Updates: patch existing events so edits (e.g. corrected ram/ewe) are
      //          reflected on the Breeding page before the sync queue drains.
      const pendingItems = await getPendingSyncItems();

      const pendingBreedingEvents = pendingItems
        .filter(item => item.entity === 'breedingEvents' && item.action === 'create')
        .map(item => ({
          ...(item.data as object),
          id: item.tempId ?? -(item.timestamp),
        } as unknown as BreedingEvent));

      if (pendingBreedingEvents.length > 0) {
        console.log(`[useBreedingEvents] Merging ${pendingBreedingEvents.length} pending offline breeding event(s) into results`);
      }

      // Build a patch map from pending updates keyed by record id.
      const pendingBreedingUpdates = pendingItems
        .filter(item => item.entity === 'breedingEvents' && item.action === 'update')
        .reduce<Record<number, Partial<BreedingEvent>>>((acc, item) => {
          const patch = item.data as { id?: number } & Partial<BreedingEvent>;
          if (patch.id != null) {
            acc[patch.id] = { ...(acc[patch.id] ?? {}), ...patch };
          }
          return acc;
        }, {});

      const breedingUpdateCount = Object.keys(pendingBreedingUpdates).length;
      if (breedingUpdateCount > 0) {
        console.log(`[useBreedingEvents] Applying ${breedingUpdateCount} pending offline update(s) to breeding event(s)`);
      }

      const patchedBreedingData = breedingUpdateCount > 0
        ? data.map(evt => pendingBreedingUpdates[evt.id] ? { ...evt, ...pendingBreedingUpdates[evt.id] } : evt)
        : data;

      return [...patchedBreedingData, ...pendingBreedingEvents];
    },
  });
}

export function useAnimalBreedingEvents(animalId: number, sex: string) {
  const { data: allEvents, ...rest } = useBreedingEvents();
  
  const filteredEvents = allEvents?.filter(event => 
    sex === "ewe" ? event.eweId === animalId : event.ramId === animalId
  ) || [];
  
  return { data: filteredEvents, ...rest };
}

export function useCreateBreedingEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async (data: InsertBreedingEvent) => {
      const tempId = -Date.now();
      const tempRecord = { ...data, id: tempId } as BreedingEvent;

      await putInStore('breedingEvents', tempRecord);

      if (!isOnline) {
        console.log('[useCreateBreedingEvent] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'breedingEvents',
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
      
      const res = await fetch(api.breeding.create.path, {
        method: api.breeding.create.method,
        headers,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create breeding event");
      const created = api.breeding.create.responses[201].parse(await res.json());
      
      await putInStore('breedingEvents', created);
      
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.breeding.list.path] });
      toast({ title: "Recorded", description: "Breeding event recorded successfully" });
    },
    onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useMatingGroups() {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: [api.breeding.groups.list.path],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useMatingGroups] Offline - fetching from IndexedDB');
        const cached = await getAllFromStore<MatingGroup>('matingGroups');
        return cached;
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(api.breeding.groups.list.path, { credentials: "include", headers });
      if(!res.ok) throw new Error("Failed to fetch mating groups");
      const data = api.breeding.groups.list.responses[200].parse(await res.json());
      
      if (data.length > 0) {
        await putManyInStore('matingGroups', data);
      }

      // Merge any pending offline creates/updates not yet synced to the server.
      // Creates: append new groups so mating-end alerts fire immediately.
      // Updates: patch existing groups so edits (e.g. extended dateOut) are
      //          reflected in alerts before the sync queue drains.
      const pendingItems = await getPendingSyncItems();

      const pendingMatingGroups = pendingItems
        .filter(item => item.entity === 'matingGroups' && item.action === 'create')
        .map(item => ({
          ...(item.data as object),
          id: item.tempId ?? -(item.timestamp),
        } as unknown as MatingGroup));

      if (pendingMatingGroups.length > 0) {
        console.log(`[useMatingGroups] Merging ${pendingMatingGroups.length} pending offline mating group(s) into results`);
      }

      // Build a patch map from pending updates keyed by record id.
      const pendingUpdates = pendingItems
        .filter(item => item.entity === 'matingGroups' && item.action === 'update')
        .reduce<Record<number, Partial<MatingGroup>>>((acc, item) => {
          const patch = item.data as { id?: number } & Partial<MatingGroup>;
          if (patch.id != null) {
            acc[patch.id] = { ...(acc[patch.id] ?? {}), ...patch };
          }
          return acc;
        }, {});

      const updateCount = Object.keys(pendingUpdates).length;
      if (updateCount > 0) {
        console.log(`[useMatingGroups] Applying ${updateCount} pending offline update(s) to mating group(s)`);
      }

      const patchedData = updateCount > 0
        ? data.map(g => pendingUpdates[g.id] ? { ...g, ...pendingUpdates[g.id] } : g)
        : data;

      // Filter out groups that have a pending offline delete so they don't
      // continue to trigger "mating period ending" alerts for deleted groups.
      const deletedIds = new Set(
        pendingItems
          .filter(item => item.entity === 'matingGroups' && item.action === 'delete')
          .map(item => {
            const d = item.data as { id?: number };
            return d?.id ?? null;
          })
          .filter((id): id is number => id !== null),
      );

      if (deletedIds.size > 0) {
        console.log(`[useMatingGroups] Suppressing ${deletedIds.size} offline-deleted mating group(s) from results`);
      }

      const visibleData = deletedIds.size > 0
        ? patchedData.filter(g => !deletedIds.has(g.id))
        : patchedData;

      const visiblePending = pendingMatingGroups.filter(g => !deletedIds.has(g.id));

      return [...visibleData, ...visiblePending];
    }
  });
}

export function useCreateMatingGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
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

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(api.breeding.groups.create.path, {
        method: api.breeding.groups.create.method,
        headers,
        body: JSON.stringify(data),
        credentials: "include"
      });
      if(!res.ok) throw new Error("Failed to create mating group");
      const created = api.breeding.groups.create.responses[201].parse(await res.json());
      
      await putInStore('matingGroups', created);
      
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.breeding.groups.list.path] });
      toast({ title: "Success", description: "Mating group created" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useDeleteBreedingEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();

  return useMutation({
    mutationFn: async (eventId: number) => {
      if (!isOnline) {
        console.log('[useDeleteBreedingEvent] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'breedingEvents',
          action: 'delete',
          data: { id: eventId },
          tempId: eventId,
        });
        return { id: eventId };
      }

      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/breeding/${eventId}`, {
        method: "DELETE",
        headers,
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete breeding event");
      return { id: eventId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.breeding.list.path] });
      toast({ title: "Deleted", description: "Breeding event deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}
