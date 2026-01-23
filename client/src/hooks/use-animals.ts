import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertAnimal, type AnimalWithRelations } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useAnimals(filters?: { search?: string; status?: string; sex?: string }) {
  // Construct query key including filters to ensure refetch on filter change
  const queryKey = [api.animals.list.path, filters];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      // Build URL with query params
      const url = new URL(api.animals.list.path, window.location.origin);
      if (filters?.search) url.searchParams.append("search", filters.search);
      if (filters?.status) url.searchParams.append("status", filters.status);
      if (filters?.sex) url.searchParams.append("sex", filters.sex);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch animals");
      return api.animals.list.responses[200].parse(await res.json());
    },
  });
}

export function useAnimal(id: number) {
  return useQuery({
    queryKey: [api.animals.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.animals.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch animal details");
      return api.animals.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateAnimal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAnimal) => {
      // Transform dates to strings if strictly needed by API, though JSON stringify usually handles ISO
      const res = await fetch(api.animals.create.path, {
        method: api.animals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create animal");
      }
      return api.animals.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      toast({ title: "Success", description: "Animal created successfully", variant: "default" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateAnimal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertAnimal>) => {
      const url = buildUrl(api.animals.update.path, { id });
      const res = await fetch(url, {
        method: api.animals.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update animal");
      return api.animals.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.animals.get.path, data.id] });
      toast({ title: "Updated", description: "Animal record updated", variant: "default" });
    },
    onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useFamilyTree(id: number) {
  return useQuery({
    queryKey: [api.animals.familyTree.path, id],
    queryFn: async () => {
      const url = buildUrl(api.animals.familyTree.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch family tree");
      return api.animals.familyTree.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useDeleteAnimal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.animals.delete.path, { id });
      const res = await fetch(url, {
        method: api.animals.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete animal");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      toast({ title: "Deleted", description: "Animal record deleted permanently", variant: "default" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
