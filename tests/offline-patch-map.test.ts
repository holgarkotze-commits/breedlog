import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPatchMap } from "../client/src/lib/sync-utils.js";
import type { SyncQueueItem } from "../client/src/lib/indexeddb.js";

function makeUpdateItem(
  overrides: Partial<SyncQueueItem> & { data: { id: number } & Record<string, unknown> },
): SyncQueueItem {
  return {
    id: overrides.id ?? "item-" + Math.random(),
    action: "update",
    entity: overrides.entity ?? "breedingEvents",
    data: overrides.data,
    timestamp: overrides.timestamp ?? Date.now(),
    synced: 0,
  };
}

describe("buildPatchMap — latest-offline-edit wins", () => {
  it("returns the highest-timestamp value when two updates arrive out of order", () => {
    const items: SyncQueueItem[] = [
      // This item has the LATER timestamp but sits FIRST in the array —
      // the old inline reduce without a sort would let the earlier edit win.
      makeUpdateItem({ data: { id: 42, ramId: 99 }, timestamp: 2000 }),
      makeUpdateItem({ data: { id: 42, ramId: 7 }, timestamp: 1000 }),
    ];

    const patchMap = buildPatchMap(items, "breedingEvents");

    assert.ok(patchMap[42], "patch map entry for id 42 must exist");
    assert.equal(
      (patchMap[42] as any).ramId,
      99,
      "the edit with the higher timestamp (ramId=99) must win, not the earlier one (ramId=7)",
    );
  });

  it("preserves fields from earlier updates that are not overwritten by later ones", () => {
    const items: SyncQueueItem[] = [
      makeUpdateItem({ data: { id: 10, notes: "first note" }, timestamp: 500 }),
      makeUpdateItem({ data: { id: 10, eweId: 55 }, timestamp: 1500 }),
    ];

    const patchMap = buildPatchMap(items, "breedingEvents");

    assert.equal((patchMap[10] as any).notes, "first note", "notes from earlier update must survive");
    assert.equal((patchMap[10] as any).eweId, 55, "eweId from later update must be present");
  });

  it("later update overwrites the same field set by an earlier update", () => {
    const items: SyncQueueItem[] = [
      makeUpdateItem({ data: { id: 7, notes: "old notes" }, timestamp: 100 }),
      makeUpdateItem({ data: { id: 7, notes: "new notes" }, timestamp: 200 }),
    ];

    const patchMap = buildPatchMap(items, "breedingEvents");

    assert.equal(
      (patchMap[7] as any).notes,
      "new notes",
      "the most-recent timestamp's value must overwrite the earlier one for the same field",
    );
  });

  it("handles multiple distinct record ids independently", () => {
    const items: SyncQueueItem[] = [
      makeUpdateItem({ data: { id: 1, ramId: 10 }, timestamp: 300 }),
      makeUpdateItem({ data: { id: 2, ramId: 20 }, timestamp: 100 }),
      makeUpdateItem({ data: { id: 1, ramId: 11 }, timestamp: 400 }),
      makeUpdateItem({ data: { id: 2, ramId: 21 }, timestamp: 200 }),
    ];

    const patchMap = buildPatchMap(items, "breedingEvents");

    assert.equal((patchMap[1] as any).ramId, 11, "latest ramId for record 1 must be 11");
    assert.equal((patchMap[2] as any).ramId, 21, "latest ramId for record 2 must be 21");
  });

  it("filters by entity so items from other entities are ignored", () => {
    const items: SyncQueueItem[] = [
      makeUpdateItem({ entity: "breedingEvents", data: { id: 5, ramId: 9 }, timestamp: 100 }),
      makeUpdateItem({ entity: "animals", data: { id: 5, weight: 70 }, timestamp: 200 }),
    ];

    const patchMap = buildPatchMap(items, "breedingEvents");

    assert.ok(patchMap[5], "entry for id 5 must exist");
    assert.ok(
      !("weight" in patchMap[5]),
      "weight from the 'animals' entity must not bleed into the breedingEvents patch map",
    );
    assert.equal((patchMap[5] as any).ramId, 9);
  });

  it("returns an empty object when there are no update items", () => {
    const patchMap = buildPatchMap([], "breedingEvents");
    assert.deepEqual(patchMap, {});
  });

  it("ignores create and delete actions even when entity matches", () => {
    const items: SyncQueueItem[] = [
      {
        id: "c1",
        action: "create",
        entity: "breedingEvents",
        data: { id: 3, ramId: 1 },
        timestamp: 1000,
        synced: 0,
      },
      {
        id: "d1",
        action: "delete",
        entity: "breedingEvents",
        data: { id: 3 },
        timestamp: 2000,
        synced: 0,
      },
    ];

    const patchMap = buildPatchMap(items, "breedingEvents");
    assert.deepEqual(patchMap, {}, "create/delete items must not appear in the update patch map");
  });
});
