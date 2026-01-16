import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertEvaluation } from "@shared/schema";

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
    },
  });
}

export function useGenerateAiValuation() {
  return useMutation({
    mutationFn: async ({ animalId }: { animalId: number }) => {
      const res = await fetch(api.ai.generateValuation.path, {
        method: api.ai.generateValuation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate AI valuation");
      return api.ai.generateValuation.responses[200].parse(await res.json());
    },
  });
}
