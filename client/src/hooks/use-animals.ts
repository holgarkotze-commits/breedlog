import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertAnimal, type AnimalWithRelations } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { getAllFromStore, getFromStore, putInStore, putManyInStore, addToSyncQueue } from "@/lib/indexeddb";
import { syncManager } from "@/lib/sync-manager";

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
        // Include auth token for device-based authentication
        const { getDeviceToken } = await import("@/lib/queryClient");
        const token = getDeviceToken();
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        
        const res = await fetch(url.toString(), { 
          credentials: "include",
          headers 
        });
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
      // HYBRID FETCH: Check local IndexedDB first for temp IDs (negative) or as fallback
      
      // For temp IDs (negative numbers), ALWAYS use IndexedDB - server doesn't have them yet
      if (id < 0) {
        console.log("[useAnimal] Temp ID detected, fetching from IndexedDB:", id);
        const cached = await getFromStore<AnimalWithRelations>("animals", id);
        if (cached) return cached;
        
        // Also try to find by scanning all animals (in case ID mapping occurred)
        const allAnimals = await getAllFromStore<AnimalWithRelations>("animals");
        const found = allAnimals.find(a => a.id === id);
        if (found) return found;
        
        throw new Error("Animal not found in local storage");
      }
      
      // For positive IDs, try server first, then fallback to IndexedDB
      const url = buildUrl(api.animals.get.path, { id });
      try {
        // Include auth token for device-based authentication
        const { getDeviceToken } = await import("@/lib/queryClient");
        const token = getDeviceToken();
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        
        const res = await fetch(url, { 
          credentials: "include",
          headers 
        });
        
        if (res.ok) {
          const data = api.animals.get.responses[200].parse(await res.json());
          await putInStore("animals", data);
          return data;
        }
        
        // Server returned error (404, 500, etc.) - fallback to IndexedDB
        console.log("[useAnimal] Server returned", res.status, "- checking IndexedDB");
        const cached = await getFromStore<AnimalWithRelations>("animals", id);
        if (cached) {
          console.log("[useAnimal] Found in IndexedDB cache");
          return cached;
        }
        
        throw new Error("Animal not found");
      } catch (error) {
        // Network error or any other failure - fallback to IndexedDB
        console.log("[useAnimal] Fetch failed, checking IndexedDB:", error);
        const cached = await getFromStore<AnimalWithRelations>("animals", id);
        if (cached) {
          console.log("[useAnimal] Found in IndexedDB cache");
          return cached;
        }
        throw error;
      }
    },
    enabled: !!id,
    retry: false, // Don't retry - we already have fallback logic
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

