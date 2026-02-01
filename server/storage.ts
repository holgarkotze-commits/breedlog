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
  flockHealthEvents,
  flockHealthTreatments,
  inviteCodes,
  userActivations,
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
  type InsertFlockHealthEvent,
  type InsertFlockHealthTreatment,
  type InsertInviteCode,
  type InsertUserActivation,
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
  type FlockHealthEvent,
  type FlockHealthTreatment,
  type InviteCode,
  type UserActivation,
} from "@shared/schema";
import { eq, desc, and, sql, lt, gte } from "drizzle-orm";

export interface IStorage {
  // Animals - ALL methods now require userId for data isolation
  getAnimals(userId: string, filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]>;
  getAnimal(userId: string, id: number): Promise<Animal | undefined>;
  createAnimal(userId: string, animal: Omit<InsertAnimal, 'userId'>): Promise<Animal>;
  updateAnimal(userId: string, id: number, animal: Partial<Omit<InsertAnimal, 'userId'>>): Promise<Animal>;
  deleteAnimal(userId: string, id: number): Promise<void>;

  // Breeding
  getBreedingEvents(userId: string): Promise<BreedingEvent[]>;
  createBreedingEvent(userId: string, event: Omit<InsertBreedingEvent, 'userId'>): Promise<BreedingEvent>;
  deleteBreedingEvent(userId: string, id: number): Promise<void>;
  getOffspringByBreedingEvent(userId: string, eventId: number): Promise<Offspring[]>;
  createOffspring(userId: string, newOffspring: Omit<InsertOffspring, 'userId'>): Promise<Offspring>;
  
  // Mating Groups
  getMatingGroups(userId: string): Promise<MatingGroup[]>;
  createMatingGroup(userId: string, group: Omit<InsertMatingGroup, 'userId'>): Promise<MatingGroup>;
  updateMatingGroup(userId: string, id: number, updates: Partial<Omit<InsertMatingGroup, 'userId'>>): Promise<MatingGroup | null>;
  deleteMatingGroup(userId: string, id: number): Promise<boolean>;

  // Records
  getPerformanceRecords(userId: string, animalId: number): Promise<PerformanceRecord[]>;
  createPerformanceRecord(userId: string, record: Omit<InsertPerformanceRecord, 'userId'>): Promise<PerformanceRecord>;
  getHealthRecords(userId: string, animalId: number): Promise<HealthRecord[]>;
  createHealthRecord(userId: string, record: Omit<InsertHealthRecord, 'userId'>): Promise<HealthRecord>;

  // Evaluations
  getEvaluations(userId: string, animalId: number): Promise<Evaluation[]>;
  createEvaluation(userId: string, evaluation: Omit<InsertEvaluation, 'userId'>): Promise<Evaluation>;
  
  // Farm Settings
  getFarmSettings(userId: string): Promise<FarmSettings | undefined>;
  saveFarmSettings(userId: string, settings: Omit<InsertFarmSettings, 'userId'>): Promise<FarmSettings>;
  
  // Documents
  getDocuments(userId: string): Promise<Document[]>;
  createDocument(userId: string, doc: Omit<InsertDocument, 'userId'>): Promise<Document>;
  deleteDocument(userId: string, id: number): Promise<void>;
  
  // Animal Images
  getAnimalImages(userId: string, animalId: number): Promise<AnimalImage[]>;
  createAnimalImage(userId: string, image: Omit<InsertAnimalImage, 'userId'>): Promise<AnimalImage>;
  deleteAnimalImage(userId: string, id: number): Promise<void>;
  
  // Exported Documents
  getExportedDocuments(userId: string, subfolder?: string): Promise<ExportedDocument[]>;
  createExportedDocument(userId: string, doc: Omit<InsertExportedDocument, 'userId'>): Promise<ExportedDocument>;
  deleteExportedDocument(userId: string, id: number): Promise<void>;
  
  // Production Reset - clears data for specific user only
  clearAllData(userId: string): Promise<void>;
  
