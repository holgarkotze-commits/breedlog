import { db } from "./db";
import {
  animals,
  breedingEvents,
  offspring,
  performanceRecords,
  healthRecords,
  evaluations,
  aiValuations,
  type InsertAnimal,
  type InsertBreedingEvent,
  type InsertOffspring,
  type InsertPerformanceRecord,
  type InsertHealthRecord,
  type InsertEvaluation,
  type InsertAiValuation,
  type Animal,
  type BreedingEvent,
  type Offspring,
  type PerformanceRecord,
  type HealthRecord,
  type Evaluation,
  type AiValuation,
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

  // Records
  getPerformanceRecords(animalId: number): Promise<PerformanceRecord[]>;
  createPerformanceRecord(record: InsertPerformanceRecord): Promise<PerformanceRecord>;
  getHealthRecords(animalId: number): Promise<HealthRecord[]>;
  createHealthRecord(record: InsertHealthRecord): Promise<HealthRecord>;

  // Evaluations
  getEvaluations(animalId: number): Promise<Evaluation[]>;
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;
  
  // AI Valuations
  getAiValuations(animalId: number): Promise<AiValuation[]>;
  createAiValuation(valuation: InsertAiValuation): Promise<AiValuation>;
}

export class DatabaseStorage implements IStorage {
  // Animals
  async getAnimals(filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]> {
    let query = db.select().from(animals);
    
    // Simple in-memory filtering for now or basic SQL WHEREs if needed.
    // Drizzle's query builder is powerful enough.
    // For now, returning all and letting frontend filter or adding simple WHEREs if high volume.
    // Given the prompt suggests offline-first/local SQLite feel, loading all isn't terrible for reasonable herd sizes.
    // But let's add basic status filtering at least.
    
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

  // AI Valuations
  async getAiValuations(animalId: number): Promise<AiValuation[]> {
      return await db.select().from(aiValuations).where(eq(aiValuations.animalId, animalId)).orderBy(desc(aiValuations.createdAt));
  }

  async createAiValuation(valuation: InsertAiValuation): Promise<AiValuation> {
      const [newValuation] = await db.insert(aiValuations).values(valuation).returning();
      return newValuation;
  }
}

export const storage = new DatabaseStorage();
