import type { IStorage } from "./storage";
import { createWorkspaceBackup, type EncryptedBreedLogBackup } from "./backup";

const DELETION_PREFIX = "account-deletion:";
const RECOVERY_DAYS = 30;

export type AccountDeletionState = {
  accountId: string;
  status: "none" | "pending" | "cancelled" | "completed";
  requestedAt?: string;
  recoveryUntil?: string;
  cancelledAt?: string;
  completedAt?: string;
  exportBeforeDeletion: boolean;
  auditId?: string;
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
    exportBeforeDeletion: options.exportBeforeDeletion === true,
    auditId: `acctdel_${Buffer.from(`${accountId}:${now.toISOString()}`).toString("base64url").slice(0, 24)}`,
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
  };
  await storage.setSystemSetting(key(accountId), JSON.stringify(state), "Account deletion cancellation state");
  return state;
}

export async function completeExpiredAccountDeletion(storage: IStorage, accountId: string, now = new Date()): Promise<AccountDeletionState> {
  const current = await getAccountDeletionState(storage, accountId);
  if (current.status !== "pending" || !current.recoveryUntil || new Date(current.recoveryUntil) > now) {
    throw new AccountDeletionError("RECOVERY_WINDOW_ACTIVE", "The account deletion recovery window has not expired.");
  }
  await storage.clearAllData(accountId);
  const state: AccountDeletionState = {
    ...current,
    status: "completed",
    completedAt: now.toISOString(),
  };
  await storage.setSystemSetting(key(accountId), JSON.stringify(state), "Completed account deletion audit state");
  return state;
}