  // Flock Health Events
  getFlockHealthEvents(userId: string): Promise<FlockHealthEvent[]>;
  getFlockHealthEvent(userId: string, id: number): Promise<FlockHealthEvent | undefined>;
  createFlockHealthEvent(userId: string, event: Omit<InsertFlockHealthEvent, 'userId'>): Promise<FlockHealthEvent>;
  getFlockHealthTreatments(userId: string, eventId: number): Promise<FlockHealthTreatment[]>;
  createFlockHealthTreatments(userId: string, treatments: Omit<InsertFlockHealthTreatment, 'userId'>[]): Promise<FlockHealthTreatment[]>;
  
  // Bulk import
  bulkCreateAnimals(userId: string, animalsList: Omit<InsertAnimal, 'userId'>[]): Promise<Animal[]>;
  
  // Beta Access - Invite Codes (Admin operations, no userId required)
  getInviteCodes(): Promise<InviteCode[]>;
  getInviteCodeByCode(code: string): Promise<InviteCode | undefined>;
  createInviteCode(code: Omit<InsertInviteCode, 'status'>): Promise<InviteCode>;
  updateInviteCode(id: number, updates: Partial<InsertInviteCode>): Promise<InviteCode | undefined>;
  incrementInviteCodeUses(id: number): Promise<void>;
  getActiveTestersCount(): Promise<number>;
  
  // Beta Access - User Activations
  getUserActivation(userId: string): Promise<UserActivation | undefined>;
  getActivationByDeviceId(deviceId: string): Promise<UserActivation | undefined>;
  createUserActivation(activation: InsertUserActivation): Promise<UserActivation>;
  updateUserActivation(userId: string, updates: Partial<Omit<UserActivation, 'id' | 'userId' | 'activatedAt'>>): Promise<UserActivation | undefined>;
  getAllActiveActivations(): Promise<UserActivation[]>;
  
