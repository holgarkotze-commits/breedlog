import { toast } from "@/hooks/use-toast";
import { getCurrentUserId, getFromStore, putInStore } from "@/lib/indexeddb";
import { apiRequest } from "@/lib/queryClient";
import { paidTermTime } from "@shared/commercial";

const EXPORT_ACCESS_KEY = "verifiedExportAccess";

type ExportAccess = { workspaceUserId: string; validUntil: string | null };

export async function fetchExportEntitlement({ signal }: { signal?: AbortSignal } = {}) {
  const workspaceUserId = await getCurrentUserId().catch(() => null);
  let response: Response;
  try {
    response = await apiRequest("GET", "/api/entitlements/me");
  } catch (error) {
    if (workspaceUserId && error instanceof Error && /^(401|403):/.test(error.message)) {
      await rememberAccess(workspaceUserId, null, signal);
    }
    throw error;
  }
  const data = await response.json();
  const entitlement = data.entitlement;
  if (workspaceUserId && data.workspaceUserId === workspaceUserId) {
    const validUntil = entitlement.planId === "premium"
      ? (entitlement.status === "grace_period" ? entitlement.graceUntil : entitlement.paidUntil)
      : null;
    await rememberAccess(workspaceUserId, validUntil ?? null, signal);
  }
  return data;
}

async function rememberAccess(workspaceUserId: string, validUntil: string | null, signal?: AbortSignal) {
  try {
    if (await getCurrentUserId() !== workspaceUserId || signal?.aborted) return;
    await putInStore("metadata", { key: EXPORT_ACCESS_KEY, value: { workspaceUserId, validUntil } });
  } catch {
    // Local storage failure must not disable an online export.
  }
}

export async function authorizeExport(): Promise<"online" | "offline" | false> {
  if (navigator.onLine) {
    try {
      const { entitlement, workspaceUserId } = await fetchExportEntitlement();
      if (workspaceUserId && workspaceUserId === await getCurrentUserId() &&
          (entitlement.planId === "premium" || entitlement.source === "internal_test")) return "online";
      toast({ title: "Premium required", description: "Printing and exports are available with Premium." });
      return false;
    } catch (error) {
      // Only a transport failure can use cached access. A server denial wins.
      if (!(error instanceof TypeError)) {
        toast({ title: "Export unavailable", description: "BreedLog could not verify export access.", variant: "destructive" });
        return false;
      }
    }
  }
  try {
    const access = await getFromStore<{ value: ExportAccess }>("metadata", EXPORT_ACCESS_KEY);
    if (access?.value.workspaceUserId === await getCurrentUserId() &&
        Date.now() < paidTermTime(access?.value.validUntil)) return "offline";
  } catch {
    // Unreadable local access cannot authorize an offline export.
  }
  toast({ title: "Premium verification needed", description: "Reconnect once to refresh this device’s Premium access." });
  return false;
}
