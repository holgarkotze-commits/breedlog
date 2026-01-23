import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertEvaluation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useEvaluations(animalId: number) {
  return useQuery({
    queryKey: [api.evaluations.list.path, animalId],
    queryFn: async () => {
      const url = buildUrl(api.evaluations.list.path, { id: animalId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch evaluations");
      return api.evaluations.list.responses[200].parse(await res.json());
    },
    enabled: !!animalId,
  });
}

export function useCreateEvaluation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InsertEvaluation) => {
      const res = await fetch(api.evaluations.create.path, {
        method: api.evaluations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create evaluation");
      return api.evaluations.create.responses[201].parse(await res.json());
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
