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
  const animalBloodlines = (await Promise.all(animals.map((animal) => storage.getAnimalBloodlines(accountId, animal.id)))).flat();
  const breedingEvents = await storage.getBreedingEvents(accountId);
  const offspring = (await Promise.all(breedingEvents.map((event) => storage.getOffspringByBreedingEvent(accountId, event.id)))).flat();
  const flockEvents = await storage.getFlockHealthEvents(accountId);
  const flockTreatments = (await Promise.all(flockEvents.map((event) => storage.getFlockHealthTreatments(accountId, event.id)))).flat();
  return {
    animals,
    breedingEvents,
    offspring,
    matingGroups: await storage.getMatingGroups(accountId),
    performanceRecords: await storage.getAllPerformanceRecords(accountId),
    healthRecords: await storage.getAllHealthRecords(accountId),
    evaluations: (await Promise.all(animals.map((animal) => storage.getEvaluations(accountId, animal.id)))).flat(),
    farmSettings: await storage.getFarmSettings(accountId),
    documents: await storage.getDocuments(accountId),
    animalImages,
    exportedDocuments: await storage.getExportedDocuments(accountId),
    flockHealthEvents: flockEvents,
    flockHealthTreatments: flockTreatments,
    bloodlines: await storage.getBloodlines(accountId),
    geneticLines: await storage.getGeneticLines(accountId),
    animalBloodlines,
  };
}

