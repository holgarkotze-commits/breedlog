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

// Animal Images Hooks
export function useAnimalImages(animalId: number) {
  return useQuery({
    queryKey: ["/api/animals", animalId, "images"],
    queryFn: async () => {
      const res = await fetch(`/api/animals/${animalId}/images`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
    enabled: !!animalId,
  });
}

export function useUploadAnimalImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ animalId, imageData, fileName, caption }: { animalId: number; imageData: string; fileName: string; caption?: string }) => {
      const res = await fetch(`/api/animals/${animalId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, fileName, caption }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload image");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals", variables.animalId, "images"] });
      toast({ title: "Image Uploaded", description: "Photo added to animal folder" });
    },
    onError: (error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteAnimalImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ animalId, imageId }: { animalId: number; imageId: number }) => {
      const res = await fetch(`/api/animals/${animalId}/images/${imageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete image");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals", variables.animalId, "images"] });
      toast({ title: "Image Deleted", description: "Photo removed from folder" });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });
}

// === LAMB MANAGEMENT HOOKS ===

export function useClassifyRamLamb() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ramLambClass }: { id: number; ramLambClass: string }) => {
      const res = await fetch(`/api/animals/${id}/classify-ram-lamb`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ramLambClass }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to classify ram lamb");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.animals.get.path, data.id] });
      toast({ title: "Ram Lamb Classified", description: `Classification set to ${data.ramLambClass}` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useMoveToEwes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/animals/${id}/move-to-ewes`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to move ewe lamb to ewes");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.animals.get.path, data.id] });
      toast({ title: "Ewe Lamb Moved", description: "Ewe lamb moved to Ewes section" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useMoveToRams() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ramType }: { id: number; ramType: string }) => {
      const res = await fetch(`/api/animals/${id}/move-to-rams`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ramType }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to move ram lamb to rams");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.animals.get.path, data.id] });
      toast({ title: "Ram Lamb Promoted", description: `Ram lamb moved to Rams section as ${data.ramType}` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useConfirmCull() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, cullReason }: { id: number; cullReason?: string }) => {
      const res = await fetch(`/api/animals/${id}/confirm-cull`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cullReason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to confirm cull");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.animals.get.path, data.id] });
      toast({ title: "Cull Confirmed", description: "Animal removed from active herd and archived" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useRemoveFromHerd() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, reason, notes }: { id: number; reason: string; notes?: string }) => {
      const res = await fetch(`/api/animals/${id}/remove-from-herd`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, notes }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove from herd");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.animals.get.path, data.id] });
      toast({ title: "Removed from Herd", description: `Animal archived as ${data.removalReason}` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
