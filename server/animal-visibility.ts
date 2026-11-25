import type { IStorage } from "./storage";
import { getDowngradeVisibleAnimalIdSet, getEntitlementState, isInternalTestEntitlement } from "./commercial";

export type AnimalVisibility = { visibleAnimalIds: Set<number>; hiddenAnimalIds: Set<number> } | null;

export async function getAnimalVisibility(storage: IStorage, userId: string): Promise<AnimalVisibility> {
  const entitlement = await getEntitlementState(storage, userId);
  if (entitlement.planId !== "free" || isInternalTestEntitlement(entitlement)) return null;
  const animals = await storage.getAnimals(userId, {});
  const visibleAnimalIds = getDowngradeVisibleAnimalIdSet(animals);
  return { visibleAnimalIds, hiddenAnimalIds: new Set(animals.filter(a => !visibleAnimalIds.has(a.id)).map(a => a.id)) };
}

export function isAnimalVisible(context: AnimalVisibility, id: number | null | undefined): boolean {
  return !context || id == null || context.visibleAnimalIds.has(id);
}

// Redact structured parent references without changing the preserved SQL row.
export function redactAnimalParents<T>(context: AnimalVisibility, row: T): T {
  if (!context || !row || typeof row !== "object") return row;
  const projected = { ...row } as T & Record<string, unknown>;
  for (const parent of ["dam", "sire"] as const) {
    if (!isAnimalVisible(context, projected[`${parent}Id`] as number | null | undefined)) {
      Object.assign(projected, { [`${parent}Id`]: null, [`external${parent === "dam" ? "Dam" : "Sire"}Info`]: null });
    }
  }
  return projected;
}

export function filterVisibleRows<T>(context: AnimalVisibility, rows: T[], selectors: Array<(row: T) => number | null | undefined>): T[] {
  return rows.filter(row => selectors.every(select => isAnimalVisible(context, select(row))))
    .map(row => redactAnimalParents(context, row));
}

// An archived PDF/image or old chat may contain an entire Premium herd/pedigree.
// Opaque content cannot be safely projected; retain it server-side until restored.
export function hasHiddenAnimals(context: AnimalVisibility): boolean {
  return !!context?.hiddenAnimalIds.size;
}

export async function getVisibleAIData(storage: IStorage, userId: string) {
  const visibility = await getAnimalVisibility(storage, userId);
  const [animals, breedingEvents, performanceRecords, healthRecords, flockEvents, matingGroups, farmSettings] = await Promise.all([
    storage.getAnimals(userId, {}), storage.getBreedingEvents(userId), storage.getAllPerformanceRecords(userId),
    storage.getAllHealthRecords(userId), storage.getFlockHealthEvents(userId), storage.getMatingGroups(userId), storage.getFarmSettings(userId),
  ]);
  const permittedEvents = await Promise.all(flockEvents.map(async event =>
    (await storage.getFlockHealthTreatments(userId, event.id)).every(row => isAnimalVisible(visibility, row.animalId)) ? event : null));
  return {
    visibility,
    animals: filterVisibleRows(visibility, animals, [row => row.id]),
    breedingEvents: filterVisibleRows(visibility, breedingEvents, [row => row.eweId, row => row.ramId]),
    performanceRecords: filterVisibleRows(visibility, performanceRecords, [row => row.animalId]),
    healthRecords: filterVisibleRows(visibility, healthRecords, [row => row.animalId]),
    flockHealthEvents: permittedEvents.filter((event): event is typeof flockEvents[number] => event !== null),
    matingGroups: matingGroups.filter(row => isAnimalVisible(visibility, row.ramId) && (row.eweIds ?? []).every(id => isAnimalVisible(visibility, id))),
    farmSettings,
  };
}
