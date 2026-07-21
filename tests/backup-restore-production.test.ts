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
  const lamb = await storage.createAnimal(userId, {
    tagId: "CERT-0003",
    name: "Backup Lamb",
    sex: "ewe",
    status: "active",
    birthDate: "2026-07-10",
  });
  await storage.updateAnimal(userId, ewe.id, { sireId: ram.id });
  const matingGroup = await storage.createMatingGroup(userId, {
    name: "July Group",
    ramId: ram.id,
    eweIds: [ewe.id],
    dateIn: "2026-06-01",
    dateOut: "2026-06-30",
    lambingSeason: "26A",
    notes: "Restore proof group",
  });
  const breedingEvent = await storage.createBreedingEvent(userId, {
    eweId: ewe.id,
    ramId: ram.id,
    matingGroupId: matingGroup.id,
    matingDate: "2026-06-02",
    matingType: "natural",
    lambingDate: "2026-07-10",
    lambCount: 1,
    notes: "Restore proof event",
  });
  await storage.createOffspring(userId, {
    breedingEventId: breedingEvent.id,
    lambId: lamb.id,
  });
  await storage.createHealthRecord(userId, {
    animalId: ewe.id,
    date: "2026-07-01",
    treatment: "Vaccination",
    notes: "Certification restore proof",
  });
  await storage.createEvaluation(userId, {
    animalId: ewe.id,
    date: "2026-07-01",
    evaluator: "manual",
    headScore: 5,
    frontScore: 5,
    middleScore: 4,
    rearScore: 5,
    overallType: "Euro",
    comments: "Restore proof evaluation",
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
  await storage.createAnimalImage(userId, {
    animalId: ewe.id,
    fileName: "backup-ewe.jpg",
    imageData: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
    caption: "Restore proof image",
  });
  const flockEvent = await storage.createFlockHealthEvent(userId, {
    eventName: "Vaccination Day",
    eventType: "vaccination",
    eventDate: "2026-07-03",
    productName: "Multivax",
    route: "subcutaneous",
    dose: "2ml",
    notes: "Whole flock proof",
  });
  await storage.createFlockHealthTreatments(userId, [{
    eventId: flockEvent.id,
    animalId: ewe.id,
    quantity: "2",
    route: "subcutaneous",
    notes: "Ewe treated",
  }]);
  const bloodline = await storage.createBloodline(userId, {
    name: "Cert Foundation",
    type: "foundation_line",
    foundationAnimalId: ram.id,
    status: "active",
    evidenceStatus: "proven",
    notes: "Restore proof bloodline",
  });
  const geneticLine = await storage.createGeneticLine(userId, {
    lineName: "Growth Focus",
    lineGoal: "Improve post-weaning growth",
    activeStatus: true,
  });
  await storage.setAnimalBloodline(userId, {
    animalId: lamb.id,
    bloodlineId: bloodline.id,
    geneticLineId: geneticLine.id,
    role: "primary",
    sourceConfidence: "known",
  });

  const backup = await createWorkspaceBackup(storage, userId, {
    passphrase: "correct horse staple",
    now: new Date("2026-07-13T10:00:00Z"),
  });
  assert.equal(backup.format, "breedlog.encrypted-workspace-backup");
  assert.notEqual(backup.ciphertext.includes("Backup Ewe"), true);
  assert.deepEqual(previewWorkspaceBackup(backup, userId, "correct horse staple"), {
    exportedAt: "2026-07-13T10:00:00.000Z",
    animalCount: 3,
    breedingEventCount: 1,
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
  assert.equal(restoredAnimals.length, 3);
  const restoredEwe = restoredAnimals.find((animal) => animal.name === "Backup Ewe");
  const restoredRam = restoredAnimals.find((animal) => animal.name === "Backup Ram");
  const restoredLamb = restoredAnimals.find((animal) => animal.name === "Backup Lamb");
  assert.ok(restoredEwe);
  assert.ok(restoredRam);
  assert.ok(restoredLamb);
  assert.equal(restoredEwe.sireId, restoredRam.id);
  assert.equal((await storage.getAllHealthRecords(userId)).length, 1);
  assert.equal((await storage.getEvaluations(userId, restoredEwe.id)).length, 1);
  assert.equal((await storage.getAllPerformanceRecords(userId)).length, 1);
  assert.equal((await storage.getExportedDocuments(userId)).length, 1);
  assert.equal((await storage.getAnimalImages(userId, restoredEwe.id)).length, 1);
  assert.equal((await storage.getMatingGroups(userId)).length, 1);
  const restoredBreedingEvents = await storage.getBreedingEvents(userId);
  assert.equal(restoredBreedingEvents.length, 1);
  const restoredOffspring = await storage.getOffspringByBreedingEvent(userId, restoredBreedingEvents[0].id);
  assert.equal(restoredOffspring.length, 1);
  assert.equal(restoredOffspring[0].lambId, restoredLamb.id);
  const restoredFlockEvents = await storage.getFlockHealthEvents(userId);
  assert.equal(restoredFlockEvents.length, 1);
  assert.equal((await storage.getFlockHealthTreatments(userId, restoredFlockEvents[0].id)).length, 1);
  const restoredBloodlines = await storage.getBloodlines(userId);
  const restoredGeneticLines = await storage.getGeneticLines(userId);
  assert.equal(restoredBloodlines.length, 1);
  assert.equal(restoredGeneticLines.length, 1);
  const restoredAssignments = await storage.getAnimalBloodlines(userId, restoredLamb.id);
  assert.equal(restoredAssignments.length, 1);
  assert.equal(restoredAssignments[0].bloodlineId, restoredBloodlines[0].id);
  assert.equal(restoredAssignments[0].geneticLineId, restoredGeneticLines[0].id);
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
