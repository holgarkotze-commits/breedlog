import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export async function authorizeExport(): Promise<boolean> {
  try {
    const response = await apiRequest("POST", "/api/exports/authorize");
    if (response.status === 204) return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("403:") && error.message.includes("PREMIUM_REQUIRED")) {
      toast({ title: "Premium required", description: "Printing and exports are available with Premium." });
      return false;
    }
  }
  toast({ title: "Export unavailable", description: "Connect to BreedLog and try again.", variant: "destructive" });
  return false;
}
