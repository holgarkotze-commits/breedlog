import { db } from "./db";
import {
  animals,
  breedingEvents,
  offspring,
  performanceRecords,
  healthRecords,
  evaluations,
  matingGroups,
  farmSettings,
  type InsertAnimal,
  type InsertBreedingEvent,
  type InsertOffspring,
  type InsertPerformanceRecord,
  type InsertHealthRecord,
  type InsertEvaluation,
  type InsertMatingGroup,
  type InsertFarmSettings,
  type Animal,
  type BreedingEvent,
  type Offspring,
  type PerformanceRecord,
  type HealthRecord,
  type Evaluation,
  type MatingGroup,
  type FarmSettings,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Animals
  getAnimals(filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]>;
  getAnimal(id: number): Promise<Animal | undefined>;
  createAnimal(animal: InsertAnimal): Promise<Animal>;
  updateAnimal(id: number, animal: Partial<InsertAnimal>): Promise<Animal>;
  deleteAnimal(id: number): Promise<void>;

  // Breeding
  getBreedingEvents(): Promise<BreedingEvent[]>;
  createBreedingEvent(event: InsertBreedingEvent): Promise<BreedingEvent>;
  getOffspringByBreedingEvent(eventId: number): Promise<Offspring[]>;
  createOffspring(offspring: InsertOffspring): Promise<Offspring>;
  
  // Mating Groups
  getMatingGroups(): Promise<MatingGroup[]>;
  createMatingGroup(group: InsertMatingGroup): Promise<MatingGroup>;

  // Records
  getPerformanceRecords(animalId: number): Promise<PerformanceRecord[]>;
  createPerformanceRecord(record: InsertPerformanceRecord): Promise<PerformanceRecord>;
  getHealthRecords(animalId: number): Promise<HealthRecord[]>;
  createHealthRecord(record: InsertHealthRecord): Promise<HealthRecord>;

  // Evaluations
  getEvaluations(animalId: number): Promise<Evaluation[]>;
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;
  
  // Farm Settings
  getFarmSettings(): Promise<FarmSettings | undefined>;
  saveFarmSettings(settings: InsertFarmSettings): Promise<FarmSettings>;
}

export class DatabaseStorage implements IStorage {
  // Animals
  async getAnimals(filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]> {
    let query = db.select().from(animals);
    
    // Simple in-memory filtering for now or basic SQL WHEREs if needed.
    
    if (filters?.status) {
      query.where(eq(animals.status, filters.status));
    }
    
    const results = await query;
    return results; // Further filtering can be done in memory or via more complex SQL
  }

  async getAnimal(id: number): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(eq(animals.id, id));
    return animal;
  }

  async createAnimal(animal: InsertAnimal): Promise<Animal> {
    const [newAnimal] = await db.insert(animals).values(animal).returning();
    return newAnimal;
  }

  async updateAnimal(id: number, updates: Partial<InsertAnimal>): Promise<Animal> {
    const [updatedAnimal] = await db
      .update(animals)
      .set(updates)
      .where(eq(animals.id, id))
      .returning();
    return updatedAnimal;
  }

  async deleteAnimal(id: number): Promise<void> {
    await db.delete(animals).where(eq(animals.id, id));
  }

  // Breeding
  async getBreedingEvents(): Promise<BreedingEvent[]> {
    return await db.select().from(breedingEvents).orderBy(desc(breedingEvents.matingDate));
  }

  async createBreedingEvent(event: InsertBreedingEvent): Promise<BreedingEvent> {
    const [newEvent] = await db.insert(breedingEvents).values(event).returning();
    return newEvent;
  }

  async getOffspringByBreedingEvent(eventId: number): Promise<Offspring[]> {
      return await db.select().from(offspring).where(eq(offspring.breedingEventId, eventId));
  }

  async createOffspring(newOffspring: InsertOffspring): Promise<Offspring> {
    const [created] = await db.insert(offspring).values(newOffspring).returning();
    return created;
  }
  
  // Mating Groups
  async getMatingGroups(): Promise<MatingGroup[]> {
      return await db.select().from(matingGroups).orderBy(desc(matingGroups.dateIn));
  }
  
  async createMatingGroup(group: InsertMatingGroup): Promise<MatingGroup> {
      const [newGroup] = await db.insert(matingGroups).values(group).returning();
      return newGroup;
  }

  // Records
  async getPerformanceRecords(animalId: number): Promise<PerformanceRecord[]> {
    return await db.select().from(performanceRecords).where(eq(performanceRecords.animalId, animalId)).orderBy(desc(performanceRecords.date));
  }

  async createPerformanceRecord(record: InsertPerformanceRecord): Promise<PerformanceRecord> {
    const [newRecord] = await db.insert(performanceRecords).values(record).returning();
    return newRecord;
  }

  async getHealthRecords(animalId: number): Promise<HealthRecord[]> {
    return await db.select().from(healthRecords).where(eq(healthRecords.animalId, animalId)).orderBy(desc(healthRecords.date));
  }

  async createHealthRecord(record: InsertHealthRecord): Promise<HealthRecord> {
    const [newRecord] = await db.insert(healthRecords).values(record).returning();
    return newRecord;
  }

  // Evaluations
  async getEvaluations(animalId: number): Promise<Evaluation[]> {
    return await db.select().from(evaluations).where(eq(evaluations.animalId, animalId)).orderBy(desc(evaluations.date));
  }

  async createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation> {
    const [newEvaluation] = await db.insert(evaluations).values(evaluation).returning();
    return newEvaluation;
  }
  
  // Farm Settings
  async getFarmSettings(): Promise<FarmSettings | undefined> {
    const [settings] = await db.select().from(farmSettings).limit(1);
    return settings;
  }
  
  async saveFarmSettings(settings: InsertFarmSettings): Promise<FarmSettings> {
    const existing = await this.getFarmSettings();
    if (existing) {
      const [updated] = await db
        .update(farmSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(farmSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(farmSettings).values(settings).returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
