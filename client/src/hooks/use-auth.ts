import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ensureUserIsolation } from "@/lib/indexeddb";
import { getDeviceToken, setDeviceToken, performLogout } from "@/lib/queryClient";
import { fetchAccountSession } from "@/lib/account-session";

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
  token?: string;
}

async function fetchDeviceInfo(): Promise<DeviceInfo> {
  try {
    const token = getDeviceToken();
    const headers: HeadersInit = {};
    if (token) {
      headers["X-Device-Token"] = token;
    }
    
    const response = await fetch("/api/device/info", {
      credentials: "include",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return { registered: false };
    }

    return response.json();
  } catch (error) {
    if (!navigator.onLine) {
      console.log('[Auth] Offline - using cached device data');
      // If we have a token, assume still registered
      const token = getDeviceToken();
      if (token) {
        return { registered: true };
      }
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
    cache: "no-store",
    body: JSON.stringify({ 
      deviceId,
      deviceName: navigator.userAgent.substring(0, 100) 
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to register device");
  }

  const data = await response.json();
  
  // Store the device token for future API requests
  if (data.token) {
    setDeviceToken(data.token);
    console.log('[Auth] Device token stored');
  }

  return data;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationAttempted, setRegistrationAttempted] = useState(false);
  const account = useQuery({
    queryKey: ["/api/auth/me"], queryFn: fetchAccountSession,
    retry: false, staleTime: 60_000, refetchOnWindowFocus: true,
  });
  const legacyEnabled = !account.data?.authenticated &&
    (!!getDeviceToken() || window.location.pathname === "/beta");
  
  const { data: deviceInfo, isLoading, refetch } = useQuery<DeviceInfo>({
    queryKey: ["/api/device/info"],
    queryFn: fetchDeviceInfo,
    retry: 1,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
    enabled: legacyEnabled && !account.isLoading,
  });

  // Auto-register device on first load if not registered (only try once)
  useEffect(() => {
    async function autoRegister() {
      if (legacyEnabled && deviceInfo && !deviceInfo.registered && !isRegistering && !registrationAttempted) {
        setIsRegistering(true);
        setRegistrationAttempted(true);
        try {
          await registerDevice();
          refetch();
        } catch (err) {
          console.error('[Auth] Device registration failed:', err);
          // Don't retry - let the app proceed to beta access gate
        } finally {
          setIsRegistering(false);
        }
      }
    }
    autoRegister();
  }, [deviceInfo, isRegistering, registrationAttempted, refetch, legacyEnabled]);

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

  // Only show loading on initial fetch, not during registration attempts
  // This prevents the app from being stuck if registration fails
  const effectiveLoading = account.isLoading || (legacyEnabled && isLoading && !registrationAttempted);

  return {
    user: account.data?.authenticated && account.data.profile
      ? { id: account.data.profile.workspaceUserId, deviceId: "" }
      : legacyEnabled && deviceInfo?.registered ? { id: deviceInfo.userId!, deviceId: deviceInfo.deviceId! } : null,
    account: account.data?.authenticated ? account.data.profile : undefined,
    isTrial: account.data?.trial === true,
    accountError: account.error,
    isLoading: effectiveLoading,
    isAuthenticated: !!account.data?.authenticated || (legacyEnabled && !!deviceInfo?.registered),
    logout: performLogout,
    isLoggingOut: false,
    deviceId: getDeviceId(),
  };
}
