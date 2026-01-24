import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MatingGroup, InsertMatingGroup } from "@shared/schema";

export function useMatingGroups() {
  return useQuery<MatingGroup[]>({
    queryKey: ["/api/mating-groups"],
  });
}

export function useCreateMatingGroup() {
  return useMutation({
    mutationFn: async (data: InsertMatingGroup) => {
      const res = await apiRequest("POST", "/api/mating-groups", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mating-groups"] });
    },
  });
}
