import crypto from "crypto";
import type { IStorage } from "./storage";
import { reserveUsage } from "./commercial";

export const BREEDLOG_BACKUP_FORMAT = "breedlog.encrypted-workspace-backup";
export const BREEDLOG_BACKUP_VERSION = 1;

export class BackupRejectedError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackupRejectedError";
  }
}

type BackupPlaintext = {
  format: typeof BREEDLOG_BACKUP_FORMAT;
  version: number;
  ownerBindingHash: string;
  exportedAt: string;
  workspace: Awaited<ReturnType<typeof collectWorkspace>>;
};

export type EncryptedBreedLogBackup = {
  format: typeof BREEDLOG_BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  ownerBindingHash: string;
  encryption: {
    algorithm: "aes-256-gcm";
    keyDerivation: "scrypt";
    salt: string;
    iv: string;
    authTag: string;
  };
  integrity: {
    plaintextSha256: string;
    ciphertextSha256: string;
  };
  ciphertext: string;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function ownerBindingHash(accountId: string): string {
  return crypto.createHash("sha256").update(`breedlog-owner:${accountId}`).digest("hex");
}

function deriveKey(accountId: string, salt: Buffer, passphrase?: string): Buffer {
  const productionSecret = process.env.BACKUP_MASTER_KEY;
  if (process.env.NODE_ENV === "production" && !productionSecret) {
    throw new BackupRejectedError("BACKUP_MASTER_KEY_REQUIRED", "Production backups require BACKUP_MASTER_KEY.");
  }
  const material = `${productionSecret ?? "breedlog-development-backup-key"}:${accountId}:${passphrase ?? ""}`;
  return crypto.scryptSync(material, salt, 32);
}

async function collectWorkspace(storage: IStorage, accountId: string) {
  const animals = await storage.getAnimals(accountId, {});
  const animalImages = (await Promise.all(animals.map((animal) => storage.getAnimalImages(accountId, animal.id)))).flat();
  const flockEvents = await storage.getFlockHealthEvents(accountId);
  const flockTreatments = (await Promise.all(flockEvents.map((event) => storage.getFlockHealthTreatments(accountId, event.id)))).flat();
  return {
    animals,
    breedingEvents: await storage.getBreedingEvents(accountId),
    matingGroups: await storage.getMatingGroups(accountId),
    performanceRecords: await storage.getAllPerformanceRecords(accountId),
    healthRecords: await storage.getAllHealthRecords(accountId),
    farmSettings: await storage.getFarmSettings(accountId),
    documents: await storage.getDocuments(accountId),
    animalImages,
    exportedDocuments: await storage.getExportedDocuments(accountId),
    flockHealthEvents: flockEvents,
    flockHealthTreatments: flockTreatments,
    bloodlines: await storage.getBloodlines(accountId),
    geneticLines: await storage.getGeneticLines(accountId),
  };
}

export async function createWorkspaceBackup(
  storage: IStorage,
  accountId: string,
  options: { passphrase?: string; manual?: boolean; now?: Date } = {},
): Promise<EncryptedBreedLogBackup> {
  const now = options.now ?? new Date();
  if (options.manual) {
    await reserveUsage(storage, accountId, "manualBackups", now);
  }
  const plaintext: BackupPlaintext = {
    format: BREEDLOG_BACKUP_FORMAT,
    version: BREEDLOG_BACKUP_VERSION,
    ownerBindingHash: ownerBindingHash(accountId),
    exportedAt: now.toISOString(),
    workspace: await collectWorkspace(storage, accountId),
  };
  const serialized = stableStringify(plaintext);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(accountId, salt, options.passphrase);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    format: BREEDLOG_BACKUP_FORMAT,
    version: BREEDLOG_BACKUP_VERSION,
    exportedAt: plaintext.exportedAt,
    ownerBindingHash: plaintext.ownerBindingHash,
    encryption: {
      algorithm: "aes-256-gcm",
      keyDerivation: "scrypt",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    },
    integrity: {
      plaintextSha256: crypto.createHash("sha256").update(serialized).digest("hex"),
      ciphertextSha256: crypto.createHash("sha256").update(ciphertext).digest("hex"),
    },
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptWorkspaceBackup(
  backup: EncryptedBreedLogBackup,
  accountId: string,
  passphrase?: string,
): BackupPlaintext {
  if (backup.format !== BREEDLOG_BACKUP_FORMAT || backup.version !== BREEDLOG_BACKUP_VERSION) {
    throw new BackupRejectedError("UNSUPPORTED_BACKUP_VERSION", "Unsupported BreedLog backup format or version.");
  }
  if (backup.ownerBindingHash !== ownerBindingHash(accountId)) {
    throw new BackupRejectedError("WRONG_ACCOUNT", "This .breedlogbackup belongs to a different account/workspace.");
  }
  const ciphertext = Buffer.from(backup.ciphertext, "base64");
  const actualCipherHash = crypto.createHash("sha256").update(ciphertext).digest("hex");
  if (actualCipherHash !== backup.integrity.ciphertextSha256) {
    throw new BackupRejectedError("CORRUPTED_BACKUP", "Backup ciphertext integrity check failed.");
  }
  const key = deriveKey(accountId, Buffer.from(backup.encryption.salt, "base64"), passphrase);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(backup.encryption.iv, "base64"));
    decipher.setAuthTag(Buffer.from(backup.encryption.authTag, "base64"));
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    if (crypto.createHash("sha256").update(plaintext).digest("hex") !== backup.integrity.plaintextSha256) {
      throw new BackupRejectedError("CORRUPTED_BACKUP", "Backup plaintext integrity check failed.");
    }
    const parsed = JSON.parse(plaintext) as BackupPlaintext;
    if (parsed.ownerBindingHash !== ownerBindingHash(accountId)) {
      throw new BackupRejectedError("WRONG_ACCOUNT", "Backup owner binding does not match this account.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof BackupRejectedError) throw error;
    throw new BackupRejectedError("CORRUPTED_BACKUP", "Backup could not be decrypted or authenticated.");
  }
}

export function previewWorkspaceBackup(backup: EncryptedBreedLogBackup, accountId: string, passphrase?: string) {
  const plaintext = decryptWorkspaceBackup(backup, accountId, passphrase);
  const workspace = plaintext.workspace;
  return {
    exportedAt: plaintext.exportedAt,
    animalCount: workspace.animals.length,
    breedingEventCount: workspace.breedingEvents.length,
    healthRecordCount: workspace.healthRecords.length,
    performanceRecordCount: workspace.performanceRecords.length,
    documentCount: workspace.documents.length,
    exportedDocumentCount: workspace.exportedDocuments.length,
  };
}

export async function restoreWorkspaceBackup(
  storage: IStorage,
  accountId: string,
  backup: EncryptedBreedLogBackup,
  options: { passphrase?: string; confirmOverwrite?: boolean } = {},
) {
  if (!options.confirmOverwrite) {
    throw new BackupRejectedError("OVERWRITE_CONFIRMATION_REQUIRED", "Restore requires explicit overwrite confirmation.");
  }
  const plaintext = decryptWorkspaceBackup(backup, accountId, options.passphrase);
  const workspace = plaintext.workspace;
  await storage.clearAllData(accountId);
  const idMap = new Map<number, number>();

  for (const original of workspace.animals) {
    const { id, userId: _userId, createdAt: _createdAt, vectorClock: _vectorClock, lastSyncedAt: _lastSyncedAt, ...insertable } = original as any;
    const created = await storage.createAnimal(accountId, { ...insertable, sireId: null, damId: null, createdAt: _createdAt });
    idMap.set(id, created.id);
  }
  for (const original of workspace.animals) {
    const createdId = idMap.get(original.id);
    if (!createdId) continue;
    const sireId = original.sireId ? idMap.get(original.sireId) ?? null : null;
    const damId = original.damId ? idMap.get(original.damId) ?? null : null;
    if (sireId || damId) await storage.updateAnimal(accountId, createdId, { sireId, damId });
  }
  if (workspace.farmSettings) {
    const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...settings } = workspace.farmSettings as any;
    await storage.saveFarmSettings(accountId, settings);
  }
  for (const record of workspace.performanceRecords) {
    const { id: _id, userId: _userId, ...insertable } = record as any;
    const animalId = idMap.get(record.animalId);
    if (animalId) await storage.createPerformanceRecord(accountId, { ...insertable, animalId });
  }
  for (const record of workspace.healthRecords) {
    const { id: _id, userId: _userId, ...insertable } = record as any;
    const animalId = idMap.get(record.animalId);
    if (animalId) await storage.createHealthRecord(accountId, { ...insertable, animalId });
  }
  for (const doc of workspace.documents) {
    const { id: _id, userId: _userId, createdAt: _createdAt, vectorClock: _vectorClock, lastSyncedAt: _lastSyncedAt, ...insertable } = doc as any;
    await storage.createDocument(accountId, { ...insertable, animalId: insertable.animalId ? idMap.get(insertable.animalId) ?? null : null });
  }
  for (const doc of workspace.exportedDocuments) {
    const { id: _id, userId: _userId, exportedAt: _exportedAt, ...insertable } = doc as any;
    await storage.createExportedDocument(accountId, { ...insertable, animalId: insertable.animalId ? idMap.get(insertable.animalId) ?? null : null });
  }
  return previewWorkspaceBackup(backup, accountId, options.passphrase);
}
