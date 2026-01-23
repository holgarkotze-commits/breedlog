import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertFarmSettings, type FarmSettings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useFarmSettings() {
  return useQuery({
    queryKey: [api.farmSettings.get.path],
    queryFn: async () => {
      const res = await fetch(api.farmSettings.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch farm settings");
      const data = await res.json();
      return data as FarmSettings | null;
    },
  });
}

export function useSaveFarmSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: InsertFarmSettings) => {
      const res = await apiRequest("POST", api.farmSettings.save.path, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.farmSettings.get.path] });
      toast({
        title: "Farm settings saved",
        description: "Your farm details have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
