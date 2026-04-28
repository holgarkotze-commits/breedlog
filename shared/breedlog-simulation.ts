import { addDays } from "date-fns";
import type { Animal, BreedingEvent, FarmSettings, HealthRecord, MatingGroup, PerformanceRecord } from "./schema";
import { splitTagInput } from "./tag-utils";

export interface SimulationFarmMetadata {
  userId: string;
  farmName: string;
  studName: string;
  studPrefix: string;
  scenario: string;
  mode: "test" | "demo";
}

export interface LambCropRecord {
  breedingEventId: number;
  eweId: number;
  ramId: number;
  groupId: number;
  lambIds: number[];
  birthType: "single" | "twin";
  twinGroupId: string | null;
  birthDate: string;
  birthWeightKg: number;
}

export interface GroupOutcomeSummary {
  groupId: number;
  groupName: string;
  ramTag: string;
  ramId: number;
  ewesMated: number;
  ewesLambed: number;
  openEwes: number;
  singles: number;
  twins: number;
  lambsTotal: number;
  avgBirthWeightKg: number;
}

export interface SimulationExpectedSummary {
  totalAnimals: number;
  eweCount: number;
  ramCount: number;
  lambCount: number;
  lambingWindowStart: string;
  lambingWindowEnd: string;
  sireOffspringCounts: Record<string, number>;
  birthTypeSplit: Record<string, number>;
  familyLineCounts: Record<string, number>;
  groupOutcomes: GroupOutcomeSummary[];
}

export interface BreedLogSimulationDataset {
  farmMetadata: SimulationFarmMetadata;
  farmSettings: FarmSettings;
  baseEwes: Animal[];
  baseRams: Animal[];
  lambAnimals: Animal[];
  animals: Animal[];
  matingGroups: MatingGroup[];
  breedingEvents: BreedingEvent[];
  lambCropRecords: LambCropRecord[];
  performanceRecords: PerformanceRecord[];
  healthRecords: HealthRecord[];
  expectedAnalysisSummary: SimulationExpectedSummary;
  matingWindow: {
    startDate: string;
    endDate: string;
    gestationDays: number;
    lambingStartDate: string;
    lambingEndDate: string;
  };
}

interface GroupPlan {
  groupId: number;
  groupName: string;
  ramTag: string;
  singles: number;
  twins: number;
  openEwes: number;
  avgBirthWeightKg: number;
}

const STUD_PREFIX = "KW";
const MATING_START = "2024-10-01";
const MATING_END = "2024-11-11";
const GESTATION_DAYS = 147;
const LAMBING_SEASON = "25A";
const EWE_BIRTH_DATE_START = new Date("2022-03-01T00:00:00.000Z");

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function makeCanonicalTag(rawTag: string): { rawTag: string; canonicalTag: string } {
  const parts = splitTagInput(rawTag, STUD_PREFIX);
  return {
    rawTag: parts.rawTag,
    canonicalTag: parts.canonicalTag,
  };
}

