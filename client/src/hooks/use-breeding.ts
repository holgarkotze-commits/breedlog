import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertBreedingEvent, type InsertMatingGroup, type BreedingEvent, type MatingGroup } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { 
  getAllFromStore, 
  putManyInStore, 
  putInStore, 
  addToSyncQueue 
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

      const res = await fetch(api.breeding.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch breeding events");
      const data = api.breeding.list.responses[200].parse(await res.json());
      
      if (data.length > 0) {
        await putManyInStore('breedingEvents', data);
      }
      
      return data;
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

      const res = await fetch(api.breeding.create.path, {
        method: api.breeding.create.method,
        headers: { "Content-Type": "application/json" },
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

      const res = await fetch(api.breeding.groups.list.path, { credentials: "include" });
      if(!res.ok) throw new Error("Failed to fetch mating groups");
      const data = api.breeding.groups.list.responses[200].parse(await res.json());
      
      if (data.length > 0) {
        await putManyInStore('matingGroups', data);
      }
      
      return data;
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

      const res = await fetch(api.breeding.groups.create.path, {
        method: api.breeding.groups.create.method,
        headers: { "Content-Type": "application/json" },
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

      const res = await fetch(`/api/breeding/${eventId}`, {
        method: "DELETE",
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