async function restoreWorkspaceSnapshot(
  storage: IStorage,
  accountId: string,
  workspace: Awaited<ReturnType<typeof collectWorkspace>>,
) {
  const animalIdMap = new Map<number, number>();
  const matingGroupIdMap = new Map<number, number>();
  const breedingEventIdMap = new Map<number, number>();
  const flockEventIdMap = new Map<number, number>();
  const bloodlineIdMap = new Map<number, number>();
  const geneticLineIdMap = new Map<number, number>();

  for (const original of workspace.animals) {
    const { id, userId: _userId, createdAt: _createdAt, vectorClock: _vectorClock, lastSyncedAt: _lastSyncedAt, ...insertable } = original as any;
    const created = await storage.createAnimal(accountId, { ...insertable, sireId: null, damId: null, createdAt: _createdAt });
    animalIdMap.set(id, created.id);
  }
  for (const original of workspace.animals) {
    const createdId = animalIdMap.get(original.id);
    if (!createdId) continue;
    const sireId = original.sireId ? animalIdMap.get(original.sireId) ?? null : null;
    const damId = original.damId ? animalIdMap.get(original.damId) ?? null : null;
    if (sireId || damId) {
      await storage.updateAnimal(accountId, createdId, { sireId, damId });
    }
  }
  if (workspace.farmSettings) {
    const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...settings } = workspace.farmSettings as any;
    await storage.saveFarmSettings(accountId, settings);
  }
  for (const group of workspace.matingGroups) {
    const { id, userId: _userId, ...insertable } = group as any;
    const created = await storage.createMatingGroup(accountId, {
      ...insertable,
      ramId: insertable.ramId ? animalIdMap.get(insertable.ramId) ?? null : null,
      eweIds: Array.isArray(insertable.eweIds) ? insertable.eweIds.map((eweId: number) => animalIdMap.get(eweId)).filter(Boolean) : [],
    });
    matingGroupIdMap.set(id, created.id);
  }
  for (const event of workspace.breedingEvents) {
    const { id, userId: _userId, clientId: _clientId, vectorClock: _vectorClock, lastSyncedAt: _lastSyncedAt, ...insertable } = event as any;
    const eweId = animalIdMap.get(event.eweId);
    const ramId = animalIdMap.get(event.ramId);
    if (!eweId || !ramId) continue;
    const created = await storage.createBreedingEvent(accountId, {
      ...insertable,
      eweId,
      ramId,
      matingGroupId: insertable.matingGroupId ? matingGroupIdMap.get(insertable.matingGroupId) ?? null : null,
    });
    breedingEventIdMap.set(id, created.id);
  }
  for (const child of workspace.offspring ?? []) {
    const { id: _id, userId: _userId, ...insertable } = child as any;
    const breedingEventId = breedingEventIdMap.get(insertable.breedingEventId);
    const lambId = insertable.lambId ? animalIdMap.get(insertable.lambId) ?? null : null;
    if (!breedingEventId || !lambId) continue;
    await storage.createOffspring(accountId, {
      ...insertable,
      breedingEventId,
      lambId,
    });
  }
  for (const record of workspace.performanceRecords) {
    const { id: _id, userId: _userId, ...insertable } = record as any;
    const animalId = animalIdMap.get(record.animalId);
    if (animalId) await storage.createPerformanceRecord(accountId, { ...insertable, animalId });
  }
  for (const record of workspace.healthRecords) {
    const { id: _id, userId: _userId, ...insertable } = record as any;
    const animalId = animalIdMap.get(record.animalId);
    if (animalId) await storage.createHealthRecord(accountId, { ...insertable, animalId });
  }
  for (const evaluation of workspace.evaluations ?? []) {
    const { id: _id, userId: _userId, ...insertable } = evaluation as any;
    const animalId = animalIdMap.get(evaluation.animalId);
    if (animalId) await storage.createEvaluation(accountId, { ...insertable, animalId });
  }
  for (const doc of workspace.documents) {
    const { id: _id, userId: _userId, createdAt: _createdAt, vectorClock: _vectorClock, lastSyncedAt: _lastSyncedAt, ...insertable } = doc as any;
    await storage.createDocument(accountId, { ...insertable, animalId: insertable.animalId ? animalIdMap.get(insertable.animalId) ?? null : null });
  }
  for (const image of workspace.animalImages) {
    const { id: _id, userId: _userId, uploadedAt: _uploadedAt, ...insertable } = image as any;
    const animalId = animalIdMap.get(image.animalId);
    if (animalId) {
      await storage.createAnimalImage(accountId, { ...insertable, animalId });
    }
  }
  for (const doc of workspace.exportedDocuments) {
    const { id: _id, userId: _userId, exportedAt: _exportedAt, ...insertable } = doc as any;
    await storage.createExportedDocument(accountId, { ...insertable, animalId: insertable.animalId ? animalIdMap.get(insertable.animalId) ?? null : null });
  }
  for (const event of workspace.flockHealthEvents) {
    const { id, userId: _userId, createdAt: _createdAt, ...insertable } = event as any;
    const created = await storage.createFlockHealthEvent(accountId, insertable);
    flockEventIdMap.set(id, created.id);
  }
  for (const treatment of workspace.flockHealthTreatments) {
    const { id: _id, userId: _userId, ...insertable } = treatment as any;
    const eventId = flockEventIdMap.get(insertable.eventId);
    if (!eventId) continue;
    await storage.createFlockHealthTreatments(accountId, [{
      ...insertable,
      eventId,
      animalId: insertable.animalId ? animalIdMap.get(insertable.animalId) ?? null : null,
    }]);
  }
  for (const bloodline of workspace.bloodlines) {
    const { id, userId: _userId, createdAt: _createdAt, ...insertable } = bloodline as any;
    const created = await storage.createBloodline(accountId, {
      ...insertable,
      foundationAnimalId: insertable.foundationAnimalId ? animalIdMap.get(insertable.foundationAnimalId) ?? null : null,
    });
    bloodlineIdMap.set(id, created.id);
  }
  for (const line of workspace.geneticLines) {
    const { id, userId: _userId, createdAt: _createdAt, ...insertable } = line as any;
    const created = await storage.createGeneticLine(accountId, insertable);
    geneticLineIdMap.set(id, created.id);
  }
  for (const assignment of workspace.animalBloodlines ?? []) {
    const { id: _id, userId: _userId, assignedAt: _assignedAt, ...insertable } = assignment as any;
    const animalId = animalIdMap.get(insertable.animalId);
    const bloodlineId = bloodlineIdMap.get(insertable.bloodlineId);
    if (!animalId || !bloodlineId) continue;
    await storage.setAnimalBloodline(accountId, {
      ...insertable,
      animalId,
      bloodlineId,
      geneticLineId: insertable.geneticLineId ? geneticLineIdMap.get(insertable.geneticLineId) ?? null : null,
    });
  }
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
  const currentWorkspace = await collectWorkspace(storage, accountId);
  await storage.clearAllData(accountId);
  try {
    await restoreWorkspaceSnapshot(storage, accountId, workspace);
  } catch (error) {
    await storage.clearAllData(accountId);
    try {
      await restoreWorkspaceSnapshot(storage, accountId, currentWorkspace);
    } catch (rollbackError: any) {
      throw new BackupRejectedError(
        "RESTORE_ROLLBACK_FAILED",
        `Restore failed and rollback was unsuccessful: ${rollbackError?.message ?? "unknown rollback failure"}.`,
      );
    }
    throw error;
  }
  return previewWorkspaceBackup(backup, accountId, options.passphrase);
}
