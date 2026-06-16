import type { Animal } from "@shared/schema";

import { calculateLambStage, isArchivedLambState } from "@shared/lamb-stage";

const INACTIVE_STATUSES = ["dead", "deceased", "sold", "culled", "transferred", "inactive", "removed"];

function getAgeDays(birthDate?: string | Date | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function isArchiveAnimal(a: Animal): boolean {
  return isArchivedLambState(a);
}

export function isNonAdmittedLambStage(a: Animal): boolean {
  const stage = calculateLambStage(a);
  return stage.isActiveLambStage;
}

/**
 * Returns true only for animals currently on the farm and active.
 * Excludes archived lamb stages AND all inactive statuses (dead/sold/culled/transferred/etc.).
 */
export function isActiveAnimal(a: Animal): boolean {
  return (
    !isArchiveAnimal(a) &&
    !INACTIVE_STATUSES.includes((a.status || "").toLowerCase())
  );
}

/**
 * Returns only the animals currently on the farm and active.
 */
export function getActiveAnimals(animals: Animal[]): Animal[] {
  return animals.filter(isActiveAnimal);
}

export function getHerdCounts(allAnimals: Animal[] = []) {
  const totalFarmRecords = allAnimals.length;
  const archiveAnimals = allAnimals.filter(isArchiveAnimal);
  const deadOrSoldAnimals = allAnimals.filter((a) => ["dead", "deceased", "sold", "transferred"].includes((a.status || "").toLowerCase()));
  const nonAdmittedLambStageAnimals = allAnimals.filter((a) => !isArchiveAnimal(a) && isNonAdmittedLambStage(a));
  const admittedHerdAnimals = allAnimals.filter((a) => !isArchiveAnimal(a) && !isNonAdmittedLambStage(a));
  const activeHerdAnimals = allAnimals.filter(isActiveAnimal);
  const matureHerdAnimals = admittedHerdAnimals.filter((a) => {
    const age = getAgeDays(a.birthDate);
    return age === null || age > 240;
  });

  return {
    totalFarmRecords,
    activeHerdAnimals: activeHerdAnimals.length,
    archiveAnimals: archiveAnimals.length,
    deadOrSoldAnimals: deadOrSoldAnimals.length,
    nonAdmittedLambStageAnimals: nonAdmittedLambStageAnimals.length,
    admittedHerdAnimals: admittedHerdAnimals.length,
    matureHerdAnimals: matureHerdAnimals.length,
  };
}