function roundTo(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

const GROUP_PLANS: GroupPlan[] = [
  { groupId: 1, groupName: "R1 Breeding Group", ramTag: "R1", singles: 41, twins: 9, openEwes: 0, avgBirthWeightKg: 4.0 },
  { groupId: 2, groupName: "R2 Breeding Group", ramTag: "R2", singles: 41, twins: 7, openEwes: 2, avgBirthWeightKg: 3.2 },
  // R3 average = 25% above combined R1/R2/R4 average:
  // ((4.0 + 3.2 + 4.0) / 3) * 1.25 = 4.666..., rounded to 4.67 kg.
  { groupId: 3, groupName: "R3 Breeding Group", ramTag: "R3", singles: 32, twins: 17, openEwes: 1, avgBirthWeightKg: 4.67 },
  { groupId: 4, groupName: "R4 Breeding Group", ramTag: "R4", singles: 40, twins: 1, openEwes: 9, avgBirthWeightKg: 4.0 },
];

export function buildBreedLogSimulationDataset(): BreedLogSimulationDataset {
  const userId = "simulation-user-kw";
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const matingStartDate = new Date(`${MATING_START}T00:00:00.000Z`);
  const matingEndDate = new Date(`${MATING_END}T00:00:00.000Z`);
  const lambingStartDate = addDays(matingStartDate, GESTATION_DAYS);
  const lambingEndDate = addDays(matingEndDate, GESTATION_DAYS);

  const farmMetadata: SimulationFarmMetadata = {
    userId,
    farmName: "KW Test Farm",
    studName: "KW Simulation Stud",
    studPrefix: STUD_PREFIX,
    scenario: "Deterministic Meatmaster breeding season",
    mode: "test",
  };

  const farmSettings: FarmSettings = {
    id: 1,
    userId,
    farmName: farmMetadata.farmName,
    studName: farmMetadata.studName,
    studPrefix: farmMetadata.studPrefix,
    ownerName: "Test Operator",
    ownerEmail: "test@example.invalid",
    ownerPhone: null,
    farmAddress: null,
    farmLocation: "Test Valley",
    membershipNumber: null,
    registrationNumber: null,
    logoUrl: null,
    logoSize: "medium",
    logoWidth: null,
    logoHeight: null,
    createdAt,
    updatedAt: createdAt,
  };

  const birthWeightOffsets = [-0.2, -0.1, 0, 0.1, 0.2];
  const weaningWeightOffsets = [-1, -0.5, 0, 0.5, 1];

  const baseEwes: Animal[] = Array.from({ length: 200 }, (_, index) => {
    const id = 1001 + index;
    const sireLine = index < 100 ? "Bruno" : "Bash";
    const familyLine = index < 100 ? "Bruno" : "Bash";
    const tagNumber = String(index + 1).padStart(3, "0");
    const { rawTag, canonicalTag } = makeCanonicalTag(`22-${tagNumber}`);
    const birthDate = toIsoDate(addDays(EWE_BIRTH_DATE_START, index % 61));

    const birthWeight = roundTo(4 + birthWeightOffsets[index % birthWeightOffsets.length], 1).toFixed(1);
    const weaningWeight = roundTo(31 + weaningWeightOffsets[index % weaningWeightOffsets.length], 1).toFixed(1);

    return {
      id,
      userId,
      tagId: canonicalTag,
      rawTag,
      tattooId: null,
      electronicId: null,
      studPrefix: STUD_PREFIX,
      name: `Ewe ${tagNumber}`,
      sex: "ewe",
      breed: "Meatmaster",
      classification: "commercial",
      status: "active",
      photo: null,
      lambStatus: "active",
      ramLambClass: null,
      ramType: null,
      cullConfirmed: false,
      cullDate: null,
      cullReason: null,
      removalReason: null,
      birthDate,
      birthStatus: "single",
      damId: null,
      sireId: null,
      externalDamInfo: `DamLine-${(index % 20) + 1}`,
      externalSireInfo: sireLine,
      evaluationDocument: null,
      lambingSeason: "22A",
      environmentGroup: "Veld",
      managementGroup: familyLine,
      birthWeight,
      birthWeightEstimated: false,
      currentWeight: "64.0",
      weight100Day: weaningWeight,
      weight100DayDate: toIsoDate(addDays(new Date(`${birthDate}T00:00:00.000Z`), 100)),
      weight100DayEstimated: false,
      weight270Day: null,
      weight270DayDate: null,
      weaningStatus: "normal",
      breederName: "KW Simulation",
      ownerName: "KW Simulation",
      farmName: farmMetadata.farmName,
      location: `Camp-${(index % 8) + 1}`,
      notes: `${sireLine} daughter`,
      createdAt,
      clientId: null,
      vectorClock: null,
      lastSyncedAt: null,
    };
  });

  const baseRams: Animal[] = GROUP_PLANS.map((plan, index) => {
    const id = index + 1;
    const { rawTag, canonicalTag } = makeCanonicalTag(plan.ramTag);
    return {
      id,
      userId,
      tagId: canonicalTag,
      rawTag,
      tattooId: null,
      electronicId: null,
      studPrefix: STUD_PREFIX,
      name: plan.ramTag,
      sex: "ram",
      breed: "Meatmaster",
      classification: "stud",
      status: "active",
      photo: null,
      lambStatus: "active",
      ramLambClass: null,
      ramType: "stud_ram",
      cullConfirmed: false,
      cullDate: null,
      cullReason: null,
      removalReason: null,
      birthDate: "2021-09-01",
      birthStatus: "single",
      damId: null,
      sireId: null,
      externalDamInfo: "Imported Dam",
      externalSireInfo: "Imported Sire",
      evaluationDocument: null,
      lambingSeason: "21A",
      environmentGroup: "Veld",
      managementGroup: "Sire Team",
      birthWeight: "4.0",
      birthWeightEstimated: false,
      currentWeight: "95.0",
      weight100Day: null,
      weight100DayDate: null,
      weight100DayEstimated: false,
      weight270Day: null,
      weight270DayDate: null,
      weaningStatus: null,
      breederName: "KW Simulation",
      ownerName: "KW Simulation",
      farmName: farmMetadata.farmName,
      location: `Ram Camp ${index + 1}`,
      notes: null,
      createdAt,
      clientId: null,
      vectorClock: null,
      lastSyncedAt: null,
    };
  });

  const matingGroups: MatingGroup[] = [];
  const breedingEvents: BreedingEvent[] = [];
  const lambCropRecords: LambCropRecord[] = [];
  const lambAnimals: Animal[] = [];
  const performanceRecords: PerformanceRecord[] = [];

  let breedingEventId = 1;
  let lambIdCounter = 2001;

  for (const plan of GROUP_PLANS) {
    const ram = baseRams.find((candidate) => candidate.name === plan.ramTag)!;
    const eweStart = (plan.groupId - 1) * 50;
    const eweIds = baseEwes.slice(eweStart, eweStart + 50).map((ewe) => ewe.id);

    matingGroups.push({
      id: plan.groupId,
      userId,
      name: plan.groupName,
      ramId: ram.id,
      eweIds,
      dateIn: MATING_START,
      dateOut: MATING_END,
      lambingSeason: LAMBING_SEASON,
      environmentGroup: "Veld",
      managementGroup: String(plan.groupId),
      status: "closed",
      notes: `Deterministic simulation for ${plan.ramTag}`,
    });

    const lambedEwes = 50 - plan.openEwes;
    const twinEweIndexes = new Set<number>();
    for (let i = 0; i < plan.twins; i++) {
      twinEweIndexes.add(i);
    }

    for (let localIndex = 0; localIndex < 50; localIndex++) {
      const ewe = baseEwes[eweStart + localIndex];
      const isOpen = localIndex >= lambedEwes;
      const lambingDate = isOpen ? null : toIsoDate(addDays(lambingStartDate, (plan.groupId * 11 + localIndex) % 42));
      const birthType: "single" | "twin" = twinEweIndexes.has(localIndex) ? "twin" : "single";
      const lambCount = isOpen ? 0 : birthType === "twin" ? 2 : 1;

      breedingEvents.push({
        id: breedingEventId,
        userId,
        eweId: ewe.id,
        ramId: ram.id,
        matingGroupId: plan.groupId,
        matingDate: MATING_START,
        matingType: "natural",
        lambingDate,
        lambCount,
        notes: isOpen ? "Open ewe (no lambing)" : `Lambing outcome: ${birthType}`,
        clientId: null,
        vectorClock: null,
        lastSyncedAt: null,
      });

      if (!isOpen && lambingDate) {
        const twinGroupId = birthType === "twin" ? `TW-G${plan.groupId}-${String(localIndex + 1).padStart(2, "0")}` : null;
        const lambIds: number[] = [];

        for (let lambSlot = 0; lambSlot < lambCount; lambSlot++) {
          const lambNumber = String(lambIdCounter - 2000).padStart(3, "0");
          const { rawTag, canonicalTag } = makeCanonicalTag(`25-G${plan.groupId}-${lambNumber}`);
          const lambSex = (lambIdCounter + lambSlot) % 2 === 0 ? "ram" : "ewe";
          const lambBirthWeight = plan.avgBirthWeightKg.toFixed(2);

          const lamb: Animal = {
            id: lambIdCounter,
            userId,
            tagId: canonicalTag,
            rawTag,
            tattooId: null,
            electronicId: null,
            studPrefix: STUD_PREFIX,
            name: `Lamb ${lambNumber}`,
            sex: lambSex,
            breed: "Meatmaster",
            classification: lambSex === "ram" ? "stud" : "commercial",
            status: "active",
            photo: null,
            lambStatus: "active",
            ramLambClass: lambSex === "ram" ? "stud" : null,
            ramType: null,
            cullConfirmed: false,
            cullDate: null,
            cullReason: null,
            removalReason: null,
            birthDate: lambingDate,
            birthStatus: birthType,
            damId: ewe.id,
            sireId: ram.id,
            externalDamInfo: null,
            externalSireInfo: null,
            evaluationDocument: null,
            lambingSeason: LAMBING_SEASON,
            environmentGroup: "Veld",
            managementGroup: ewe.managementGroup,
            birthWeight: lambBirthWeight,
            birthWeightEstimated: false,
            currentWeight: null,
            weight100Day: null,
            weight100DayDate: null,
            weight100DayEstimated: false,
            weight270Day: null,
            weight270DayDate: null,
            weaningStatus: null,
            breederName: "KW Simulation",
            ownerName: "KW Simulation",
            farmName: farmMetadata.farmName,
            location: `Lambing Pen G${plan.groupId}`,
            notes: twinGroupId ? `twinGroup:${twinGroupId}` : "single",
            createdAt,
            clientId: null,
            vectorClock: null,
            lastSyncedAt: null,
          };

          lambAnimals.push(lamb);
          lambIds.push(lamb.id);

          performanceRecords.push({
            id: lamb.id,
            userId,
            animalId: lamb.id,
            date: lambingDate,
            weight: lambBirthWeight,
            ageDays: 0,
            type: "BIRTH",
            traitNotes: twinGroupId ? twinGroupId : null,
            notes: `Generated by ${plan.groupName}`,
          });

          lambIdCounter += 1;
        }

        lambCropRecords.push({
          breedingEventId,
          eweId: ewe.id,
          ramId: ram.id,
          groupId: plan.groupId,
          lambIds,
          birthType,
          twinGroupId,
          birthDate: lambingDate,
          birthWeightKg: plan.avgBirthWeightKg,
        });
      }

      breedingEventId += 1;
    }
  }

  const animals = [...baseRams, ...baseEwes, ...lambAnimals];

  const sireOffspringCounts = Object.fromEntries(
    GROUP_PLANS.map((plan) => [plan.ramTag, lambAnimals.filter((lamb) => lamb.sireId === plan.groupId).length])
  );

  const familyLineCounts = {
    Bruno: animals.filter((animal) => animal.managementGroup === "Bruno").length,
    Bash: animals.filter((animal) => animal.managementGroup === "Bash").length,
  };

  const expectedAnalysisSummary: SimulationExpectedSummary = {
    totalAnimals: animals.length,
    eweCount: animals.filter((animal) => animal.sex === "ewe").length,
    ramCount: animals.filter((animal) => animal.sex === "ram").length,
    lambCount: lambAnimals.length,
    lambingWindowStart: toIsoDate(lambingStartDate),
    lambingWindowEnd: toIsoDate(lambingEndDate),
    sireOffspringCounts,
    birthTypeSplit: {
      single: lambAnimals.filter((animal) => animal.birthStatus === "single").length,
      twin: lambAnimals.filter((animal) => animal.birthStatus === "twin").length,
    },
    familyLineCounts,
    groupOutcomes: GROUP_PLANS.map((plan) => ({
      groupId: plan.groupId,
      groupName: plan.groupName,
      ramTag: plan.ramTag,
      ramId: plan.groupId,
      ewesMated: 50,
      ewesLambed: 50 - plan.openEwes,
      openEwes: plan.openEwes,
      singles: plan.singles,
      twins: plan.twins,
      lambsTotal: plan.singles + plan.twins * 2,
      avgBirthWeightKg: plan.avgBirthWeightKg,
    })),
  };

  return {
    farmMetadata,
    farmSettings,
    baseEwes,
    baseRams,
    lambAnimals,
    animals,
    matingGroups,
    breedingEvents,
    lambCropRecords,
    performanceRecords,
    healthRecords: [],
    expectedAnalysisSummary,
    matingWindow: {
      startDate: MATING_START,
      endDate: MATING_END,
      gestationDays: GESTATION_DAYS,
      lambingStartDate: toIsoDate(lambingStartDate),
      lambingEndDate: toIsoDate(lambingEndDate),
    },
  };
}
