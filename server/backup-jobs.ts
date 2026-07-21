import crypto from "crypto";
import { getBreedLogPlan } from "@shared/commercial";
import { createWorkspaceBackup, previewWorkspaceBackup, type EncryptedBreedLogBackup } from "./backup";
import type { BackupStorageAdapter } from "./backup-storage";
import { getEntitlementState } from "./commercial";
import type { IStorage } from "./storage";

const BACKUP_JOB_PREFIX = "backup-job:";
const BACKUP_RECORD_PREFIX = "backup-record:";
const BACKUP_LOCK_PREFIX = "backup-lock:";
const LOCK_TTL_MS = 15 * 60 * 1000;

export type AutomaticBackupJobState = {
  workspaceUserId: string;
  schedule: "weekly";
  lastWindowKey?: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastStatus: "idle" | "success" | "failed" | "skipped";
  nextRunAt: string;
  retryCount: number;
  retryAfter?: string;
  lastError?: string;
  lastBackupRecordId?: string;
};

export type StoredBackupRecord = {
  recordId: string;
  workspaceUserId: string;
  backupType: "automatic" | "manual";
  exportedAt: string;
  storageKey: string;
  checksum: string;
  preview: ReturnType<typeof previewWorkspaceBackup>;
};

export type AutomaticBackupRunResult = {
  status: "success" | "skipped";
  reason?: string;
  state: AutomaticBackupJobState;
  record?: StoredBackupRecord;
};

export class AutomaticBackupJobLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomaticBackupJobLockedError";
  }
}

function stateKey(workspaceUserId: string): string {
  return `${BACKUP_JOB_PREFIX}${workspaceUserId}`;
}

function recordKey(workspaceUserId: string, recordId: string): string {
  return `${BACKUP_RECORD_PREFIX}${workspaceUserId}:${recordId}`;
}

function lockKey(workspaceUserId: string): string {
  return `${BACKUP_LOCK_PREFIX}${workspaceUserId}`;
}

function weeklyWindowKey(now: Date): string {
  const copy = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy.toISOString().slice(0, 10);
}

function nextWeeklyRun(now: Date): Date {
  const copy = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0));
  const day = copy.getUTCDay();
  const diff = day === 0 ? 1 : 8 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy;
}

function buildDefaultState(workspaceUserId: string, now: Date): AutomaticBackupJobState {
  return {
    workspaceUserId,
    schedule: "weekly",
    lastStatus: "idle",
    nextRunAt: nextWeeklyRun(now).toISOString(),
    retryCount: 0,
  };
}

async function getState(storage: IStorage, workspaceUserId: string, now = new Date()): Promise<AutomaticBackupJobState> {
  const raw = await storage.getSystemSetting(stateKey(workspaceUserId));
  return raw ? JSON.parse(raw) as AutomaticBackupJobState : buildDefaultState(workspaceUserId, now);
}

async function saveState(storage: IStorage, state: AutomaticBackupJobState): Promise<void> {
  await storage.setSystemSetting(stateKey(state.workspaceUserId), JSON.stringify(state), "Automatic weekly backup job state");
}

async function acquireLock(storage: IStorage, workspaceUserId: string, now = new Date()): Promise<void> {
  const key = lockKey(workspaceUserId);
  const existing = await storage.getSystemSetting(key);
  if (existing) {
    const parsed = JSON.parse(existing) as { expiresAt: string };
    if (new Date(parsed.expiresAt).getTime() > now.getTime()) {
      throw new AutomaticBackupJobLockedError(`Backup job for ${workspaceUserId} is already running.`);
    }
  }
  await storage.setSystemSetting(key, JSON.stringify({ expiresAt: new Date(now.getTime() + LOCK_TTL_MS).toISOString() }), "Automatic backup execution lock");
}

async function releaseLock(storage: IStorage, workspaceUserId: string): Promise<void> {
  await storage.setSystemSetting(lockKey(workspaceUserId), JSON.stringify({ expiresAt: new Date(0).toISOString() }), "Released automatic backup execution lock");
}

async function listRecords(storage: IStorage, workspaceUserId: string): Promise<StoredBackupRecord[]> {
  const rows = await storage.listSystemSettings(`${BACKUP_RECORD_PREFIX}${workspaceUserId}:`);
  return rows.map((row) => JSON.parse(row.value) as StoredBackupRecord)
    .sort((a, b) => new Date(b.exportedAt).getTime() - new Date(a.exportedAt).getTime());
}

async function saveRecord(storage: IStorage, record: StoredBackupRecord): Promise<void> {
  await storage.setSystemSetting(recordKey(record.workspaceUserId, record.recordId), JSON.stringify(record), "Automatic backup record metadata");
}

async function removeRecord(storage: IStorage, workspaceUserId: string, recordId: string): Promise<void> {
  await storage.deleteSystemSetting(recordKey(workspaceUserId, recordId));
}

function checksumForBackup(backup: EncryptedBreedLogBackup): string {
  return crypto.createHash("sha256").update(JSON.stringify(backup)).digest("hex");
}

