import type { IStorage } from "./storage";
import { createWorkspaceBackup, type EncryptedBreedLogBackup } from "./backup";
import { purgeCommercialState } from "./commercial";

const DELETION_PREFIX = "account-deletion:";
const DELETION_TOMBSTONE_PREFIX = "account-deletion-tombstone:";
const RECOVERY_DAYS = 30;

export type AccountDeletionState = {
  accountId: string;
  status: "none" | "pending" | "cancelled" | "purge_failed" | "completed";
  requestedAt?: string;
  recoveryUntil?: string;
  cancelledAt?: string;
  completedAt?: string;
  suspendedAt?: string;
  exportBeforeDeletion: boolean;
  auditId?: string;
  purgeRetryCount?: number;
  lastPurgeError?: string;
  lastPurgeAttemptAt?: string;
  legalTombstoneKey?: string;
};

export class AccountDeletionError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

function key(accountId: string): string {
  return `${DELETION_PREFIX}${accountId}`;
}

function tombstoneKey(accountId: string): string {
  return `${DELETION_TOMBSTONE_PREFIX}${accountId}`;
}

function addRecoveryWindow(now: Date): Date {
  return new Date(now.getTime() + RECOVERY_DAYS * 24 * 60 * 60 * 1000);
}

export async function getAccountDeletionState(storage: IStorage, accountId: string): Promise<AccountDeletionState> {
  const raw = await storage.getSystemSetting(key(accountId));
  return raw ? JSON.parse(raw) as AccountDeletionState : {
    accountId,
    status: "none",
    exportBeforeDeletion: false,
  };
}

export async function isAccountSuspendedForDeletion(storage: IStorage, accountId: string): Promise<boolean> {
  const state = await getAccountDeletionState(storage, accountId);
  return state.status === "pending" || state.status === "purge_failed";
}

export async function requestAccountDeletion(
  storage: IStorage,
  accountId: string,
  options: { typedConfirmation: string; exportBeforeDeletion?: boolean; passphrase?: string; now?: Date },
): Promise<{ state: AccountDeletionState; backup: EncryptedBreedLogBackup | null }> {
  if (options.typedConfirmation !== "DELETE MY BREEDLOG ACCOUNT") {
    throw new AccountDeletionError("CONFIRMATION_REQUIRED", "Account deletion requires the exact typed confirmation.");
  }
  const now = options.now ?? new Date();
  const state: AccountDeletionState = {
    accountId,
    status: "pending",
    requestedAt: now.toISOString(),
    recoveryUntil: addRecoveryWindow(now).toISOString(),
    suspendedAt: now.toISOString(),
    exportBeforeDeletion: options.exportBeforeDeletion === true,
    auditId: `acctdel_${Buffer.from(`${accountId}:${now.toISOString()}`).toString("base64url").slice(0, 24)}`,
    purgeRetryCount: 0,
  };
  const backup = state.exportBeforeDeletion
    ? await createWorkspaceBackup(storage, accountId, { passphrase: options.passphrase, manual: false, now })
    : null;
  await storage.setSystemSetting(key(accountId), JSON.stringify(state), "Account deletion recovery-window state");
  return { state, backup };
}

export async function cancelAccountDeletion(storage: IStorage, accountId: string, now = new Date()): Promise<AccountDeletionState> {
  const current = await getAccountDeletionState(storage, accountId);
  if (current.status !== "pending") {
    throw new AccountDeletionError("NO_PENDING_DELETION", "No pending account deletion exists for this account.", 404);
  }
  const state: AccountDeletionState = {
    ...current,
    status: "cancelled",
    cancelledAt: now.toISOString(),
    suspendedAt: undefined,
    lastPurgeError: undefined,
  };
  await storage.setSystemSetting(key(accountId), JSON.stringify(state), "Account deletion cancellation state");
  return state;
}

async function finalizeDeletionPurge(
  storage: IStorage,
  workspaceUserId: string,
  now: Date,
  purgeHandler?: (workspaceUserId: string) => Promise<void>,
) {
  if (purgeHandler) {
    await purgeHandler(workspaceUserId);
  } else {
    await storage.clearAllData(workspaceUserId);
    const managedWorkspace = await storage.getAccountWorkspaceByWorkspaceUserId(workspaceUserId);
    await purgeCommercialState(storage, workspaceUserId);
    if (managedWorkspace?.accountId && managedWorkspace.accountId !== workspaceUserId) {
      await purgeCommercialState(storage, managedWorkspace.accountId);
    }
    if (managedWorkspace?.accountId) {
      await storage.purgeManagedAccount(managedWorkspace.accountId);
    }
  }
}

export async function completeExpiredAccountDeletion(
  storage: IStorage,
  accountId: string,
  now = new Date(),
  options: { purgeHandler?: (accountId: string) => Promise<void> } = {},
): Promise<AccountDeletionState> {
  const current = await getAccountDeletionState(storage, accountId);
  if (!["pending", "purge_failed"].includes(current.status) || !current.recoveryUntil || new Date(current.recoveryUntil) > now) {
    throw new AccountDeletionError("RECOVERY_WINDOW_ACTIVE", "The account deletion recovery window has not expired.");
  }
  try {
    await finalizeDeletionPurge(storage, accountId, now, options.purgeHandler);
    const legalTombstoneKey = tombstoneKey(accountId);
    await storage.setSystemSetting(legalTombstoneKey, JSON.stringify({
      accountId,
      completedAt: now.toISOString(),
      auditId: current.auditId ?? null,
      requestedAt: current.requestedAt ?? null,
    }), "Minimal legal account deletion tombstone");
    const state: AccountDeletionState = {
      ...current,
      status: "completed",
      completedAt: now.toISOString(),
      lastPurgeAttemptAt: now.toISOString(),
      lastPurgeError: undefined,
      legalTombstoneKey,
    };
    await storage.setSystemSetting(key(accountId), JSON.stringify(state), "Completed account deletion audit state");
    return state;
  } catch (error: any) {
    const failedState: AccountDeletionState = {
      ...current,
      status: "purge_failed",
      lastPurgeAttemptAt: now.toISOString(),
      lastPurgeError: error?.message ?? "Unknown purge failure",
      purgeRetryCount: (current.purgeRetryCount ?? 0) + 1,
    };
    await storage.setSystemSetting(key(accountId), JSON.stringify(failedState), "Failed account deletion purge state");
    throw new AccountDeletionError("PURGE_FAILED", failedState.lastPurgeError ?? "Account deletion purge failed.", 500);
  }
}

export async function processExpiredAccountDeletionQueue(
  storage: IStorage,
  now = new Date(),
  options: { purgeHandler?: (accountId: string) => Promise<void> } = {},
) {
  const rows = await storage.listSystemSettings(DELETION_PREFIX);
  const results: Array<{ accountId: string; status: "completed" | "skipped" | "failed"; reason?: string }> = [];
  for (const row of rows) {
    const state = JSON.parse(row.value) as AccountDeletionState;
    if (!state.accountId || !state.recoveryUntil) {
      continue;
    }
    if (new Date(state.recoveryUntil).getTime() > now.getTime()) {
      results.push({ accountId: state.accountId, status: "skipped", reason: "recovery_window_active" });
      continue;
    }
    try {
      await completeExpiredAccountDeletion(storage, state.accountId, now, options);
      results.push({ accountId: state.accountId, status: "completed" });
    } catch (error: any) {
      results.push({ accountId: state.accountId, status: "failed", reason: error?.message ?? "Unknown failure" });
    }
  }
  return results;
}
