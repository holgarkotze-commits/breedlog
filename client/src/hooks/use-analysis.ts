import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAnimals } from "@/hooks/use-animals";
import { useBreedingEvents } from "@/hooks/use-breeding";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { getAllFromStore, putManyInStore } from "@/lib/indexeddb";
import { buildAnalysisBundle } from "@/lib/analysis-engine";
import type { HealthRecord, PerformanceRecord } from "@shared/schema";

async function fetchAllPerformanceRecords(isOnline: boolean): Promise<PerformanceRecord[]> {
  if (!isOnline) {
    return getAllFromStore<PerformanceRecord>("performanceRecords");
  }
  const { getDeviceToken } = await import("@/lib/queryClient");
  const token = getDeviceToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch("/api/performance-records", { credentials: "include", headers });
  if (!res.ok) throw new Error("Failed to fetch performance records");
  const data = (await res.json()) as PerformanceRecord[];
  if (data.length > 0) {
    await putManyInStore("performanceRecords", data);
  }
  return data;
}

async function fetchAllHealthRecords(isOnline: boolean): Promise<HealthRecord[]> {
  if (!isOnline) {
    return getAllFromStore<HealthRecord>("healthRecords");
  }
  const { getDeviceToken } = await import("@/lib/queryClient");
  const token = getDeviceToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch("/api/health-records", { credentials: "include", headers });
  if (!res.ok) throw new Error("Failed to fetch health records");
  const data = (await res.json()) as HealthRecord[];
  if (data.length > 0) {
    await putManyInStore("healthRecords", data);
  }
  return data;
}

export function useAnalysisBundle() {
  const { isOnline } = useNetworkStatus();
  const animalsQuery = useAnimals();
  const breedingQuery = useBreedingEvents();

  const performanceQuery = useQuery({
    queryKey: ["/api/performance-records"],
    queryFn: () => fetchAllPerformanceRecords(isOnline),
  });

  const healthQuery = useQuery({
    queryKey: ["/api/health-records"],
    queryFn: () => fetchAllHealthRecords(isOnline),
  });

  const isLoading =
    animalsQuery.isLoading ||
    breedingQuery.isLoading ||
    performanceQuery.isLoading ||
    healthQuery.isLoading;

  const bundle = useMemo(() => {
    return buildAnalysisBundle({
      animals: animalsQuery.data || [],
      breedingEvents: breedingQuery.data || [],
      performanceRecords: performanceQuery.data || [],
      healthRecords: healthQuery.data || [],
    });
  }, [animalsQuery.data, breedingQuery.data, performanceQuery.data, healthQuery.data]);

  return {
    isLoading,
    isOnline,
    bundle,
    errors: [animalsQuery.error, breedingQuery.error, performanceQuery.error, healthQuery.error].filter(Boolean),
  };
}

