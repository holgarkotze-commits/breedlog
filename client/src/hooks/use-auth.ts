import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@shared/models/auth";
import { ensureUserIsolation, clearAllOfflineData } from "@/lib/indexeddb";
import { clearBetaAccessStorage } from "@/components/BetaAccessGate";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Ensure user data isolation when user changes
  useEffect(() => {
    if (user?.id) {
      ensureUserIsolation(user.id).then((dataCleared) => {
        if (dataCleared) {
          console.log('[Auth] User changed, offline data cleared for isolation');
          queryClient.invalidateQueries();
        }
      });
    }
  }, [user?.id, queryClient]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await clearAllOfflineData();
      clearBetaAccessStorage();
      window.location.href = "/api/logout";
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
