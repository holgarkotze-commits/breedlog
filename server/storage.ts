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
  documents,
  animalImages,
  exportedDocuments,
  type InsertAnimal,
  type InsertBreedingEvent,
  type InsertOffspring,
  type InsertPerformanceRecord,
  type InsertHealthRecord,
  type InsertEvaluation,
  type InsertMatingGroup,
  type InsertFarmSettings,
  type InsertDocument,
  type InsertAnimalImage,
  type InsertExportedDocument,
  type Animal,
  type BreedingEvent,
  type Offspring,
  type PerformanceRecord,
  type HealthRecord,
  type Evaluation,
  type MatingGroup,
  type FarmSettings,
  type Document,
  type AnimalImage,
  type ExportedDocument,
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
  
  // Documents
  getDocuments(): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  
  // Animal Images
  getAnimalImages(animalId: number): Promise<AnimalImage[]>;
  createAnimalImage(image: InsertAnimalImage): Promise<AnimalImage>;
  deleteAnimalImage(id: number): Promise<void>;
  
  // Exported Documents
  getExportedDocuments(subfolder?: string): Promise<ExportedDocument[]>;
  createExportedDocument(doc: InsertExportedDocument): Promise<ExportedDocument>;
  deleteExportedDocument(id: number): Promise<void>;
  
  // Bulk import
  bulkCreateAnimals(animalsList: InsertAnimal[]): Promise<Animal[]>;
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
  
  async updateMatingGroup(id: number, updates: Partial<InsertMatingGroup>): Promise<MatingGroup | null> {
      const [updated] = await db.update(matingGroups).set(updates).where(eq(matingGroups.id, id)).returning();
      return updated || null;
  }
  
  async deleteMatingGroup(id: number): Promise<boolean> {
      const result = await db.delete(matingGroups).where(eq(matingGroups.id, id));
      return true;
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
  
  // Documents
  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(desc(documents.createdAt));
  }
  
  async createDocument(doc: InsertDocument): Promise<Document> {
    const [newDoc] = await db.insert(documents).values(doc).returning();
    return newDoc;
  }
  
  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }
  
  // Animal Images
  async getAnimalImages(animalId: number): Promise<AnimalImage[]> {
    return await db.select().from(animalImages)
      .where(eq(animalImages.animalId, animalId))
      .orderBy(desc(animalImages.uploadedAt));
  }
  
  async createAnimalImage(image: InsertAnimalImage): Promise<AnimalImage> {
    const [newImage] = await db.insert(animalImages).values(image).returning();
    return newImage;
  }
  
  async deleteAnimalImage(id: number): Promise<void> {
    await db.delete(animalImages).where(eq(animalImages.id, id));
  }
  
  // Exported Documents
  async getExportedDocuments(subfolder?: string): Promise<ExportedDocument[]> {
    if (subfolder) {
      return await db.select().from(exportedDocuments)
        .where(eq(exportedDocuments.subfolder, subfolder))
        .orderBy(desc(exportedDocuments.exportedAt));
    }
    return await db.select().from(exportedDocuments).orderBy(desc(exportedDocuments.exportedAt));
  }
  
  async createExportedDocument(doc: InsertExportedDocument): Promise<ExportedDocument> {
    const [newDoc] = await db.insert(exportedDocuments).values(doc).returning();
    return newDoc;
  }
  
  async deleteExportedDocument(id: number): Promise<void> {
    await db.delete(exportedDocuments).where(eq(exportedDocuments.id, id));
  }
  
  // Bulk import
  async bulkCreateAnimals(animalsList: InsertAnimal[]): Promise<Animal[]> {
    if (animalsList.length === 0) return [];
    const created = await db.insert(animals).values(animalsList).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
