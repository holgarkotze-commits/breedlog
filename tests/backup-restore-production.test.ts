import assert from "node:assert/strict";
import test from "node:test";
import {
  BackupRejectedError,
  createWorkspaceBackup,
  previewWorkspaceBackup,
  restoreWorkspaceBackup,
  type EncryptedBreedLogBackup,
} from "../server/backup";
import { storage } from "../server/storage";

test("encrypted .breedlogbackup survives reset and restores exact workspace records", async () => {
  const userId = "backup-round-trip";
  await storage.clearAllData(userId);
  await storage.saveFarmSettings(userId, {
    farmName: "Certification Farm",
    studName: "Cert Stud",
    studPrefix: "CERT",
  });
  const ewe = await storage.createAnimal(userId, {
    tagId: "CERT-0001",
    name: "Backup Ewe",
    sex: "ewe",
    status: "active",
    birthDate: "2024-04-10",
  });
  const ram = await storage.createAnimal(userId, {
    tagId: "CERT-0002",
    name: "Backup Ram",
    sex: "ram",
    status: "active",
  });
  await storage.updateAnimal(userId, ewe.id, { sireId: ram.id });
  await storage.createHealthRecord(userId, {
    animalId: ewe.id,
    date: "2026-07-01",
    treatment: "Vaccination",
    notes: "Certification restore proof",
  });
  await storage.createPerformanceRecord(userId, {
    animalId: ewe.id,
    date: "2026-07-02",
    weight: "64.5",
    type: "ad-hoc",
  });
  await storage.createExportedDocument(userId, {
    name: "CERT-0001.pdf",
    documentType: "individual",
    subfolder: "individual",
    animalId: ewe.id,
    metadata: { purpose: "backup-certification" },
  });

  const backup = await createWorkspaceBackup(storage, userId, {
    passphrase: "correct horse staple",
    now: new Date("2026-07-13T10:00:00Z"),
  });
  assert.equal(backup.format, "breedlog.encrypted-workspace-backup");
  assert.notEqual(backup.ciphertext.includes("Backup Ewe"), true);
  assert.deepEqual(previewWorkspaceBackup(backup, userId, "correct horse staple"), {
    exportedAt: "2026-07-13T10:00:00.000Z",
    animalCount: 2,
    breedingEventCount: 0,
    healthRecordCount: 1,
    performanceRecordCount: 1,
    documentCount: 0,
    exportedDocumentCount: 1,
  });

  await storage.clearAllData(userId);
  assert.equal((await storage.getAnimals(userId, {})).length, 0);
  await restoreWorkspaceBackup(storage, userId, backup, {
    passphrase: "correct horse staple",
    confirmOverwrite: true,
  });
  const restoredAnimals = await storage.getAnimals(userId, {});
  assert.equal(restoredAnimals.length, 2);
  const restoredEwe = restoredAnimals.find((animal) => animal.name === "Backup Ewe");
  const restoredRam = restoredAnimals.find((animal) => animal.name === "Backup Ram");
  assert.ok(restoredEwe);
  assert.ok(restoredRam);
  assert.equal(restoredEwe.sireId, restoredRam.id);
  assert.equal((await storage.getAllHealthRecords(userId)).length, 1);
  assert.equal((await storage.getAllPerformanceRecords(userId)).length, 1);
  assert.equal((await storage.getExportedDocuments(userId)).length, 1);
  assert.equal((await storage.getFarmSettings(userId))?.farmName, "Certification Farm");
});

test("backup restore rejects wrong account, corrupted ciphertext, and missing overwrite confirmation", async () => {
  const userId = "backup-owner";
  await storage.clearAllData(userId);
  await storage.createAnimal(userId, {
    tagId: "OWNER-0001",
    name: "Owner Animal",
    sex: "ewe",
    status: "active",
  });
  const backup = await createWorkspaceBackup(storage, userId, { passphrase: "owner-pass" });

  assert.throws(
    () => previewWorkspaceBackup(backup, "other-account", "owner-pass"),
    (error) => error instanceof BackupRejectedError && error.code === "WRONG_ACCOUNT",
  );

  await assert.rejects(
    () => restoreWorkspaceBackup(storage, userId, backup, { passphrase: "owner-pass" }),
    (error) => error instanceof BackupRejectedError && error.code === "OVERWRITE_CONFIRMATION_REQUIRED",
  );

  const corrupted: EncryptedBreedLogBackup = {
    ...backup,
    ciphertext: `${backup.ciphertext.slice(0, -4)}AAAA`,
  };
  assert.throws(
    () => previewWorkspaceBackup(corrupted, userId, "owner-pass"),
    (error) => error instanceof BackupRejectedError && error.code === "CORRUPTED_BACKUP",
  );
});
