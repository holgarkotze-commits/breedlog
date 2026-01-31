import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertAnimal, type AnimalWithRelations } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { getAllFromStore, getFromStore, putInStore, putManyInStore, addToSyncQueue } from "@/lib/indexeddb";

export function useAnimals(filters?: { search?: string; status?: string; sex?: string }) {
  const queryKey = [api.animals.list.path, filters];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(api.animals.list.path, window.location.origin);
      if (filters?.search) url.searchParams.append("search", filters.search);
      if (filters?.status) url.searchParams.append("status", filters.status);
      if (filters?.sex) url.searchParams.append("sex", filters.sex);

      try {
        const res = await fetch(url.toString(), { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch animals");
        const data = api.animals.list.responses[200].parse(await res.json());
        await putManyInStore("animals", data);
        return data;
      } catch (error) {
        if (!navigator.onLine) {
          console.log("[useAnimals] Offline, fetching from IndexedDB");
          let animals = await getAllFromStore<AnimalWithRelations>("animals");
          if (filters?.search) {
            const searchLower = filters.search.toLowerCase();
            animals = animals.filter(a => 
              a.tagId.toLowerCase().includes(searchLower) || 
              a.name?.toLowerCase().includes(searchLower)
            );
          }
          if (filters?.status) animals = animals.filter(a => a.status === filters.status);
          if (filters?.sex) animals = animals.filter(a => a.sex === filters.sex);
          return animals;
        }
        throw error;
      }
    },
  });
}

export function useAnimal(id: number) {
  return useQuery({
    queryKey: [api.animals.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.animals.get.path, { id });
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch animal details");
        const data = api.animals.get.responses[200].parse(await res.json());
        await putInStore("animals", data);
        return data;
      } catch (error) {
        if (!navigator.onLine) {
          console.log("[useAnimal] Offline, fetching from IndexedDB");
          const cached = await getFromStore<AnimalWithRelations>("animals", id);
          if (cached) return cached;
        }
        throw error;
      }
    },
    enabled: !!id,
  });
}

export function useCreateAnimal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAnimal) => {
      if (!navigator.onLine) {
        const tempId = -Date.now();
        const offlineAnimal = { ...data, id: tempId, createdAt: new Date() } as AnimalWithRelations;
        await putInStore("animals", offlineAnimal);
        await addToSyncQueue({ action: "create", entity: "animals", data, tempId });
        console.log("[useCreateAnimal] Offline - saved locally with temp ID:", tempId);
        return offlineAnimal;
      }
      
      const res = await fetch(api.animals.create.path, {
        method: api.animals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        let errorMessage = "Failed to create animal";
        try {
          const text = await res.text();
          const error = JSON.parse(text);
          errorMessage = error.message || errorMessage;
        } catch {
          // Server returned non-JSON, use status text
          errorMessage = `Server error: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const created = api.animals.create.responses[201].parse(await res.json());
      await putInStore("animals", created);
      return created;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.animals.list.path] });
      const isOffline = (data.id as number) < 0;
      toast({ 
        title: isOffline ? "Saved Offline" : "Success", 
        description: isOffline ? "Animal will sync when online" : "Animal created successfully", 
        variant: "default" 
      });
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
      const existing = await getFromStore<AnimalWithRelations>("animals", id);
      const updated = existing 
        ? { ...existing, ...updates, id } as AnimalWithRelations
        : { ...updates, id } as AnimalWithRelations;
      await putInStore("animals", updated);
      
      if (!navigator.onLine) {
        const isTempId = id < 0;
        await addToSyncQueue({ 
          action: "update", 
          entity: "animals", 
          data: { id, ...updates },
          ...(isTempId ? { tempId: id } : {})
        });
        console.log("[useUpdateAnimal] Offline - queued update for ID:", id);
        return updated;
      }
      
      const url = buildUrl(api.animals.update.path, { id });
      const res = await fetch(url, {
        method: api.animals.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) {
        let errorMessage = "Failed to update animal";
        try {
          const text = await res.text();
          const error = JSON.parse(text);
          errorMessage = error.message || errorMessage;
        } catch {
          errorMessage = `Server error: ${res.status} ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const serverData = api.animals.update.responses[200].parse(await res.json());
      await putInStore("animals", serverData);
      return serverData;
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
      try {
        const res = await fetch(`/api/animals/${animalId}/images`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch images");
        const images = await res.json();
        for (const img of images) {
          await putInStore("animalImages", img);
        }
        return images;
      } catch (error) {
        if (!navigator.onLine) {
          console.log("[useAnimalImages] Offline, fetching from IndexedDB");
          const allImages = await getAllFromStore<any>("animalImages");
          return allImages.filter(img => img.animalId === animalId);
        }
        throw error;
      }
    },
    enabled: !!animalId,
  });
}

export function useUploadAnimalImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ animalId, imageData, fileName, caption }: { animalId: number; imageData: string; fileName: string; caption?: string }) => {
      if (!navigator.onLine) {
        const tempId = -Date.now();
        const offlineImage = { 
          id: tempId, 
          animalId, 
          imageData, 
          fileName, 
          caption: caption || null, 
          createdAt: new Date().toISOString() 
        };
        await putInStore("animalImages", offlineImage);
        await addToSyncQueue({ 
          action: "create", 
          entity: "animalImages", 
          data: { animalId, imageData, fileName, caption }, 
          tempId 
        });
        console.log("[useUploadAnimalImage] Offline - saved locally with temp ID:", tempId);
        return offlineImage;
      }
      
      const res = await fetch(`/api/animals/${animalId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, fileName, caption }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload image");
      const result = await res.json();
      await putInStore("animalImages", result);
      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/animals", variables.animalId, "images"] });
      const isOffline = (data.id as number) < 0;
      toast({ 
        title: isOffline ? "Saved Offline" : "Image Uploaded", 
        description: isOffline ? "Photo will sync when online" : "Photo added to animal folder" 
      });
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
