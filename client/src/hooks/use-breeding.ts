import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertBreedingEvent, type InsertMatingGroup } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useBreedingEvents() {
  return useQuery({
    queryKey: [api.breeding.list.path],
    queryFn: async () => {
      const res = await fetch(api.breeding.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch breeding events");
      return api.breeding.list.responses[200].parse(await res.json());
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

  return useMutation({
    mutationFn: async (data: InsertBreedingEvent) => {
      const res = await fetch(api.breeding.create.path, {
        method: api.breeding.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create breeding event");
      return api.breeding.create.responses[201].parse(await res.json());
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
    return useQuery({
        queryKey: [api.breeding.groups.list.path],
        queryFn: async () => {
            const res = await fetch(api.breeding.groups.list.path, { credentials: "include" });
            if(!res.ok) throw new Error("Failed to fetch mating groups");
            return api.breeding.groups.list.responses[200].parse(await res.json());
        }
    });
}

export function useCreateMatingGroup() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (data: InsertMatingGroup) => {
            const res = await fetch(api.breeding.groups.create.path, {
                method: api.breeding.groups.create.method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                credentials: "include"
            });
            if(!res.ok) throw new Error("Failed to create mating group");
            return api.breeding.groups.create.responses[201].parse(await res.json());
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
