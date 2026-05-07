import { db } from "./db";
import crypto from "crypto";
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
  eidScanEvents,
  exportedDocuments,
  flockHealthEvents,
  flockHealthTreatments,
  inviteCodes,
  userActivations,
  systemSettings,
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
  type InsertEidScanEvent,
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
  type EidScanEvent,
  type ExportedDocument,
  type FlockHealthEvent,
  type FlockHealthTreatment,
  type InviteCode,
  type UserActivation,
  type SystemSetting,
} from "@shared/schema";
import { eq, desc, and, sql, lt, gte, ilike, or, ne, inArray } from "drizzle-orm";
import { canonicalizeTag, splitTagInput } from "@shared/tag-utils";

export class DuplicateElectronicIdError extends Error {
  constructor(public electronicId: string) {
    super(`Electronic ID "${electronicId}" is already assigned to another animal`);
    this.name = "DuplicateElectronicIdError";
  }
}

export class DuplicateTagIdError extends Error {
  constructor(public tagId: string) {
    super(`Tag ID "${tagId}" is already assigned to another animal`);
    this.name = "DuplicateTagIdError";
  }
}

export class DuplicateAnimalNameError extends Error {
  constructor(public animalName: string) {
    super(`Animal name "${animalName}" is already assigned to another animal`);
    this.name = "DuplicateAnimalNameError";
  }
}

export interface IStorage {
  // Animals - ALL methods now require userId for data isolation
  getAnimals(userId: string, filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]>;
  getAnimal(userId: string, id: number): Promise<Animal | undefined>;
  createAnimal(userId: string, animal: Omit<InsertAnimal, 'userId'>): Promise<Animal>;
  updateAnimal(userId: string, id: number, animal: Partial<Omit<InsertAnimal, 'userId'>>): Promise<Animal>;
  deleteAnimal(userId: string, id: number): Promise<void>;
  getAnimalByElectronicId(userId: string, electronicId: string): Promise<Animal | undefined>;
  getAnimalByClientId(userId: string, clientId: string): Promise<Animal | undefined>;

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
  getAllPerformanceRecords(userId: string): Promise<PerformanceRecord[]>;
  createPerformanceRecord(userId: string, record: Omit<InsertPerformanceRecord, 'userId'>): Promise<PerformanceRecord>;
  getHealthRecords(userId: string, animalId: number): Promise<HealthRecord[]>;
  getAllHealthRecords(userId: string): Promise<HealthRecord[]>;
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
  createEidScanEvent(userId: string, event: Omit<InsertEidScanEvent, 'userId'>): Promise<EidScanEvent>;
  
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
  updateInviteCode(id: number, updates: Partial<InviteCode>): Promise<InviteCode | undefined>;
  deleteInviteCode(id: number): Promise<void>;
  incrementInviteCodeUses(id: number): Promise<void>;
  getActiveTestersCount(): Promise<number>;
  
  // Beta Access - User Activations
  getUserActivation(userId: string): Promise<UserActivation | undefined>;
  getActivationByDeviceId(deviceId: string): Promise<UserActivation | undefined>;
  createUserActivation(activation: InsertUserActivation): Promise<UserActivation>;
  updateUserActivation(userId: string, updates: Partial<Omit<UserActivation, 'id' | 'userId'>>): Promise<UserActivation | undefined>;
  getAllActiveActivations(): Promise<UserActivation[]>;
  getActivationsByCodeId(inviteCodeId: number): Promise<UserActivation[]>;
  deleteActivationsByInviteCodeId(inviteCodeId: number): Promise<void>;
  