  // Device-based Users
  getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string } | undefined>;
  upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string }>;
  updateUserLastSeen(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Animals - ALL queries now filter by userId
  async getAnimals(userId: string, filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]> {
    let conditions = [eq(animals.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(animals.status, filters.status));
    }
    
    const results = await db.select().from(animals).where(and(...conditions));
    return results;
  }

  async getAnimal(userId: string, id: number): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(
      and(eq(animals.id, id), eq(animals.userId, userId))
    );
    return animal;
  }

  async createAnimal(userId: string, animal: Omit<InsertAnimal, 'userId'>): Promise<Animal> {
    const [newAnimal] = await db.insert(animals).values({ ...animal, userId }).returning();
    return newAnimal;
  }

  async updateAnimal(userId: string, id: number, updates: Partial<Omit<InsertAnimal, 'userId'>>): Promise<Animal> {
    const [updatedAnimal] = await db
      .update(animals)
      .set(updates)
      .where(and(eq(animals.id, id), eq(animals.userId, userId)))
      .returning();
    return updatedAnimal;
  }

  async deleteAnimal(userId: string, id: number): Promise<void> {
    await db.delete(animals).where(and(eq(animals.id, id), eq(animals.userId, userId)));
  }

  // Breeding
  async getBreedingEvents(userId: string): Promise<BreedingEvent[]> {
    return await db.select().from(breedingEvents)
      .where(eq(breedingEvents.userId, userId))
      .orderBy(desc(breedingEvents.matingDate));
  }

  async createBreedingEvent(userId: string, event: Omit<InsertBreedingEvent, 'userId'>): Promise<BreedingEvent> {
    const [newEvent] = await db.insert(breedingEvents).values({ ...event, userId }).returning();
    return newEvent;
  }

  async deleteBreedingEvent(userId: string, id: number): Promise<void> {
    await db.delete(breedingEvents).where(
      and(eq(breedingEvents.id, id), eq(breedingEvents.userId, userId))
    );
  }

  async getOffspringByBreedingEvent(userId: string, eventId: number): Promise<Offspring[]> {
    return await db.select().from(offspring).where(
      and(eq(offspring.breedingEventId, eventId), eq(offspring.userId, userId))
    );
  }

  async createOffspring(userId: string, newOffspring: Omit<InsertOffspring, 'userId'>): Promise<Offspring> {
    const [created] = await db.insert(offspring).values({ ...newOffspring, userId }).returning();
    return created;
  }
  
  // Mating Groups
  async getMatingGroups(userId: string): Promise<MatingGroup[]> {
    return await db.select().from(matingGroups)
      .where(eq(matingGroups.userId, userId))
      .orderBy(desc(matingGroups.dateIn));
  }
  
  async createMatingGroup(userId: string, group: Omit<InsertMatingGroup, 'userId'>): Promise<MatingGroup> {
    const [newGroup] = await db.insert(matingGroups).values({ ...group, userId }).returning();
    return newGroup;
  }
  
  async updateMatingGroup(userId: string, id: number, updates: Partial<Omit<InsertMatingGroup, 'userId'>>): Promise<MatingGroup | null> {
    const [updated] = await db.update(matingGroups)
      .set(updates)
      .where(and(eq(matingGroups.id, id), eq(matingGroups.userId, userId)))
      .returning();
    return updated || null;
  }
  
  async deleteMatingGroup(userId: string, id: number): Promise<boolean> {
    await db.delete(matingGroups).where(
      and(eq(matingGroups.id, id), eq(matingGroups.userId, userId))
    );
    return true;
  }

  // Records
  async getPerformanceRecords(userId: string, animalId: number): Promise<PerformanceRecord[]> {
    return await db.select().from(performanceRecords)
      .where(and(eq(performanceRecords.animalId, animalId), eq(performanceRecords.userId, userId)))
      .orderBy(desc(performanceRecords.date));
  }

  async createPerformanceRecord(userId: string, record: Omit<InsertPerformanceRecord, 'userId'>): Promise<PerformanceRecord> {
    const [newRecord] = await db.insert(performanceRecords).values({ ...record, userId }).returning();
    return newRecord;
  }

  async getHealthRecords(userId: string, animalId: number): Promise<HealthRecord[]> {
    return await db.select().from(healthRecords)
      .where(and(eq(healthRecords.animalId, animalId), eq(healthRecords.userId, userId)))
      .orderBy(desc(healthRecords.date));
  }

  async createHealthRecord(userId: string, record: Omit<InsertHealthRecord, 'userId'>): Promise<HealthRecord> {
    const [newRecord] = await db.insert(healthRecords).values({ ...record, userId }).returning();
    return newRecord;
  }

  // Evaluations
  async getEvaluations(userId: string, animalId: number): Promise<Evaluation[]> {
    return await db.select().from(evaluations)
      .where(and(eq(evaluations.animalId, animalId), eq(evaluations.userId, userId)))
      .orderBy(desc(evaluations.date));
  }

  async createEvaluation(userId: string, evaluation: Omit<InsertEvaluation, 'userId'>): Promise<Evaluation> {
    const [newEvaluation] = await db.insert(evaluations).values({ ...evaluation, userId }).returning();
    return newEvaluation;
  }
  
  // Farm Settings - one per user
  async getFarmSettings(userId: string): Promise<FarmSettings | undefined> {
    const [settings] = await db.select().from(farmSettings)
      .where(eq(farmSettings.userId, userId))
      .limit(1);
    return settings;
  }
  
  async saveFarmSettings(userId: string, settings: Omit<InsertFarmSettings, 'userId'>): Promise<FarmSettings> {
    const existing = await this.getFarmSettings(userId);
    if (existing) {
      const [updated] = await db
        .update(farmSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(and(eq(farmSettings.id, existing.id), eq(farmSettings.userId, userId)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(farmSettings).values({ ...settings, userId }).returning();
      return created;
    }
  }
  
  // Documents
  async getDocuments(userId: string): Promise<Document[]> {
    return await db.select().from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }
  
  async createDocument(userId: string, doc: Omit<InsertDocument, 'userId'>): Promise<Document> {
    const [newDoc] = await db.insert(documents).values({ ...doc, userId }).returning();
    return newDoc;
  }
  
  async deleteDocument(userId: string, id: number): Promise<void> {
    await db.delete(documents).where(
      and(eq(documents.id, id), eq(documents.userId, userId))
    );
  }
  
  // Animal Images
  async getAnimalImages(userId: string, animalId: number): Promise<AnimalImage[]> {
    return await db.select().from(animalImages)
      .where(and(eq(animalImages.animalId, animalId), eq(animalImages.userId, userId)))
      .orderBy(desc(animalImages.uploadedAt));
  }
  
  async createAnimalImage(userId: string, image: Omit<InsertAnimalImage, 'userId'>): Promise<AnimalImage> {
    const [newImage] = await db.insert(animalImages).values({ ...image, userId }).returning();
    return newImage;
  }
  
  async deleteAnimalImage(userId: string, id: number): Promise<void> {
    await db.delete(animalImages).where(
      and(eq(animalImages.id, id), eq(animalImages.userId, userId))
    );
  }
  
  // Exported Documents
  async getExportedDocuments(userId: string, subfolder?: string): Promise<ExportedDocument[]> {
    let conditions = [eq(exportedDocuments.userId, userId)];
    if (subfolder) {
      conditions.push(eq(exportedDocuments.subfolder, subfolder));
    }
    return await db.select().from(exportedDocuments)
      .where(and(...conditions))
      .orderBy(desc(exportedDocuments.exportedAt));
  }
  
  async createExportedDocument(userId: string, doc: Omit<InsertExportedDocument, 'userId'>): Promise<ExportedDocument> {
    const [newDoc] = await db.insert(exportedDocuments).values({ ...doc, userId }).returning();
    return newDoc;
  }
  
  async deleteExportedDocument(userId: string, id: number): Promise<void> {
    await db.delete(exportedDocuments).where(
      and(eq(exportedDocuments.id, id), eq(exportedDocuments.userId, userId))
    );
  }
  
  // Flock Health Events
  async getFlockHealthEvents(userId: string): Promise<FlockHealthEvent[]> {
    return await db.select().from(flockHealthEvents)
      .where(eq(flockHealthEvents.userId, userId))
      .orderBy(desc(flockHealthEvents.createdAt));
  }
  
  async getFlockHealthEvent(userId: string, id: number): Promise<FlockHealthEvent | undefined> {
    const [event] = await db.select().from(flockHealthEvents).where(
      and(eq(flockHealthEvents.id, id), eq(flockHealthEvents.userId, userId))
    );
    return event;
  }
  
  async createFlockHealthEvent(userId: string, event: Omit<InsertFlockHealthEvent, 'userId'>): Promise<FlockHealthEvent> {
    const [newEvent] = await db.insert(flockHealthEvents).values({ ...event, userId }).returning();
    return newEvent;
  }
  
  async getFlockHealthTreatments(userId: string, eventId: number): Promise<FlockHealthTreatment[]> {
    return await db.select().from(flockHealthTreatments).where(
      and(eq(flockHealthTreatments.eventId, eventId), eq(flockHealthTreatments.userId, userId))
    );
  }
  
  async createFlockHealthTreatments(userId: string, treatments: Omit<InsertFlockHealthTreatment, 'userId'>[]): Promise<FlockHealthTreatment[]> {
    if (treatments.length === 0) return [];
    const treatmentsWithUserId = treatments.map(t => ({ ...t, userId }));
    return await db.insert(flockHealthTreatments).values(treatmentsWithUserId).returning();
  }
  
  // Bulk import
  async bulkCreateAnimals(userId: string, animalsList: Omit<InsertAnimal, 'userId'>[]): Promise<Animal[]> {
    if (animalsList.length === 0) return [];
    const animalsWithUserId = animalsList.map(a => ({ ...a, userId }));
    const created = await db.insert(animals).values(animalsWithUserId).returning();
    return created;
  }
  
  // Production Reset - clears data for specific user only
  async clearAllData(userId: string): Promise<void> {
    await db.delete(flockHealthTreatments).where(eq(flockHealthTreatments.userId, userId));
    await db.delete(flockHealthEvents).where(eq(flockHealthEvents.userId, userId));
    await db.delete(exportedDocuments).where(eq(exportedDocuments.userId, userId));
    await db.delete(documents).where(eq(documents.userId, userId));
    await db.delete(animalImages).where(eq(animalImages.userId, userId));
    await db.delete(evaluations).where(eq(evaluations.userId, userId));
    await db.delete(healthRecords).where(eq(healthRecords.userId, userId));
    await db.delete(performanceRecords).where(eq(performanceRecords.userId, userId));
    await db.delete(offspring).where(eq(offspring.userId, userId));
    await db.delete(breedingEvents).where(eq(breedingEvents.userId, userId));
    await db.delete(matingGroups).where(eq(matingGroups.userId, userId));
    await db.delete(animals).where(eq(animals.userId, userId));
    await db.delete(farmSettings).where(eq(farmSettings.userId, userId));
    console.log(`[Storage] All farm data cleared for user: ${userId}`);
  }
  
  // === BETA ACCESS - INVITE CODES ===
  async getInviteCodes(): Promise<InviteCode[]> {
    return await db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
  }
  
  async getInviteCodeByCode(code: string): Promise<InviteCode | undefined> {
    const results = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code));
    return results[0];
  }
  
  async createInviteCode(input: Omit<InsertInviteCode, 'status'>): Promise<InviteCode> {
    const results = await db.insert(inviteCodes).values({ ...input, status: 'active' }).returning();
    return results[0];
  }
  
  async updateInviteCode(id: number, updates: Partial<InsertInviteCode>): Promise<InviteCode | undefined> {
    const results = await db.update(inviteCodes).set(updates).where(eq(inviteCodes.id, id)).returning();
    return results[0];
  }
  
  async incrementInviteCodeUses(id: number): Promise<void> {
    await db.update(inviteCodes).set({ 
      usesCount: sql`${inviteCodes.usesCount} + 1`,
      lastValidatedAt: new Date()
    }).where(eq(inviteCodes.id, id));
  }
  
  async getActiveTestersCount(): Promise<number> {
    const results = await db.select().from(userActivations).where(eq(userActivations.status, 'active'));
    return results.length;
  }
  
  // === BETA ACCESS - USER ACTIVATIONS ===
  async getUserActivation(userId: string): Promise<UserActivation | undefined> {
    const results = await db.select().from(userActivations).where(eq(userActivations.userId, userId));
    return results[0];
  }
  
  async createUserActivation(activation: InsertUserActivation): Promise<UserActivation> {
    const results = await db.insert(userActivations).values(activation).returning();
    return results[0];
  }
  
  async updateUserActivation(userId: string, updates: Partial<Omit<UserActivation, 'id' | 'userId' | 'activatedAt'>>): Promise<UserActivation | undefined> {
    const results = await db.update(userActivations).set(updates).where(eq(userActivations.userId, userId)).returning();
    return results[0];
  }
  
  async getAllActiveActivations(): Promise<UserActivation[]> {
    return await db.select().from(userActivations).where(eq(userActivations.status, 'active'));
  }
  
  async getActivationByDeviceId(deviceId: string): Promise<UserActivation | undefined> {
    const results = await db.select().from(userActivations).where(eq(userActivations.deviceId, deviceId));
    return results[0];
  }
  
  // === DEVICE-BASED USERS ===
  async getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string } | undefined> {
    const { users } = await import("@shared/models/auth");
    const results = await db.select().from(users).where(eq(users.deviceId, deviceId));
    return results[0] ? { id: results[0].id, deviceId: results[0].deviceId! } : undefined;
  }
  
  async upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string }> {
    const { users } = await import("@shared/models/auth");
    const results = await db.insert(users).values({
      deviceId: data.deviceId,
      deviceName: data.deviceName || null,
    }).returning();
    return { id: results[0].id, deviceId: results[0].deviceId! };
  }
  
  async updateUserLastSeen(userId: string): Promise<void> {
    const { users } = await import("@shared/models/auth");
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
