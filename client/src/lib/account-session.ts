import { ensureUserIsolation, getAllFromStore, getCurrentUserId } from "./indexeddb";
import { clearDeviceToken, queryClient } from "./queryClient";

export type AccountProfile = {
  accountId: string;
  email: string;
  emailVerified: boolean;
  workspaceUserId: string;
  devices: Array<{ deviceId: string; status: string }>;
};
export type AccountResult = { authenticated: true; profile: AccountProfile; recoveryCode?: string; trial?: boolean };
export type AccountState = { authenticated: boolean; profile?: AccountProfile; trial?: boolean };
const CACHE_KEY = "breedlog_account_session";
const OFFLINE_ACCESS_MS = 7 * 24 * 60 * 60 * 1000;

function invalidateCachedSession() {
  // Retain the last workspace identity (not a credential) so its farmer can
  // sign back in and rescue pending edits after a session expires.
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (cached) localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cached, authenticated: false }));
  } catch { clearAccountCache(); }
}

export async function assertNoPendingChanges() {
  const queued = await getAllFromStore<{ synced?: number }>("syncQueue");
  if (queued.some(item => item.synced !== 1)) {
    throw new Error("You have unsynced changes. Reconnect and sync before signing out or changing accounts. Your records have not been removed.");
  }
}

export async function accountRequest<T>(path: string, body: unknown): Promise<T> {
  if (!navigator.onLine) throw new Error("Connect to the internet to sign in or recover your account.");
  if (path === "/api/auth/register" || path === "/api/auth/login") {
    try { await assertNoPendingChanges(); }
    catch (error) {
      let sameFarmer = false;
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        sameFarmer = path === "/api/auth/login" && !!cached?.profile?.email &&
          cached.profile.email.toLowerCase() === String((body as { email?: string })?.email || "").trim().toLowerCase();
      } catch { /* Unknown identity must not switch a pending queue. */ }
      if (!sameFarmer) throw error;
    }
  }
  const response = await fetch(path, {
    method: "POST", credentials: "include", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.message || "Account request failed."), { status: response.status, code: result.code });
  return result;
}

export function clearAccountCache() { localStorage.removeItem(CACHE_KEY); }

export async function fetchAccountSession(): Promise<AccountState> {
  try {
    const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (response.status === 401) {
      invalidateCachedSession();
      return { authenticated: false };
    }
    if (!response.ok) throw new Error("Unable to check your account session.");
    const state: AccountState = await response.json();
    if (state.authenticated && state.profile) {
      await ensureUserIsolation(state.profile.workspaceUserId);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...state, verifiedAt: Date.now() }));
    } else {
      invalidateCachedSession();
    }
    return state;
  } catch (err) {
    if (!navigator.onLine) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached?.profile && cached.authenticated && Date.now() - cached.verifiedAt < OFFLINE_ACCESS_MS &&
            await getCurrentUserId() === cached.profile.workspaceUserId) return cached;
      } catch { /* Invalid cache must not grant access. */ }
      return { authenticated: false };
    }
    throw err;
  }
}

export async function completeAccountSignIn(result: AccountResult): Promise<void> {
  await ensureUserIsolation(result.profile.workspaceUserId);
  clearDeviceToken();
  localStorage.removeItem("breedlog_beta_access");
  // Trial state is fetched from the server; no entitlement is granted by storage.
  queryClient.clear();
  window.location.assign(result.recoveryCode ? "/welcome" : "/");
}