  // Device-based Users
  getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string; sharedUserId: string | null } | undefined>;
  upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string; sharedUserId: string | null }>;
  setSharedUserId(userId: string, sharedUserId: string | null): Promise<void>;
  // Creates a stub user with no deviceId, used as a standalone workspace identity
  // (e.g., when a device switches to an invite code that has no other primary device,
  //  we mint a fresh workspace so the device's own user.id does not double as the workspace
  //  for two unrelated codes).
  createWorkspaceUser(label: string): Promise<{ id: string }>;
  updateUserLastSeen(userId: string): Promise<void>;
  
  // System Settings (global app config)
  getSystemSetting(key: string): Promise<string | undefined>;
  setSystemSetting(key: string, value: string, description?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private normalizeTagId(tagId?: string | null): string {
    return canonicalizeTag(tagId, undefined);
  }

  private normalizeAnimalName(name?: string | null): string | null {
    const trimmed = name?.trim();
    return trimmed ? trimmed.toLowerCase() : null;
  }

  private normalizeElectronicId(electronicId?: string | null): string | null {
    const trimmed = electronicId?.trim();
    return trimmed ? trimmed : null;
  }

  private async assertUniqueElectronicId(userId: string, electronicId?: string | null, excludeAnimalId?: number): Promise<void> {
    const normalized = this.normalizeElectronicId(electronicId);
    if (!normalized) return;

    const conditions = [eq(animals.userId, userId), eq(animals.electronicId, normalized)];
    if (excludeAnimalId !== undefined) {
      conditions.push(ne(animals.id, excludeAnimalId));
    }

    const [existing] = await db.select().from(animals).where(and(...conditions)).limit(1);
    if (existing) {
      throw new DuplicateElectronicIdError(normalized);
    }
  }

  private async assertUniqueTagId(userId: string, tagId?: string | null, excludeAnimalId?: number, studPrefix?: string | null): Promise<void> {
    const incoming = splitTagInput(tagId, studPrefix);
    if (!incoming.canonicalTag) return;

    const existingAnimals = await db.select().from(animals).where(eq(animals.userId, userId));
    const duplicate = existingAnimals.find((animal) => {
      if (excludeAnimalId !== undefined && animal.id === excludeAnimalId) return false;
      const candidate = splitTagInput(animal.tagId, animal.studPrefix);
      return (
        candidate.canonicalTag === incoming.canonicalTag ||
        (!!candidate.rawTag && !!incoming.rawTag && candidate.rawTag === incoming.rawTag)
      );
    });

    if (duplicate) {
      throw new DuplicateTagIdError(incoming.canonicalTag);
    }
  }

  private async resolveStudPrefix(userId: string, explicitPrefix?: string | null): Promise<string> {
    const provided = (explicitPrefix || "").trim();
    if (provided) return provided;
    const settings = await this.getFarmSettings(userId);
    return settings?.studPrefix || "";
  }

  private async assertUniqueAnimalName(userId: string, name?: string | null, excludeAnimalId?: number): Promise<void> {
    const normalized = this.normalizeAnimalName(name);
    if (!normalized) return;
    const conditions = [eq(animals.userId, userId), sql`lower(${animals.name}) = ${normalized}`];
    if (excludeAnimalId !== undefined) {
      conditions.push(ne(animals.id, excludeAnimalId));
    }
    const [existing] = await db.select().from(animals).where(and(...conditions)).limit(1);
    if (existing) {
      throw new DuplicateAnimalNameError(name!.trim());
    }
  }

  // Animals - ALL queries now filter by userId
  async getAnimals(userId: string, filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]> {
    let conditions = [eq(animals.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(animals.status, filters.status));
    }

    if (filters?.sex) {
      conditions.push(eq(animals.sex, filters.sex));
    }

    const searchTerm = filters?.search?.trim();
    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      conditions.push(or(
        ilike(animals.tagId, pattern),
        ilike(animals.name, pattern),
        ilike(animals.electronicId, pattern),
      )!);
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

  async getAnimalByElectronicId(userId: string, electronicId: string): Promise<Animal | undefined> {
    const normalized = this.normalizeElectronicId(electronicId);
    if (!normalized) return undefined;

    const [animal] = await db.select().from(animals).where(
      and(eq(animals.userId, userId), eq(animals.electronicId, normalized))
    );
    return animal;
  }

  async getAnimalByClientId(userId: string, clientId: string): Promise<Animal | undefined> {
    const [animal] = await db.select().from(animals).where(
      and(eq(animals.userId, userId), eq(animals.clientId, clientId))
    );
    return animal;
  }

  async createAnimal(userId: string, animal: Omit<InsertAnimal, 'userId'>): Promise<Animal> {
    const prefix = await this.resolveStudPrefix(userId, animal.studPrefix);
    const normalizedTag = splitTagInput(animal.tagId, prefix);
    await this.assertUniqueTagId(userId, normalizedTag.canonicalTag, undefined, normalizedTag.studPrefix);
    const normalizedElectronicId = this.normalizeElectronicId(animal.electronicId);
    await this.assertUniqueAnimalName(userId, animal.name);
    await this.assertUniqueElectronicId(userId, normalizedElectronicId);

    const [newAnimal] = await db.insert(animals).values({
      ...animal,
      tagId: normalizedTag.canonicalTag,
      rawTag: normalizedTag.rawTag || null,
      studPrefix: normalizedTag.studPrefix || null,
      electronicId: normalizedElectronicId,
      userId,
    }).returning();
    return newAnimal;
  }

  async updateAnimal(userId: string, id: number, updates: Partial<Omit<InsertAnimal, 'userId'>>): Promise<Animal> {
    if (Object.prototype.hasOwnProperty.call(updates, "tagId") || Object.prototype.hasOwnProperty.call(updates, "studPrefix")) {
      const existing = await this.getAnimal(userId, id);
      if (!existing) throw new Error("Animal not found");
      const prefix = await this.resolveStudPrefix(userId, updates.studPrefix ?? existing.studPrefix);
      const normalizedTag = splitTagInput(updates.tagId ?? existing.tagId, prefix);
      updates = {
        ...updates,
        tagId: normalizedTag.canonicalTag,
        rawTag: normalizedTag.rawTag || null,
        studPrefix: normalizedTag.studPrefix || null,
      };
      await this.assertUniqueTagId(userId, updates.tagId, id, updates.studPrefix);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "name")) {
      await this.assertUniqueAnimalName(userId, updates.name, id);
    }
    if (Object.prototype.hasOwnProperty.call(updates, "electronicId")) {
      updates = {
        ...updates,
        electronicId: this.normalizeElectronicId(updates.electronicId),
      };
      await this.assertUniqueElectronicId(userId, updates.electronicId, id);
    }

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

  async getAllPerformanceRecords(userId: string): Promise<PerformanceRecord[]> {
    return await db.select().from(performanceRecords)
      .where(eq(performanceRecords.userId, userId))
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

  async getAllHealthRecords(userId: string): Promise<HealthRecord[]> {
    return await db.select().from(healthRecords)
      .where(eq(healthRecords.userId, userId))
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

  async createEidScanEvent(userId: string, event: Omit<InsertEidScanEvent, 'userId'>): Promise<EidScanEvent> {
    const [newEvent] = await db.insert(eidScanEvents).values({ ...event, userId }).returning();
    return newEvent;
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

    const settings = await this.getFarmSettings(userId);
    const normalizedAnimals = animalsList.map((animal) => {
      const normalizedTag = splitTagInput(animal.tagId, animal.studPrefix || settings?.studPrefix || "");
      return {
        ...animal,
        tagId: normalizedTag.canonicalTag,
        rawTag: normalizedTag.rawTag || null,
        studPrefix: normalizedTag.studPrefix || null,
        electronicId: this.normalizeElectronicId(animal.electronicId),
      };
    });

    const providedElectronicIds = normalizedAnimals
      .map((animal) => animal.electronicId)
      .filter((electronicId): electronicId is string => !!electronicId);

    const duplicateInPayload = providedElectronicIds.find((electronicId, index) =>
      providedElectronicIds.indexOf(electronicId) !== index
    );
    if (duplicateInPayload) {
      throw new DuplicateElectronicIdError(duplicateInPayload);
    }

    if (providedElectronicIds.length > 0) {
      const existingMatches = await db.select({
        electronicId: animals.electronicId,
      }).from(animals).where(and(
        eq(animals.userId, userId),
        inArray(animals.electronicId, providedElectronicIds)
      ));

      const existingElectronicId = existingMatches[0]?.electronicId;
      if (existingElectronicId) {
        throw new DuplicateElectronicIdError(existingElectronicId);
      }
    }

    const normalizedTags = normalizedAnimals.map((animal) => this.normalizeTagId(animal.tagId));
    const duplicateTagInPayload = normalizedTags.find((tagId, index) => normalizedTags.indexOf(tagId) !== index);
    if (duplicateTagInPayload) {
      throw new DuplicateTagIdError(duplicateTagInPayload);
    }

    const animalsWithUserId = normalizedAnimals.map(a => ({ ...a, userId }));
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
    await db.delete(eidScanEvents).where(eq(eidScanEvents.userId, userId));
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
  
  async updateInviteCode(id: number, updates: Partial<InviteCode>): Promise<InviteCode | undefined> {
    const results = await db.update(inviteCodes).set(updates).where(eq(inviteCodes.id, id)).returning();
    return results[0];
  }
  
  async deleteInviteCode(id: number): Promise<void> {
    await db.delete(inviteCodes).where(eq(inviteCodes.id, id));
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
  
  async updateUserActivation(userId: string, updates: Partial<Omit<UserActivation, 'id' | 'userId'>>): Promise<UserActivation | undefined> {
    const results = await db.update(userActivations).set(updates).where(eq(userActivations.userId, userId)).returning();
    return results[0];
  }
  
  async getAllActiveActivations(): Promise<UserActivation[]> {
    return await db.select().from(userActivations).where(eq(userActivations.status, 'active'));
  }

  async getActivationsByCodeId(inviteCodeId: number): Promise<UserActivation[]> {
    return await db.select().from(userActivations).where(eq(userActivations.inviteCodeId, inviteCodeId));
  }
  
  async deleteActivationsByInviteCodeId(inviteCodeId: number): Promise<void> {
    await db.delete(userActivations).where(eq(userActivations.inviteCodeId, inviteCodeId));
  }

  async getActivationByDeviceId(deviceId: string): Promise<UserActivation | undefined> {
    const results = await db.select().from(userActivations).where(eq(userActivations.deviceId, deviceId));
    return results[0];
  }
  
  // === DEVICE-BASED USERS ===
  async getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string; sharedUserId: string | null } | undefined> {
    const { users } = await import("@shared/models/auth");
    const results = await db.select().from(users).where(eq(users.deviceId, deviceId));
    if (!results[0]) return undefined;
    return { id: results[0].id, deviceId: results[0].deviceId!, sharedUserId: results[0].sharedUserId ?? null };
  }
  
  async upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string; sharedUserId: string | null }> {
    const { users } = await import("@shared/models/auth");
    const results = await db.insert(users).values({
      deviceId: data.deviceId,
      deviceName: data.deviceName || null,
    }).returning();
    return { id: results[0].id, deviceId: results[0].deviceId!, sharedUserId: results[0].sharedUserId ?? null };
  }
  
  async setSharedUserId(userId: string, sharedUserId: string | null): Promise<void> {
    const { users } = await import("@shared/models/auth");
    await db.update(users).set({ sharedUserId }).where(eq(users.id, userId));
  }

  async createWorkspaceUser(label: string): Promise<{ id: string }> {
    const { users } = await import("@shared/models/auth");
    const results = await db.insert(users).values({
      deviceId: null,
      deviceName: label,
    }).returning();
    return { id: results[0].id };
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    const { users } = await import("@shared/models/auth");
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  }
  
  // === SYSTEM SETTINGS ===
  async getSystemSetting(key: string): Promise<string | undefined> {
    const results = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return results[0]?.value;
  }
  
  async setSystemSetting(key: string, value: string, description?: string): Promise<void> {
    await db.insert(systemSettings)
      .values({ key, value, description })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() }
      });
  }
}