export function useCreateAnimal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAnimal) => {
      // Use robust connectivity check (actual API ping, not just navigator.onLine)
      const { isApiReachable, getDeviceToken } = await import("@/lib/queryClient");
      const isOnline = await isApiReachable();
      
      console.log("[useCreateAnimal] Connectivity check:", isOnline ? "ONLINE" : "OFFLINE");
      
      // OFFLINE-FIRST: Always save locally first for instant response
      const tempId = -Date.now();
      // Get device user ID for offline storage
      const deviceInfo = localStorage.getItem('breedlog_device_id');
      const offlineAnimal = { 
        ...data, 
        id: tempId, 
        createdAt: new Date(),
        userId: deviceInfo || 'offline-user', // Will be replaced with server userId on sync
        synced: 0 // 0 = pending sync
      } as unknown as AnimalWithRelations;
      
      // Save to IndexedDB immediately for instant UI response
      await putInStore("animals", offlineAnimal);
      console.log("[useCreateAnimal] Saved locally with temp ID:", tempId);
      
      // If online, try immediate server save
      if (isOnline) {
        try {
          const token = getDeviceToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          
          console.log("[SYNC] Attempting to save animal. Data payload:", JSON.stringify(data));
          
          const res = await fetch(api.animals.create.path, {
            method: api.animals.create.method,
            headers,
            body: JSON.stringify(data),
            credentials: "include",
          });
          
          console.log("[SERVER] Response:", res.status, res.statusText);
          
          if (res.ok) {
            const created = api.animals.create.responses[201].parse(await res.json());
            // Update IndexedDB with server data (replaces temp ID)
            await putInStore("animals", created);
            // Remove temp entry
            try {
              const { deleteFromStore } = await import("@/lib/indexeddb");
              await deleteFromStore("animals", tempId);
            } catch (e) {
              console.log("[useCreateAnimal] Could not remove temp entry:", e);
            }
            console.log("[useCreateAnimal] Server save succeeded, ID:", created.id);
            return created;
          }
          // Server error - fall through to queue for sync
          const errorText = await res.text();
          console.log("[useCreateAnimal] Server returned error:", res.status, errorText);
        } catch (err) {
          console.log("[useCreateAnimal] Network error, queuing for sync:", err);
        }
      }
      
      // Offline or server failed - queue for sync
      await addToSyncQueue({ action: "create", entity: "animals", data, tempId });
      console.log("[useCreateAnimal] Queued for sync");
      
      // Trigger background sync (non-blocking)
      if (isOnline) {
        syncManager.sync().catch(err => {
          console.log("[useCreateAnimal] Background sync failed, will retry later:", err);
        });
      }
      
      return offlineAnimal;
    },
    onMutate: async (newAnimal) => {
      // Optimistic update: Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: [api.animals.list.path] });
      
      // Snapshot previous value for rollback
      const previousAnimals = queryClient.getQueryData([api.animals.list.path]);
      
      return { previousAnimals };
    },
    onSuccess: (data) => {
      // Check if actually saved to server (positive ID means server confirmed)
      const serverConfirmed = (data.id as number) > 0;
      
      if (serverConfirmed) {
        toast({ 
          title: "Saved", 
          description: "Animal saved to database",
          variant: "default" 
        });
      } else {
        toast({ 
          title: "Saved Locally", 
          description: "Will sync when online",
          variant: "default" 
        });
      }
      
      // Invalidate ALL animal list queries regardless of filters to trigger immediate refresh
      // Using predicate to match any query starting with the animals list path
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === api.animals.list.path;
        }
      });
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousAnimals) {
        queryClient.setQueryData([api.animals.list.path], context.previousAnimals);
      }
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateAnimal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertAnimal>) => {
      // Use robust connectivity check (actual API ping, not just navigator.onLine)
      const { isApiReachable, getDeviceToken } = await import("@/lib/queryClient");
      const isOnline = await isApiReachable();
      
      console.log("[useUpdateAnimal] Connectivity check:", isOnline ? "ONLINE" : "OFFLINE");
      
      // OFFLINE-FIRST: Always save locally first for instant response
      const existing = await getFromStore<AnimalWithRelations>("animals", id);
      const updated = existing 
        ? { ...existing, ...updates, id, synced: 0 } as AnimalWithRelations
        : { ...updates, id, synced: 0, createdAt: new Date() } as unknown as AnimalWithRelations;
      
      // Save to IndexedDB immediately for instant UI response
      await putInStore("animals", updated);
      console.log("[useUpdateAnimal] Saved locally, ID:", id);
      
      const isTempId = id < 0;
      
      // If online and not a temp ID, try immediate server update
      if (isOnline && !isTempId) {
        try {
          const token = getDeviceToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          
          console.log("[SYNC] Attempting to update animal ID:", id, "Data:", JSON.stringify(updates));
          
          const url = buildUrl(api.animals.update.path, { id });
          const res = await fetch(url, {
            method: api.animals.update.method,
            headers,
            body: JSON.stringify(updates),
            credentials: "include",
          });
          
          console.log("[SERVER] Response:", res.status, res.statusText);
          
          if (res.ok) {
            const serverData = api.animals.update.responses[200].parse(await res.json());
            await putInStore("animals", serverData);
            console.log("[useUpdateAnimal] Server update succeeded");
            return serverData;
          }
          const errorText = await res.text();
          console.log("[useUpdateAnimal] Server returned error:", res.status, errorText);
        } catch (err) {
          console.log("[useUpdateAnimal] Network error, queuing for sync:", err);
        }
      }
      
      // Offline or server failed - queue for sync
      await addToSyncQueue({ 
        action: "update", 
        entity: "animals", 
        data: { id, ...updates },
        ...(isTempId ? { tempId: id } : {})
      });
      console.log("[useUpdateAnimal] Queued for sync");
      
      // Trigger background sync (non-blocking)
      if (isOnline) {
        syncManager.sync().catch(err => {
          console.log("[useUpdateAnimal] Background sync failed, will retry later:", err);
        });
      }
      
      return updated;
    },
    onMutate: async ({ id, ...updates }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: [api.animals.list.path] });
      await queryClient.cancelQueries({ queryKey: [api.animals.get.path, id] });
      
      const previousAnimals = queryClient.getQueryData([api.animals.list.path]);
      const previousAnimal = queryClient.getQueryData([api.animals.get.path, id]);
      
      return { previousAnimals, previousAnimal };
    },
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData([api.animals.list.path], (old: AnimalWithRelations[] | undefined) => {
        if (!old) return old;
        return old.map(animal => animal.id === data.id ? data : animal);
      });
      queryClient.setQueryData([api.animals.get.path, data.id], data);
      
      const isOffline = !navigator.onLine || (data as any).synced === 0;
      toast({ 
        title: "Updated", 
        description: isOffline ? "Saved locally, will sync when online" : "Changes saved"
      });
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousAnimals) {
        queryClient.setQueryData([api.animals.list.path], context.previousAnimals);
      }
      if (context?.previousAnimal) {
        queryClient.setQueryData([api.animals.get.path, variables.id], context.previousAnimal);
      }
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  });
}

