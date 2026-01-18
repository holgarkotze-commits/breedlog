import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useGenerateValuation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (animalId: number) => {
      const res = await fetch(api.ai.generateValuation.path, {
        method: api.ai.generateValuation.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animalId }),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please log in to use AI features");
        throw new Error("Failed to generate valuation");
      }
      return api.ai.generateValuation.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({ title: "Valuation Failed", description: error.message, variant: "destructive" });
    },
  });
}
