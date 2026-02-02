import type { Animal, BreedingEvent } from "@shared/schema";

export interface EweBreedingStats {
  totalLambs: number;
  firstLambDate: Date | null;
  avgILP: number;
  lambsWeaned: number;
  avgWeanWeight: number;
}

export function calculateEweBreedingStats(
  eweId: number,
  breedingEvents: BreedingEvent[],
  allAnimals: Animal[]
): EweBreedingStats {
  const eweEvents = breedingEvents.filter(e => e.eweId === eweId && e.lambingDate);
  
  const totalLambs = eweEvents.reduce((sum, e) => sum + (e.lambCount || 0), 0);
  
  const lambingDates = eweEvents
    .map(e => new Date(e.lambingDate!))
    .sort((a, b) => a.getTime() - b.getTime());
  
  const firstLambDate = lambingDates.length > 0 ? lambingDates[0] : null;
  
  let avgILP = 0;
  if (lambingDates.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < lambingDates.length; i++) {
      const days = (lambingDates[i].getTime() - lambingDates[i-1].getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    avgILP = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }
  
  const offspring = allAnimals.filter(a => a.damId === eweId);
  const weanedLambs = offspring.filter(a => 
    a.weaningStatus === 'normal' || a.weaningStatus === 'early'
  ).length;
  
  const weanedWithWeight = offspring.filter(a => 
    (a.weaningStatus === 'normal' || a.weaningStatus === 'early') && a.weight100Day
  );
  const avgWeanWeight = weanedWithWeight.length > 0
    ? Math.round((weanedWithWeight.reduce((sum, a) => sum + parseFloat(a.weight100Day || '0'), 0) / weanedWithWeight.length) * 10) / 10
    : 0;
  
  return {
    totalLambs,
    firstLambDate,
    avgILP,
    lambsWeaned: weanedLambs,
    avgWeanWeight
  };
}
