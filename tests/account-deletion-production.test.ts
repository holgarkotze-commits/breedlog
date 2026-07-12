import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountDeletionError,
  cancelAccountDeletion,
  completeExpiredAccountDeletion,
  getAccountDeletionState,
  requestAccountDeletion,
} from "../server/account-deletion";
import { previewWorkspaceBackup } from "../server/backup";
import { storage } from "../server/storage";

test("account deletion requires exact confirmation and creates 30-day recovery state", async () => {
  const userId = "account-delete-confirmation";
  await storage.clearAllData(userId);
  await assert.rejects(
    () => requestAccountDeletion(storage, userId, { typedConfirmation: "DELETE" }),
    (error) => error instanceof AccountDeletionError && error.code === "CONFIRMATION_REQUIRED",
  );

  const result = await requestAccountDeletion(storage, userId, {
    typedConfirmation: "DELETE MY BREEDLOG ACCOUNT",
    now: new Date("2026-07-13T00:00:00Z"),
  });
  assert.equal(result.backup, null);
  assert.equal(result.state.status, "pending");
  assert.equal(result.state.recoveryUntil, "2026-08-12T00:00:00.000Z");
  assert.equal((await getAccountDeletionState(storage, userId)).status, "pending");
});

test("account deletion can export encrypted backup before deletion and be cancelled", async () => {
  const userId = "account-delete-backup-cancel";
  await storage.clearAllData(userId);
  await storage.createAnimal(userId, {
    tagId: "DEL-001",
    name: "Deletion Backup Ewe",
    sex: "ewe",
    status: "active",
  });

  const result = await requestAccountDeletion(storage, userId, {
    typedConfirmation: "DELETE MY BREEDLOG ACCOUNT",
    exportBeforeDeletion: true,
    passphrase: "delete-pass",
    now: new Date("2026-07-13T00:00:00Z"),
  });
  assert.ok(result.backup);
  assert.equal(previewWorkspaceBackup(result.backup, userId, "delete-pass").animalCount, 1);

  const cancelled = await cancelAccountDeletion(storage, userId, new Date("2026-07-14T00:00:00Z"));
  assert.equal(cancelled.status, "cancelled");
  assert.equal((await storage.getAnimals(userId, {})).length, 1);
});

test("expired deletion completion clears workspace data after recovery window", async () => {
  const userId = "account-delete-complete";
  await storage.clearAllData(userId);
  await storage.createAnimal(userId, {
    tagId: "DEL-002",
    name: "Deletion Complete Ram",
    sex: "ram",
    status: "active",
  });
  await requestAccountDeletion(storage, userId, {
    typedConfirmation: "DELETE MY BREEDLOG ACCOUNT",
    now: new Date("2026-07-13T00:00:00Z"),
  });
  await assert.rejects(
    () => completeExpiredAccountDeletion(storage, userId, new Date("2026-08-01T00:00:00Z")),
    (error) => error instanceof AccountDeletionError && error.code === "RECOVERY_WINDOW_ACTIVE",
  );
  const completed = await completeExpiredAccountDeletion(storage, userId, new Date("2026-08-13T00:00:00Z"));
  assert.equal(completed.status, "completed");
  assert.equal((await storage.getAnimals(userId, {})).length, 0);
});
