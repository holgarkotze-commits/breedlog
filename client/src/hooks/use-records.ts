import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertPerformanceRecord, type InsertHealthRecord } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function usePerformanceRecords(animalId: number) {
  return useQuery({
    queryKey: [api.records.performance.list.path, animalId],
    queryFn: async () => {
      const url = buildUrl(api.records.performance.list.path, { id: animalId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch records");
      return api.records.performance.list.responses[200].parse(await res.json());
    },
    enabled: !!animalId,
  });
}

export function useCreatePerformanceRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertPerformanceRecord) => {
      const res = await fetch(api.records.performance.create.path, {
        method: api.records.performance.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add record");
      return api.records.performance.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.records.performance.list.path, variables.animalId] });
      toast({ title: "Success", description: "Weight record added" });
    },
  });
}

export function useHealthRecords(animalId: number) {
  return useQuery({
    queryKey: [api.records.health.list.path, animalId],
    queryFn: async () => {
      const url = buildUrl(api.records.health.list.path, { id: animalId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch health records");
      return api.records.health.list.responses[200].parse(await res.json());
    },
    enabled: !!animalId,
  });
}

export function useCreateHealthRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertHealthRecord) => {
      const res = await fetch(api.records.health.create.path, {
        method: api.records.health.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add record");
      return api.records.health.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.records.health.list.path, variables.animalId] });
      toast({ title: "Success", description: "Health record added" });
    },
  });
}