async function recordAudit(storage: IStorage, workspaceUserId: string, eventType: string, detail?: string, metadata?: Record<string, unknown>) {
  await storage.createAccountAuditEvent({
    workspaceUserId,
    eventType,
    detail: detail ?? null,
    metadata: metadata ?? null,
  });
}

async function applyRetention(
  storage: IStorage,
  adapter: BackupStorageAdapter,
  workspaceUserId: string,
) {
  const entitlement = await getEntitlementState(storage, workspaceUserId);
  const plan = getBreedLogPlan(entitlement.planId);
  const keep = plan.limits.retainedWeeklyAutomaticBackups;
  const records = await listRecords(storage, workspaceUserId);
  const automatic = records.filter((record) => record.backupType === "automatic");
  const stale = automatic.slice(keep);
  for (const record of stale) {
    await adapter.deleteObject(record.storageKey);
    await removeRecord(storage, workspaceUserId, record.recordId);
    await recordAudit(storage, workspaceUserId, "backup.automatic.retention_pruned", `Removed ${record.recordId}`);
  }
}

export async function runAutomaticBackupForWorkspace(
  storage: IStorage,
  adapter: BackupStorageAdapter,
  workspaceUserId: string,
  options: { now?: Date; force?: boolean; passphrase?: string } = {},
): Promise<AutomaticBackupRunResult> {
  const now = options.now ?? new Date();
  await acquireLock(storage, workspaceUserId, now);
  try {
    const state = await getState(storage, workspaceUserId, now);
    const windowKey = weeklyWindowKey(now);
    if (!options.force && state.lastWindowKey === windowKey) {
      const skipped = {
        ...state,
        lastStatus: "skipped" as const,
      };
      await saveState(storage, skipped);
      return { status: "skipped", reason: "already_completed_for_window", state: skipped };
    }

    try {
      const backup = await createWorkspaceBackup(storage, workspaceUserId, {
        passphrase: options.passphrase,
        manual: false,
        now,
      });
      const preview = previewWorkspaceBackup(backup, workspaceUserId, options.passphrase);
      const recordId = `auto_${windowKey}_${crypto.randomUUID().slice(0, 8)}`;
      const storageKey = `automatic/${workspaceUserId}/${recordId}.breedlogbackup.json`;
      await adapter.putObject(storageKey, JSON.stringify(backup), "application/json");
      const record: StoredBackupRecord = {
        recordId,
        workspaceUserId,
        backupType: "automatic",
        exportedAt: backup.exportedAt,
        storageKey,
        checksum: checksumForBackup(backup),
        preview,
      };
      await saveRecord(storage, record);
      await applyRetention(storage, adapter, workspaceUserId);
      const nextRunAt = nextWeeklyRun(now).toISOString();
      const successState: AutomaticBackupJobState = {
        ...state,
        lastWindowKey: windowKey,
        lastRunAt: now.toISOString(),
        lastSuccessAt: now.toISOString(),
        lastStatus: "success",
        nextRunAt,
        retryCount: 0,
        retryAfter: undefined,
        lastError: undefined,
        lastBackupRecordId: recordId,
      };
      await saveState(storage, successState);
      await recordAudit(storage, workspaceUserId, "backup.automatic.success", undefined, { recordId, storageKey, provider: adapter.provider });
      return { status: "success", state: successState, record };
    } catch (error: any) {
      const failedState: AutomaticBackupJobState = {
        ...state,
        lastRunAt: now.toISOString(),
        lastFailureAt: now.toISOString(),
        lastStatus: "failed",
        retryCount: state.retryCount + 1,
        retryAfter: new Date(now.getTime() + Math.min(60, state.retryCount + 1) * 60 * 1000).toISOString(),
        nextRunAt: state.nextRunAt,
        lastError: error?.message ?? "Unknown automatic backup failure",
      };
      await saveState(storage, failedState);
      await recordAudit(storage, workspaceUserId, "backup.automatic.failed", failedState.lastError, { provider: adapter.provider });
      throw error;
    }
  } finally {
    await releaseLock(storage, workspaceUserId);
  }
}

export async function getAutomaticBackupStatus(storage: IStorage, workspaceUserId: string): Promise<{ state: AutomaticBackupJobState; records: StoredBackupRecord[] }> {
  return {
    state: await getState(storage, workspaceUserId),
    records: await listRecords(storage, workspaceUserId),
  };
}

export async function runAutomaticBackupSweep(
  storage: IStorage,
  adapter: BackupStorageAdapter,
  options: { now?: Date; workspaceUserIds?: string[] } = {},
) {
  const workspaceUserIds = options.workspaceUserIds ?? await storage.listWorkspaceUserIds();
  const results: Array<{ workspaceUserId: string; status: "success" | "skipped" | "failed"; reason?: string }> = [];
  for (const workspaceUserId of workspaceUserIds) {
    try {
      const result = await runAutomaticBackupForWorkspace(storage, adapter, workspaceUserId, { now: options.now });
      results.push({ workspaceUserId, status: result.status, reason: result.reason });
    } catch (error: any) {
      results.push({ workspaceUserId, status: "failed", reason: error?.message ?? "Unknown failure" });
    }
  }
  return results;
}
