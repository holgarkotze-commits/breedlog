import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ensureUserIsolation, clearAllOfflineData } from "@/lib/indexeddb";
import { clearBetaAccessStorage } from "@/components/BetaAccessGate";
import { apiRequest } from "@/lib/queryClient";

// Generate or retrieve deviceId
function getDeviceId(): string {
  const STORAGE_KEY = "breedlog_device_id";
  let deviceId = localStorage.getItem(STORAGE_KEY);
  
  if (!deviceId) {
    // Generate a secure random UUID
    deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  
  return deviceId;
}

interface DeviceInfo {
  registered: boolean;
  userId?: string;
  deviceId?: string;
}

async function fetchDeviceInfo(): Promise<DeviceInfo> {
  try {
    const response = await fetch("/api/device/info", {
      credentials: "include",
    });

    if (!response.ok) {
      return { registered: false };
    }

    return response.json();
  } catch (error) {
    if (!navigator.onLine) {
      console.log('[Auth] Offline - using cached device data');
      return { registered: false };
    }
    throw error;
  }
}

async function registerDevice(): Promise<DeviceInfo> {
  const deviceId = getDeviceId();
  
  const response = await fetch("/api/device/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ 
      deviceId,
      deviceName: navigator.userAgent.substring(0, 100) 
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to register device");
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  
  const { data: deviceInfo, isLoading, refetch } = useQuery<DeviceInfo>({
    queryKey: ["/api/device/info"],
    queryFn: fetchDeviceInfo,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  // Auto-register device on first load if not registered
  useEffect(() => {
    async function autoRegister() {
      if (deviceInfo && !deviceInfo.registered && !isRegistering) {
        setIsRegistering(true);
        try {
          await registerDevice();
          refetch();
        } catch (err) {
          console.error('[Auth] Device registration failed:', err);
        } finally {
          setIsRegistering(false);
        }
      }
    }
    autoRegister();
  }, [deviceInfo, isRegistering, refetch]);

  // Ensure user data isolation when device changes
  useEffect(() => {
    if (deviceInfo?.userId) {
      ensureUserIsolation(deviceInfo.userId).then((dataCleared) => {
        if (dataCleared) {
          console.log('[Auth] Device changed, offline data cleared for isolation');
          queryClient.invalidateQueries();
        }
      });
    }
  }, [deviceInfo?.userId, queryClient]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await clearAllOfflineData();
      clearBetaAccessStorage();
      await apiRequest("POST", "/api/device/logout", {});
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/device/info"], { registered: false });
      queryClient.invalidateQueries();
    },
  });

  return {
    user: deviceInfo?.registered ? { id: deviceInfo.userId!, deviceId: deviceInfo.deviceId! } : null,
    isLoading: isLoading || isRegistering,
    isAuthenticated: !!deviceInfo?.registered,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    deviceId: getDeviceId(),
  };
}
