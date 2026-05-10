import { useQuery } from "@tanstack/react-query";

interface AIHealthResponse {
  configured: boolean;
  quotaExhausted: boolean;
  providerStatus: "available" | "quota_exhausted" | "unavailable" | "not_configured";
  fallbackActive: boolean;
}

export function useAIStatus() {
  const { data } = useQuery<AIHealthResponse>({
    queryKey: ["/api/ai/health"],
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  return {
    configured: data?.configured ?? false,
    quotaExhausted: data?.quotaExhausted ?? false,
    fallbackActive: data?.fallbackActive ?? false,
    providerStatus: data?.providerStatus ?? "not_configured",
  };
}