export function useFamilyTree(id: number) {
  return useQuery({
    queryKey: [api.animals.familyTree.path, id],
    queryFn: async () => {
      const url = buildUrl(api.animals.familyTree.path, { id });
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(url, { credentials: "include", headers });
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
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(url, {
        method: api.animals.delete.method,
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete animal");
    },
    onSuccess: () => {
      // Invalidate all animal queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === api.animals.list.path
      });
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
        // Include auth token for device-based authentication
        const { getDeviceToken } = await import("@/lib/queryClient");
        const token = getDeviceToken();
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        
        const res = await fetch(`/api/animals/${animalId}/images`, { credentials: "include", headers });
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
      // OFFLINE-FIRST: Always save locally first for instant response
      const tempId = -Date.now();
      const offlineImage = { 
        id: tempId, 
        animalId, 
        imageData, 
        fileName, 
        caption: caption || null, 
        createdAt: new Date().toISOString(),
        synced: 0
      };
      
      // Save to IndexedDB immediately
      await putInStore("animalImages", offlineImage);
      console.log("[useUploadAnimalImage] Saved locally with temp ID:", tempId);
      
      // If online, try immediate server upload
      if (navigator.onLine) {
        try {
          // Include auth token for device-based authentication
          const { getDeviceToken } = await import("@/lib/queryClient");
          const token = getDeviceToken();
          const uploadHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (token) uploadHeaders["Authorization"] = `Bearer ${token}`;
          
          const res = await fetch(`/api/animals/${animalId}/images`, {
            method: "POST",
            headers: uploadHeaders,
            body: JSON.stringify({ imageData, fileName, caption }),
            credentials: "include",
          });
          
          if (res.ok) {
            const result = await res.json();
            await putInStore("animalImages", result);
            // Remove temp entry
            try {
              const { deleteFromStore } = await import("@/lib/indexeddb");
              await deleteFromStore("animalImages", tempId);
            } catch (e) {
              console.log("[useUploadAnimalImage] Could not remove temp entry:", e);
            }
            console.log("[useUploadAnimalImage] Server upload succeeded");
            return result;
          }
          console.log("[useUploadAnimalImage] Server returned error, queuing for sync");
        } catch (err) {
          console.log("[useUploadAnimalImage] Network error, queuing for sync:", err);
        }
      }
      
      // Offline or server failed - queue for sync
      await addToSyncQueue({ 
        action: "create", 
        entity: "animalImages", 
        data: { animalId, imageData, fileName, caption }, 
        tempId 
      });
      
      // Trigger background sync (non-blocking)
      if (navigator.onLine) {
        syncManager.sync().catch(err => {
          console.log("[useUploadAnimalImage] Background sync failed, will retry later:", err);
        });
      }
      
      return offlineImage;
    },
    onSuccess: (data, variables) => {
      // Add to cache
      queryClient.setQueryData(["/api/animals", variables.animalId, "images"], (old: any[] | undefined) => {
        if (!old) return [data];
        // Check if already exists, if so replace
        const exists = old.some(img => img.id === data.id);
        if (exists) {
          return old.map(img => img.id === data.id ? data : img);
        }
        return [...old, data];
      });
      
      const isOffline = data.id < 0;
      toast({ 
        title: isOffline ? "Photo Saved Locally" : "Photo Saved", 
        description: isOffline ? "Will sync when online" : "Photo uploaded successfully"
      });
    },
    onError: (error) => {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteAnimalImage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ animalId, imageId }: { animalId: number; imageId: number }) => {
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/animals/${animalId}/images/${imageId}`, {
        method: "DELETE",
        headers,
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
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/animals/${id}/classify-ram-lamb`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ramLambClass }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to classify ram lamb");
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate all animal queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === api.animals.list.path
      });
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
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/animals/${id}/move-to-ewes`, {
        method: "PATCH",
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to move ewe lamb to ewes");
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate all animal queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === api.animals.list.path
      });
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
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/animals/${id}/move-to-rams`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ramType }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to move ram lamb to rams");
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate all animal queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === api.animals.list.path
      });
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
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/animals/${id}/confirm-cull`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ cullReason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to confirm cull");
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate all animal queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === api.animals.list.path
      });
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
      // Include auth token for device-based authentication
      const { getDeviceToken } = await import("@/lib/queryClient");
      const token = getDeviceToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/animals/${id}/remove-from-herd`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reason, notes }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove from herd");
      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate all animal queries to refresh UI immediately
      queryClient.invalidateQueries({ 
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === api.animals.list.path
      });
      queryClient.invalidateQueries({ queryKey: [api.animals.get.path, data.id] });
      toast({ title: "Removed from Herd", description: `Animal archived as ${data.removalReason}` });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
