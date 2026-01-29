import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertEvaluation, type Evaluation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { 
  getAllFromStore, 
  putManyInStore, 
  putInStore, 
  addToSyncQueue 
} from "@/lib/indexeddb";

export function useEvaluations(animalId: number) {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey: [api.evaluations.list.path, animalId],
    queryFn: async () => {
      if (!isOnline) {
        console.log('[useEvaluations] Offline - fetching from IndexedDB');
        const allEvals = await getAllFromStore<Evaluation>('evaluations');
        return allEvals.filter(e => e.animalId === animalId);
      }

      const url = buildUrl(api.evaluations.list.path, { id: animalId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch evaluations");
      const data = api.evaluations.list.responses[200].parse(await res.json());
      
      if (data.length > 0) {
        await putManyInStore('evaluations', data);
      }
      
      return data;
    },
    enabled: !!animalId,
  });
}

export function useCreateEvaluation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isOnline } = useNetworkStatus();
  
  return useMutation({
    mutationFn: async (data: InsertEvaluation) => {
      const tempId = -Date.now();
      const tempRecord = { ...data, id: tempId, createdAt: new Date().toISOString() } as unknown as Evaluation;

      await putInStore('evaluations', tempRecord);

      if (!isOnline) {
        console.log('[useCreateEvaluation] Offline - queuing for sync');
        await addToSyncQueue({
          entity: 'evaluations',
          action: 'create',
          data: data,
          tempId: tempId,
        });
        return tempRecord;
      }

      const res = await fetch(api.evaluations.create.path, {
        method: api.evaluations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create evaluation");
      const created = api.evaluations.create.responses[201].parse(await res.json());
      
      await putInStore('evaluations', created);
      
      return created;
    },
    onSuccess: (_, variables) => {
       const url = buildUrl(api.evaluations.list.path, { id: variables.animalId });
       queryClient.invalidateQueries({ queryKey: [url] });
       queryClient.invalidateQueries({ queryKey: [api.evaluations.list.path, variables.animalId] });
       toast({ title: "Success", description: "Evaluation added successfully" });
    },
    onError: (error) => {
       toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
