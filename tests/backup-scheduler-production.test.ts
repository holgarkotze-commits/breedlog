import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { LocalFilesystemBackupStorageAdapter } from "../server/backup-storage";
import { getAutomaticBackupStatus, runAutomaticBackupForWorkspace, runAutomaticBackupSweep } from "../server/backup-jobs";
import { storage } from "../server/storage";
import { setEntitlementState } from "../server/commercial";

async function createTempAdapter() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "breedlog-backup-test-"));
  return {
    root,
    adapter: new LocalFilesystemBackupStorageAdapter(root),
    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

test("automatic backup worker is idempotent within a weekly window", async () => {
  const { adapter, cleanup } = await createTempAdapter();
  try {
    const workspaceUserId = (await storage.createWorkspaceUser("auto-backup-idempotent")).id;
    await storage.createAnimal(workspaceUserId, { tagId: "AB-001", sex: "ewe", name: "Auto Backup Ewe", status: "active" } as any);

    const first = await runAutomaticBackupForWorkspace(storage, adapter, workspaceUserId, {
      now: new Date("2026-07-13T02:00:00Z"),
    });
    assert.equal(first.status, "success");

    const second = await runAutomaticBackupForWorkspace(storage, adapter, workspaceUserId, {
      now: new Date("2026-07-14T02:00:00Z"),
    });
    assert.equal(second.status, "skipped");
    assert.equal(second.reason, "already_completed_for_window");

    const status = await getAutomaticBackupStatus(storage, workspaceUserId);
    assert.equal(status.records.length, 1);
    assert.equal(status.state.lastStatus, "skipped");
  } finally {
    await cleanup();
  }
});

test("automatic backup retention keeps latest 4 for Free and 12 for Premium", async () => {
  const { adapter, cleanup } = await createTempAdapter();
  try {
    const freeUserId = (await storage.createWorkspaceUser("auto-backup-free")).id;
    await storage.createAnimal(freeUserId, { tagId: "FREE-001", sex: "ewe", name: "Free Ewe", status: "active" } as any);

    for (let i = 0; i < 6; i += 1) {
      await runAutomaticBackupForWorkspace(storage, adapter, freeUserId, {
        now: new Date(Date.UTC(2026, 6, 13 + i * 7, 2, 0, 0)),
      });
    }
    const freeStatus = await getAutomaticBackupStatus(storage, freeUserId);
    assert.equal(freeStatus.records.length, 4);

    const premiumUserId = (await storage.createWorkspaceUser("auto-backup-premium")).id;
    await storage.createAnimal(premiumUserId, { tagId: "PREM-001", sex: "ram", name: "Premium Ram", status: "active" } as any);
    await setEntitlementState(storage, {
      accountId: premiumUserId,
      planId: "premium",
      status: "active",
      source: "billing_event",
      pricingVersion: "2026-07-locked-commercial-model",
      effectiveAt: new Date("2026-07-01T00:00:00Z").toISOString(),
      updatedAt: new Date("2026-07-01T00:00:00Z").toISOString(),
    });

    for (let i = 0; i < 14; i += 1) {
      await runAutomaticBackupForWorkspace(storage, adapter, premiumUserId, {
        now: new Date(Date.UTC(2026, 0, 5 + i * 7, 2, 0, 0)),
      });
    }
    const premiumStatus = await getAutomaticBackupStatus(storage, premiumUserId);
    assert.equal(premiumStatus.records.length, 12);
  } finally {
    await cleanup();
  }
});

test("automatic backup sweep runs once per effective shared workspace and keeps isolation", async () => {
  const { adapter, cleanup } = await createTempAdapter();
  try {
    const primary = await storage.upsertUser({ deviceId: "shared-workspace-primary", deviceName: "Primary" });
    const secondary = await storage.upsertUser({ deviceId: "shared-workspace-secondary", deviceName: "Secondary" });
    await storage.setSharedUserId(secondary.id, primary.id);
    await storage.createAnimal(primary.id, { tagId: "SIM-001", sex: "ewe", name: "Shared Ewe", status: "active" } as any);

    const isolated = await storage.upsertUser({ deviceId: "isolated-workspace-device", deviceName: "Isolated" });
    await storage.createAnimal(isolated.id, { tagId: "ISO-001", sex: "ram", name: "Isolated Ram", status: "active" } as any);

    const results = await runAutomaticBackupSweep(storage, adapter, {
      now: new Date("2026-07-20T02:00:00Z"),
    });

    const sharedRuns = results.filter((row) => row.workspaceUserId === primary.id);
    assert.equal(sharedRuns.length, 1);
    assert.ok(!results.some((row) => row.workspaceUserId === secondary.id));

    const sharedStatus = await getAutomaticBackupStatus(storage, primary.id);
    const isolatedStatus = await getAutomaticBackupStatus(storage, isolated.id);
    assert.equal(sharedStatus.records.length, 1);
    assert.equal(isolatedStatus.records.length, 1);
    assert.notEqual(sharedStatus.records[0].storageKey, isolatedStatus.records[0].storageKey);
  } finally {
    await cleanup();
  }
});

test("automatic backup worker records failure, retry state, and later recovery", async () => {
  const workspaceUserId = (await storage.createWorkspaceUser("auto-backup-retry")).id;
  await storage.createAnimal(workspaceUserId, { tagId: "RTR-001", sex: "ewe", name: "Retry Ewe", status: "active" } as any);

  let putAttempts = 0;
  const flakyAdapter = {
    provider: "flaky-test-adapter",
    async putObject() {
      putAttempts += 1;
      if (putAttempts === 1) {
        throw new Error("simulated adapter failure");
      }
    },
    async getObject() {
      return "";
    },
    async listKeys() {
      return [];
    },
    async deleteObject() {
      // no-op
    },
  };

  await assert.rejects(
    () => runAutomaticBackupForWorkspace(storage, flakyAdapter, workspaceUserId, {
      now: new Date("2026-07-27T02:00:00Z"),
    }),
    /simulated adapter failure/,
  );

  let status = await getAutomaticBackupStatus(storage, workspaceUserId);
  assert.equal(status.state.lastStatus, "failed");
  assert.equal(status.state.retryCount, 1);
  assert.equal(typeof status.state.retryAfter, "string");

  const { adapter, cleanup } = await createTempAdapter();
  try {
    const recovered = await runAutomaticBackupForWorkspace(storage, adapter, workspaceUserId, {
      now: new Date("2026-07-27T03:00:00Z"),
      force: true,
    });
    assert.equal(recovered.status, "success");

    status = await getAutomaticBackupStatus(storage, workspaceUserId);
    assert.equal(status.state.lastStatus, "success");
    assert.equal(status.state.retryCount, 0);
    assert.equal(status.records.length, 1);
  } finally {
    await cleanup();
  }
});
