import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Device token storage keys
const DEVICE_TOKEN_KEY = "breedlog_device_token";

// Get stored device token for API authentication
export function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Store device token after successful activation
export function setDeviceToken(token: string): void {
  try {
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch (e) {
    console.error("[Auth] Failed to store device token:", e);
  }
}

// Clear device token on logout
export function clearDeviceToken(): void {
  try {
    localStorage.removeItem(DEVICE_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

// Robust connectivity check - pings actual API endpoint instead of relying on navigator.onLine
// This catches cases where browser reports online but API is unreachable
let lastConnectivityCheck = 0;
let cachedConnectivity = true;
const CONNECTIVITY_CACHE_MS = 5000; // Cache result for 5 seconds

export async function isApiReachable(): Promise<boolean> {
  // First quick check - if browser says offline, trust it
  if (!navigator.onLine) return false;
  
  // Use cached result if recent enough
  const now = Date.now();
  if (now - lastConnectivityCheck < CONNECTIVITY_CACHE_MS) {
    return cachedConnectivity;
  }
  
  try {
    // Hard ping the API version endpoint (lightweight, no auth required)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    const response = await fetch('/api/version', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    cachedConnectivity = response.ok;
    lastConnectivityCheck = now;
    return response.ok;
  } catch (err) {
    console.log('[Connectivity] API ping failed:', err);
    cachedConnectivity = false;
    lastConnectivityCheck = now;
    return false;
  }
}

// Build headers including device token for authentication
// Uses Authorization: Bearer <token> format (standard, more reliable than custom headers)
function getAuthHeaders(includeContentType: boolean = false): HeadersInit {
  const headers: HeadersInit = {};
  
  const token = getDeviceToken();
  if (token) {
    // Use standard Authorization: Bearer format for better compatibility
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check if online for write operations
  if (!navigator.onLine && method !== 'GET') {
    // For offline mutations, let the caller handle queueing
    throw new Error('OFFLINE: Operation queued for sync');
  }
  
  // Determine if this is an auth/beta/device endpoint that needs no-cache
  const isAuthEndpoint = url.includes('/api/device/') || 
                          url.includes('/api/beta/') || 
                          url.includes('/api/auth/') ||
                          url.includes('/api/admin/');
  
  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: isAuthEndpoint ? "no-store" : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    // Determine if this is an auth/beta/device endpoint that needs no-cache
    const isAuthEndpoint = url.includes('/api/device/') || 
                            url.includes('/api/beta/') || 
                            url.includes('/api/auth/') ||
                            url.includes('/api/admin/');
    
    const res = await fetch(url, {
      credentials: "include",
      headers: getAuthHeaders(false),
      cache: isAuthEndpoint ? "no-store" : undefined,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
