import assert from "node:assert/strict";
import test from "node:test";
import { createWorkspaceBackup, restoreWorkspaceBackup } from "../server/backup";
import { applyBillingEvent, projectDowngradedAnimalVisibility } from "../server/commercial";
import { storage } from "../server/storage";

function animal(index: number, createdAt: string) {
  return {
    tagId: `DG-${String(index).padStart(4, "0")}`,
    name: `Downgrade Animal ${index}`,
    sex: index % 2 === 0 ? "ewe" : "ram",
    status: "active",
    createdAt: new Date(createdAt),
  } as const;
}

test("downgrade, repeated restoration, and backup restore keep the first 30 animals in immutable creation order", async () => {
  const userId = "downgrade-restore-cert";
  await storage.clearAllData(userId);
  await applyBillingEvent(storage, {
    provider: "test-provider",
    providerEventId: "evt-downgrade-restore-created",
    accountId: userId,
    eventType: "subscription.created",
    planId: "premium",
    effectiveAt: "2026-07-01T00:00:00.000Z",
  });

  const created: Awaited<ReturnType<typeof storage.createAnimal>>[] = [];
  for (let index = 1; index <= 40; index += 1) {
    const createdAt = new Date(Date.UTC(2026, 0, index, 0, 0, 0)).toISOString();
    created.push(await storage.createAnimal(userId, animal(index, createdAt) as any));
  }

  await storage.updateAnimal(userId, created[31].id, { sireId: created[0].id, damId: created[1].id });
  await storage.createHealthRecord(userId, {
    animalId: created[31].id,
    date: "2026-07-03",
    type: "treatment",
    treatment: "Hidden animal treatment",
  });
  await storage.createPerformanceRecord(userId, {
    animalId: created[31].id,
    date: "2026-07-04",
    type: "weighing",
    weight: "61.2",
  });

  const downgradeEvent = {
    provider: "test-provider",
    providerEventId: "evt-downgrade-restore-refund",
    accountId: userId,
    eventType: "subscription.refunded" as const,
    planId: "premium" as const,
    effectiveAt: "2026-07-20T00:00:00.000Z",
  };
  await applyBillingEvent(storage, downgradeEvent);
  let projection = projectDowngradedAnimalVisibility(await storage.getAnimals(userId, {}));
  assert.deepEqual(
    projection.visible.slice(0, 30).map((row) => row.tagId),
    Array.from({ length: 30 }, (_, index) => `DG-${String(index + 1).padStart(4, "0")}`),
  );
  assert.equal(projection.hidden.length, 10);

  await applyBillingEvent(storage, {
    provider: "test-provider",
    providerEventId: "evt-downgrade-restore-reactivate",
    accountId: userId,
    eventType: "subscription.created",
    planId: "premium",
    effectiveAt: "2026-07-21T00:00:00.000Z",
  });
  await applyBillingEvent(storage, {
    ...downgradeEvent,
    providerEventId: "evt-downgrade-restore-refund-2",
    effectiveAt: "2026-07-22T00:00:00.000Z",
  });
  projection = projectDowngradedAnimalVisibility(await storage.getAnimals(userId, {}));
  assert.deepEqual(
    projection.visible.slice(0, 30).map((row) => row.tagId),
    Array.from({ length: 30 }, (_, index) => `DG-${String(index + 1).padStart(4, "0")}`),
  );

  const backup = await createWorkspaceBackup(storage, userId, {
    passphrase: "downgrade-pass",
    now: new Date("2026-07-23T00:00:00.000Z"),
  });
  await storage.clearAllData(userId);
  await restoreWorkspaceBackup(storage, userId, backup, {
    passphrase: "downgrade-pass",
    confirmOverwrite: true,
  });

  const restoredAnimals = await storage.getAnimals(userId, {});
  const restoredProjection = projectDowngradedAnimalVisibility(restoredAnimals);
  assert.equal(restoredAnimals.length, 40);
  assert.deepEqual(
    restoredProjection.visible.slice(0, 30).map((row) => row.tagId),
    Array.from({ length: 30 }, (_, index) => `DG-${String(index + 1).padStart(4, "0")}`),
  );
  assert.equal((await storage.getAllHealthRecords(userId)).length, 1);
  assert.equal((await storage.getAllPerformanceRecords(userId)).length, 1);
  const restoredHidden = restoredAnimals.find((animalRow) => animalRow.tagId === "DG-0032");
  assert.ok(restoredHidden);
  assert.equal(restoredHidden.sireId != null, true);
  assert.equal(restoredHidden.damId != null, true);
});
