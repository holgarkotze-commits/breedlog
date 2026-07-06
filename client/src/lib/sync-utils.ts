import type { SyncQueueItem } from "./indexeddb";

/**
 * Build a "latest-wins" patch map from a set of pending sync-queue update items.
 *
 * Items are sorted by timestamp ascending so that later spreads always win.
 * The result is a Record keyed by numeric record id whose value is the merged
 * patch produced by collapsing all updates for that id in chronological order.
 *
 * @param items   Pending sync-queue items (any entity/action mix — only
 *                `action === 'update'` items with a numeric `id` field are used).
 * @param entity  When provided, only items whose `item.entity` matches are used.
 *                Pass `undefined` to process all items regardless of entity.
 */
export function buildPatchMap<T extends object>(
  items: SyncQueueItem[],
  entity?: string,
): Record<number, Partial<T>> {
  const updates = entity
    ? items.filter(item => item.entity === entity && item.action === "update")
    : items.filter(item => item.action === "update");

  return updates
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce<Record<number, Partial<T>>>((acc, item) => {
      const patch = item.data as { id?: number } & Partial<T>;
      if (patch.id != null) {
        acc[patch.id] = { ...(acc[patch.id] ?? {}), ...patch } as Partial<T>;
      }
      return acc;
    }, {});
}
