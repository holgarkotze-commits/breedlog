import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertBreedingEvent } from "@shared/schema";

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

export function useCreateBreedingEvent() {
  const queryClient = useQueryClient();
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
    },
  });
}