class InMemoryStorage implements IStorage {
  private animalSeq = 1;
  private breedingSeq = 1;
  private matingSeq = 1;
  private recordSeq = 1;
  private genericSeq = 1;
  private inviteSeq = 1;
  private activationSeq = 1;
  private users = new Map<string, { id: string; deviceId: string; sharedUserId: string | null; deviceName?: string }>();
  private animals = new Map<number, Animal>();
  private breedingEvents = new Map<number, BreedingEvent>();
  private matingGroups = new Map<number, MatingGroup>();
  private performanceRecords = new Map<number, PerformanceRecord>();
  private healthRecords = new Map<number, HealthRecord>();
  private evaluations = new Map<number, Evaluation>();
  private farmSettings = new Map<string, FarmSettings>();
  private documents = new Map<number, Document>();
  private animalImages = new Map<number, AnimalImage>();
  private eidEvents = new Map<number, EidScanEvent>();
  private exportedDocuments = new Map<number, ExportedDocument>();
  private flockEvents = new Map<number, FlockHealthEvent>();
  private flockTreatments = new Map<number, FlockHealthTreatment>();
  private inviteCodes = new Map<number, InviteCode>();
  private activations = new Map<number, UserActivation>();
  private settings = new Map<string, string>();

  private now() { return new Date(); }
  private nextId(counter: "animalSeq" | "breedingSeq" | "matingSeq" | "recordSeq" | "genericSeq" | "inviteSeq" | "activationSeq") {
    const next = this[counter];
    this[counter] += 1;
    return next;
  }

  async getAnimals(userId: string, filters?: { search?: string; status?: string; sex?: string }): Promise<Animal[]> {
    let list = [...this.animals.values()].filter(a => a.userId === userId);
    if (filters?.status) list = list.filter(a => a.status === filters.status);
    if (filters?.sex) list = list.filter(a => a.sex === filters.sex);
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(a => a.tagId.toLowerCase().includes(s) || (a.name ?? "").toLowerCase().includes(s) || (a.electronicId ?? "").toLowerCase().includes(s));
    }
    return list;
  }
  async getAnimal(userId: string, id: number): Promise<Animal | undefined> { const a = this.animals.get(id); return a?.userId === userId ? a : undefined; }
  async createAnimal(userId: string, animal: Omit<InsertAnimal, "userId">): Promise<Animal> {
    const settings = await this.getFarmSettings(userId);
    const normalizedTagParts = splitTagInput(animal.tagId, animal.studPrefix || settings?.studPrefix || "");
    const normalizedTag = normalizedTagParts.canonicalTag;
    const duplicateTag = [...this.animals.values()].find(a => {
      if (a.userId !== userId) return false;
      const existing = splitTagInput(a.tagId, a.studPrefix);
      return (
        existing.canonicalTag === normalizedTag ||
        (!!existing.rawTag && !!normalizedTagParts.rawTag && existing.rawTag === normalizedTagParts.rawTag)
      );
    });
    if (duplicateTag) throw new DuplicateTagIdError(animal.tagId);
    if (animal.name?.trim()) {
      const normalizedName = animal.name.trim().toLowerCase();
      const duplicateName = [...this.animals.values()].find(a => a.userId === userId && (a.name || "").trim().toLowerCase() === normalizedName);
      if (duplicateName) throw new DuplicateAnimalNameError(animal.name);
    }
    if (animal.electronicId) {
      const duplicate = [...this.animals.values()].find(a => a.userId === userId && a.electronicId === animal.electronicId);
      if (duplicate) throw new DuplicateElectronicIdError(animal.electronicId);
    }
    const id = this.nextId("animalSeq");
    const rec = {
      id,
      ...animal,
      tagId: normalizedTagParts.canonicalTag,
      rawTag: normalizedTagParts.rawTag || null,
      studPrefix: normalizedTagParts.studPrefix || null,
      userId,
      createdAt: this.now(),
    } as Animal;
    this.animals.set(id, rec);
    return rec;
  }
  async updateAnimal(userId: string, id: number, animal: Partial<Omit<InsertAnimal, "userId">>): Promise<Animal> {
    const existing = await this.getAnimal(userId, id);
    if (!existing) throw new Error("Animal not found");
    if (animal.tagId?.trim() || animal.studPrefix !== undefined) {
      const settings = await this.getFarmSettings(userId);
      const normalizedTag = splitTagInput(animal.tagId || existing.tagId, animal.studPrefix || existing.studPrefix || settings?.studPrefix || "");
      const duplicateTag = [...this.animals.values()].find(a => {
        if (a.userId !== userId || a.id === id) return false;
        const existingTag = splitTagInput(a.tagId, a.studPrefix);
        return (
          existingTag.canonicalTag === normalizedTag.canonicalTag ||
          (!!existingTag.rawTag && !!normalizedTag.rawTag && existingTag.rawTag === normalizedTag.rawTag)
        );
      });
      if (duplicateTag) throw new DuplicateTagIdError(normalizedTag.canonicalTag);
      animal = {
        ...animal,
        tagId: normalizedTag.canonicalTag,
        rawTag: normalizedTag.rawTag || null,
        studPrefix: normalizedTag.studPrefix || null,
      };
    }
    if (animal.name?.trim()) {
      const normalizedName = animal.name.trim().toLowerCase();
      const duplicateName = [...this.animals.values()].find(a => a.userId === userId && a.id !== id && (a.name || "").trim().toLowerCase() === normalizedName);
      if (duplicateName) throw new DuplicateAnimalNameError(animal.name);
    }
    if (animal.electronicId) {
      const duplicate = [...this.animals.values()].find(a => a.userId === userId && a.electronicId === animal.electronicId && a.id !== id);
      if (duplicate) throw new DuplicateElectronicIdError(animal.electronicId);
    }
    const updated = { ...existing, ...animal } as Animal;
    this.animals.set(id, updated);
    return updated;
  }
  async deleteAnimal(userId: string, id: number): Promise<void> { const a = await this.getAnimal(userId, id); if (a) this.animals.delete(id); }
  async getAnimalByElectronicId(userId: string, electronicId: string): Promise<Animal | undefined> { return [...this.animals.values()].find(a => a.userId === userId && a.electronicId === electronicId); }
  async getAnimalByClientId(userId: string, clientId: string): Promise<Animal | undefined> { return [...this.animals.values()].find(a => a.userId === userId && a.clientId === clientId); }
  async getBreedingEvents(userId: string): Promise<BreedingEvent[]> { return [...this.breedingEvents.values()].filter(e => e.userId === userId); }
  async createBreedingEvent(userId: string, event: Omit<InsertBreedingEvent, "userId">): Promise<BreedingEvent> { const id = this.nextId("breedingSeq"); const v = { id, ...event, userId } as BreedingEvent; this.breedingEvents.set(id, v); return v; }
  async deleteBreedingEvent(userId: string, id: number): Promise<void> { const e = this.breedingEvents.get(id); if (e?.userId === userId) this.breedingEvents.delete(id); }
  async getOffspringByBreedingEvent(_userId: string, _eventId: number): Promise<Offspring[]> { return []; }
  async createOffspring(_userId: string, newOffspring: Omit<InsertOffspring, "userId">): Promise<Offspring> { return { id: this.nextId("genericSeq"), ...newOffspring, userId: "in-memory" } as Offspring; }
  async getMatingGroups(userId: string): Promise<MatingGroup[]> { return [...this.matingGroups.values()].filter(g => g.userId === userId); }
  async createMatingGroup(userId: string, group: Omit<InsertMatingGroup, "userId">): Promise<MatingGroup> { const id = this.nextId("matingSeq"); const v = { id, ...group, userId } as MatingGroup; this.matingGroups.set(id, v); return v; }
  async updateMatingGroup(userId: string, id: number, updates: Partial<Omit<InsertMatingGroup, "userId">>): Promise<MatingGroup | null> { const g = this.matingGroups.get(id); if (!g || g.userId !== userId) return null; const v = { ...g, ...updates } as MatingGroup; this.matingGroups.set(id, v); return v; }
  async deleteMatingGroup(userId: string, id: number): Promise<boolean> { const g = this.matingGroups.get(id); if (!g || g.userId !== userId) return false; this.matingGroups.delete(id); return true; }
  async getPerformanceRecords(userId: string, animalId: number): Promise<PerformanceRecord[]> { return [...this.performanceRecords.values()].filter(r => r.userId === userId && r.animalId === animalId); }
  async getAllPerformanceRecords(userId: string): Promise<PerformanceRecord[]> { return [...this.performanceRecords.values()].filter(r => r.userId === userId); }
  async createPerformanceRecord(userId: string, record: Omit<InsertPerformanceRecord, "userId">): Promise<PerformanceRecord> { const id = this.nextId("recordSeq"); const v = { id, ...record, userId } as PerformanceRecord; this.performanceRecords.set(id, v); return v; }
  async getHealthRecords(userId: string, animalId: number): Promise<HealthRecord[]> { return [...this.healthRecords.values()].filter(r => r.userId === userId && r.animalId === animalId); }
  async getAllHealthRecords(userId: string): Promise<HealthRecord[]> { return [...this.healthRecords.values()].filter(r => r.userId === userId); }
  async createHealthRecord(userId: string, record: Omit<InsertHealthRecord, "userId">): Promise<HealthRecord> { const id = this.nextId("recordSeq"); const v = { id, ...record, userId } as HealthRecord; this.healthRecords.set(id, v); return v; }
  async getEvaluations(userId: string, animalId: number): Promise<Evaluation[]> { return [...this.evaluations.values()].filter(e => e.userId === userId && e.animalId === animalId); }
  async createEvaluation(userId: string, evaluation: Omit<InsertEvaluation, "userId">): Promise<Evaluation> { const id = this.nextId("genericSeq"); const v = { id, ...evaluation, userId } as Evaluation; this.evaluations.set(id, v); return v; }
  async getFarmSettings(userId: string): Promise<FarmSettings | undefined> { return this.farmSettings.get(userId); }
  async saveFarmSettings(userId: string, settings: Omit<InsertFarmSettings, "userId">): Promise<FarmSettings> { const existing = this.farmSettings.get(userId); const value = { id: existing?.id ?? this.nextId("genericSeq"), ...settings, userId } as FarmSettings; this.farmSettings.set(userId, value); return value; }
  async getDocuments(userId: string): Promise<Document[]> { return [...this.documents.values()].filter(d => d.userId === userId); }
  async createDocument(userId: string, doc: Omit<InsertDocument, "userId">): Promise<Document> {
    const id = this.nextId("genericSeq");
    const v = {
      id,
      ...doc,
      userId,
      createdAt: this.now(),
      clientId: null,
      vectorClock: null,
      lastSyncedAt: null,
    } as Document;
    this.documents.set(id, v);
    return v;
  }
  async deleteDocument(userId: string, id: number): Promise<void> { const d = this.documents.get(id); if (d?.userId === userId) this.documents.delete(id); }
  async getAnimalImages(userId: string, animalId: number): Promise<AnimalImage[]> { return [...this.animalImages.values()].filter(i => i.userId === userId && i.animalId === animalId); }
  async createAnimalImage(userId: string, image: Omit<InsertAnimalImage, "userId">): Promise<AnimalImage> { const id = this.nextId("genericSeq"); const v = { id, ...image, userId, uploadedAt: this.now() } as AnimalImage; this.animalImages.set(id, v); return v; }
  async deleteAnimalImage(userId: string, id: number): Promise<void> { const i = this.animalImages.get(id); if (i?.userId === userId) this.animalImages.delete(id); }
  async createEidScanEvent(userId: string, event: Omit<InsertEidScanEvent, "userId">): Promise<EidScanEvent> { const id = this.nextId("genericSeq"); const v = { id, ...event, userId, createdAt: this.now(), scannedAt: this.now() } as EidScanEvent; this.eidEvents.set(id, v); return v; }
  async getExportedDocuments(userId: string, subfolder?: string): Promise<ExportedDocument[]> { return [...this.exportedDocuments.values()].filter(d => d.userId === userId && (!subfolder || d.subfolder === subfolder)); }
  async createExportedDocument(userId: string, doc: Omit<InsertExportedDocument, "userId">): Promise<ExportedDocument> {
    const id = this.nextId("genericSeq");
    const v = { id, ...doc, userId, exportedAt: this.now() } as ExportedDocument;
    this.exportedDocuments.set(id, v);
    return v;
  }
  async deleteExportedDocument(userId: string, id: number): Promise<void> { const d = this.exportedDocuments.get(id); if (d?.userId === userId) this.exportedDocuments.delete(id); }
  async clearAllData(userId: string): Promise<void> { for (const [id, a] of this.animals.entries()) if (a.userId === userId) this.animals.delete(id); }
  async getFlockHealthEvents(userId: string): Promise<FlockHealthEvent[]> { return [...this.flockEvents.values()].filter(e => e.userId === userId); }
  async getFlockHealthEvent(userId: string, id: number): Promise<FlockHealthEvent | undefined> { const e = this.flockEvents.get(id); return e?.userId === userId ? e : undefined; }
  async createFlockHealthEvent(userId: string, event: Omit<InsertFlockHealthEvent, "userId">): Promise<FlockHealthEvent> { const id = this.nextId("genericSeq"); const v = { id, ...event, userId, createdAt: this.now() } as FlockHealthEvent; this.flockEvents.set(id, v); return v; }
  async getFlockHealthTreatments(userId: string, eventId: number): Promise<FlockHealthTreatment[]> { return [...this.flockTreatments.values()].filter(t => t.userId === userId && t.eventId === eventId); }
  async createFlockHealthTreatments(userId: string, treatments: Omit<InsertFlockHealthTreatment, "userId">[]): Promise<FlockHealthTreatment[]> { return treatments.map(t => { const id = this.nextId("genericSeq"); const v = { id, ...t, userId } as FlockHealthTreatment; this.flockTreatments.set(id, v); return v; }); }
  async bulkCreateAnimals(userId: string, animalsList: Omit<InsertAnimal, "userId">[]): Promise<Animal[]> { const created: Animal[] = []; for (const a of animalsList) created.push(await this.createAnimal(userId, a)); return created; }
  async getInviteCodes(): Promise<InviteCode[]> { return [...this.inviteCodes.values()]; }
  async getInviteCodeByCode(code: string): Promise<InviteCode | undefined> { return [...this.inviteCodes.values()].find(c => c.code === code); }
  async createInviteCode(input: Omit<InsertInviteCode, "status">): Promise<InviteCode> { const id = this.nextId("inviteSeq"); const v = { id, ...input, status: "active", usesCount: 0, createdAt: this.now(), lastValidatedAt: null } as InviteCode; this.inviteCodes.set(id, v); return v; }
  async updateInviteCode(id: number, updates: Partial<InviteCode>): Promise<InviteCode | undefined> { const c = this.inviteCodes.get(id); if (!c) return undefined; const v = { ...c, ...updates } as InviteCode; this.inviteCodes.set(id, v); return v; }
  async deleteInviteCode(id: number): Promise<void> { this.inviteCodes.delete(id); }
  async incrementInviteCodeUses(id: number): Promise<void> { const c = this.inviteCodes.get(id); if (!c) return; this.inviteCodes.set(id, { ...c, usesCount: (c.usesCount ?? 0) + 1, lastValidatedAt: this.now() } as InviteCode); }
  async getActiveTestersCount(): Promise<number> { return [...this.activations.values()].filter(a => a.status === "active").length; }
  async getUserActivation(userId: string): Promise<UserActivation | undefined> { return [...this.activations.values()].find(a => a.userId === userId); }
  async getActivationByDeviceId(deviceId: string): Promise<UserActivation | undefined> { return [...this.activations.values()].find(a => a.deviceId === deviceId); }
  async createUserActivation(activation: InsertUserActivation): Promise<UserActivation> {
    // Mirror the production Postgres UNIQUE(userId) constraint so in-memory
    // tests catch the "INSERT into already-existing row" bug that previously
    // only manifested on real DBs.
    const collision = [...this.activations.values()].find((a) => a.userId === activation.userId);
    if (collision) {
      const err: any = new Error('duplicate key value violates unique constraint "user_activations_user_id_unique"');
      err.code = '23505';
      throw err;
    }
    const id = this.nextId("activationSeq");
    const v = {
      id,
      ...activation,
      activatedAt: this.now(),
      lastOnlineCheck: this.now(),
      offlineGraceStart: null,
    } as UserActivation;
    this.activations.set(id, v);
    return v;
  }
  async updateUserActivation(userId: string, updates: Partial<Omit<UserActivation, "id" | "userId">>): Promise<UserActivation | undefined> { const a = [...this.activations.values()].find(v => v.userId === userId); if (!a) return undefined; const v = { ...a, ...updates } as UserActivation; this.activations.set(v.id, v); return v; }
  async getAllActiveActivations(): Promise<UserActivation[]> { return [...this.activations.values()].filter(a => a.status === "active"); }
  async getActivationsByCodeId(inviteCodeId: number): Promise<UserActivation[]> { return [...this.activations.values()].filter(a => a.inviteCodeId === inviteCodeId); }
  async deleteActivationsByInviteCodeId(inviteCodeId: number): Promise<void> { for (const [id, a] of this.activations.entries()) if (a.inviteCodeId === inviteCodeId) this.activations.delete(id); }
  async getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string; sharedUserId: string | null } | undefined> { return [...this.users.values()].find(u => u.deviceId === deviceId); }
  async upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string; sharedUserId: string | null }> {
    const existing = await this.getUserByDeviceId(data.deviceId);
    if (existing) return existing;
    const id = crypto.randomUUID();
    const user = { id, deviceId: data.deviceId, sharedUserId: null, deviceName: data.deviceName };
    this.users.set(id, user);
    return user;
  }
  async setSharedUserId(userId: string, sharedUserId: string | null): Promise<void> { const user = this.users.get(userId); if (user) this.users.set(userId, { ...user, sharedUserId }); }
  async createWorkspaceUser(label: string): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    this.users.set(id, { id, deviceId: null as any, sharedUserId: null, deviceName: label });
    return { id };
  }
  async updateUserLastSeen(_userId: string): Promise<void> {}
  async getSystemSetting(key: string): Promise<string | undefined> { return this.settings.get(key); }
  async setSystemSetting(key: string, value: string): Promise<void> { this.settings.set(key, value); }
}

export const storage = process.env.USE_IN_MEMORY_STORAGE === "1"
  ? new InMemoryStorage()
  : new DatabaseStorage();
