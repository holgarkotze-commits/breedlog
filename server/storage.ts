import { db } from "./db";
import crypto from "crypto";
import type {
  Account,
  AccountAuditEvent,
  AccountDevice,
  AccountToken,
  AccountWorkspace,
} from "@shared/models/auth";
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
  fieldIssues,
  userActivityEvents,
  userAppSessions,
  bloodlines,
  geneticLines,
  animalBloodlines,
  type FieldIssue,
  type Bloodline,
  type InsertBloodline,
  type GeneticLine,
  type InsertGeneticLine,
  type AnimalBloodline,
  type InsertAnimalBloodline,
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
  type ActivityEvent,
  type InsertActivityEvent,
  type AppSession,
  type AdminActivityUser,
  type AdminActivitySummary,
  type AdminActivityUserDetail,
} from "@shared/schema";
import { eq, desc, and, sql, lt, gte, ilike, or, ne, inArray, count, avg, max, min } from "drizzle-orm";
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
  getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string; sharedUserId: string | null; deviceName?: string | null } | undefined>;
  upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string; sharedUserId: string | null; deviceName?: string | null }>;
  setSharedUserId(userId: string, sharedUserId: string | null): Promise<void>;
  // Creates a stub user with no deviceId, used as a standalone workspace identity
  // (e.g., when a device switches to an invite code that has no other primary device,
  //  we mint a fresh workspace so the device's own user.id does not double as the workspace
  //  for two unrelated codes).
  createWorkspaceUser(label: string): Promise<{ id: string }>;
  updateUserLastSeen(userId: string): Promise<void>;

  // Managed accounts
  getAccountByEmail(email: string): Promise<Account | undefined>;
  getAccountById(accountId: string): Promise<Account | undefined>;
  createAccount(data: { email: string; passwordHash?: string | null; authProvider?: string; emailVerified?: boolean; googleSubject?: string | null }): Promise<Account>;
  updateAccount(accountId: string, updates: Partial<Pick<Account, "passwordHash" | "emailVerified" | "emailVerifiedAt" | "recoveryRequired" | "lastLoginAt" | "status" | "googleSubject" | "updatedAt">>): Promise<Account | undefined>;
  getAccountWorkspace(accountId: string): Promise<AccountWorkspace | undefined>;
  linkAccountWorkspace(data: { accountId: string; workspaceUserId: string; legacyDeviceUserId?: string | null; migrationSource: string; migrationState?: string }): Promise<AccountWorkspace>;
  getAccountDevices(accountId: string): Promise<AccountDevice[]>;
  getAccountDeviceByDeviceId(deviceId: string): Promise<AccountDevice | undefined>;
  upsertAccountDevice(data: { accountId: string; workspaceUserId: string; deviceUserId: string; deviceId: string; deviceName?: string | null; platform?: string | null; authProvider?: string; status?: string }): Promise<AccountDevice>;
  revokeAccountDevice(accountId: string, deviceId: string, now?: Date): Promise<AccountDevice | undefined>;
  deleteAccountDevices(accountId: string): Promise<void>;
  createAccountToken(data: { accountId: string; tokenType: string; tokenHash: string; expiresAt: Date; metadata?: Record<string, unknown> | null }): Promise<AccountToken>;
  getAccountToken(tokenType: string, tokenHash: string): Promise<AccountToken | undefined>;
  consumeAccountToken(tokenId: string, now?: Date): Promise<void>;
  createAccountAuditEvent(data: { accountId?: string | null; workspaceUserId?: string | null; deviceId?: string | null; eventType: string; result?: string; detail?: string | null; metadata?: Record<string, unknown> | null; occurredAt?: Date }): Promise<AccountAuditEvent>;
  getAccountAuditEvents(accountId: string): Promise<AccountAuditEvent[]>;
  
  // System Settings (global app config)
  getSystemSetting(key: string): Promise<string | undefined>;
  setSystemSetting(key: string, value: string, description?: string): Promise<void>;
  deleteSystemSetting(key: string): Promise<void>;
  listSystemSettings(prefix: string): Promise<Array<{ key: string; value: string }>>;
  listWorkspaceUserIds(): Promise<string[]>;

  // Field Test Issue Reports
  createFieldIssue(data: { userId?: string; inviteCodeRef?: string; title: string; description: string; area: string; severity: string; deviceType?: string; appMode?: string; contactName?: string; currentRoute?: string; appVersion?: string }): Promise<import("@shared/schema").FieldIssue>;
  getFieldIssues(filters?: { status?: string; severity?: string; area?: string; search?: string }): Promise<import("@shared/schema").FieldIssue[]>;
  getFieldIssue(id: number): Promise<import("@shared/schema").FieldIssue | undefined>;
  updateFieldIssue(id: number, updates: { status?: string; adminNotes?: string; emailSent?: boolean }): Promise<import("@shared/schema").FieldIssue | undefined>;

  // Activity Telemetry
  createActivityEvent(data: Omit<InsertActivityEvent, 'id' | 'createdAt'>): Promise<ActivityEvent>;
  upsertAppSession(sessionId: string, userId: string, deviceId?: string): Promise<AppSession>;
  heartbeatAppSession(sessionId: string, userId: string): Promise<AppSession | undefined>;
  endAppSession(sessionId: string, userId: string): Promise<void>;
  // Admin: Activity
  getAdminActivitySummary(): Promise<AdminActivitySummary>;
  getAdminActivityUsers(filters?: { sortBy?: string; filterBy?: string }): Promise<AdminActivityUser[]>;
  getAdminActivityUserDetail(userId: string): Promise<AdminActivityUserDetail | undefined>;
  getAdminActivityEvents(filters?: { userId?: string; eventType?: string; limit?: number }): Promise<ActivityEvent[]>;

  // Genetics Module
  getBloodlines(userId: string): Promise<Bloodline[]>;
  createBloodline(userId: string, data: InsertBloodline): Promise<Bloodline>;
  updateBloodline(userId: string, id: number, data: Partial<InsertBloodline>): Promise<Bloodline | undefined>;
  deleteBloodline(userId: string, id: number): Promise<void>;
  getGeneticLines(userId: string): Promise<GeneticLine[]>;
  createGeneticLine(userId: string, data: InsertGeneticLine): Promise<GeneticLine>;
  updateGeneticLine(userId: string, id: number, data: Partial<InsertGeneticLine>): Promise<GeneticLine | undefined>;
  deleteGeneticLine(userId: string, id: number): Promise<void>;
  getAnimalBloodlines(userId: string, animalId: number): Promise<AnimalBloodline[]>;
  setAnimalBloodline(userId: string, data: InsertAnimalBloodline): Promise<AnimalBloodline>;
  removeAnimalBloodline(userId: string, id: number): Promise<void>;
  seedGeneticsForUser(userId: string, bloodlineNames: string[]): Promise<void>;
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
      createdAt: (animal as Partial<Animal>).createdAt ?? new Date(),
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
    await db.delete(animalBloodlines).where(eq(animalBloodlines.userId, userId));
    await db.delete(geneticLines).where(eq(geneticLines.userId, userId));
    await db.delete(bloodlines).where(eq(bloodlines.userId, userId));
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
  async getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string; sharedUserId: string | null; deviceName?: string | null } | undefined> {
    const { users } = await import("@shared/models/auth");
    const results = await db.select().from(users).where(eq(users.deviceId, deviceId));
    if (!results[0]) return undefined;
    return { id: results[0].id, deviceId: results[0].deviceId!, sharedUserId: results[0].sharedUserId ?? null, deviceName: results[0].deviceName ?? null };
  }
  
  async upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string; sharedUserId: string | null; deviceName?: string | null }> {
    const { users } = await import("@shared/models/auth");
    const results = await db.insert(users).values({
      deviceId: data.deviceId,
      deviceName: data.deviceName || null,
    }).returning();
    return { id: results[0].id, deviceId: results[0].deviceId!, sharedUserId: results[0].sharedUserId ?? null, deviceName: results[0].deviceName ?? null };
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

  async getAccountByEmail(email: string): Promise<Account | undefined> {
    const { accounts } = await import("@shared/models/auth");
    const normalizedEmail = email.trim().toLowerCase();
    const results = await db.select().from(accounts).where(eq(accounts.email, normalizedEmail));
    return results[0];
  }

  async getAccountById(accountId: string): Promise<Account | undefined> {
    const { accounts } = await import("@shared/models/auth");
    const results = await db.select().from(accounts).where(eq(accounts.id, accountId));
    return results[0];
  }

  async createAccount(data: { email: string; passwordHash?: string | null; authProvider?: string; emailVerified?: boolean; googleSubject?: string | null }): Promise<Account> {
    const { accounts } = await import("@shared/models/auth");
    const results = await db.insert(accounts).values({
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash ?? null,
      authProvider: data.authProvider ?? "local",
      emailVerified: data.emailVerified ?? false,
      emailVerifiedAt: data.emailVerified ? new Date() : null,
      googleSubject: data.googleSubject ?? null,
    }).returning();
    return results[0];
  }

  async updateAccount(accountId: string, updates: Partial<Pick<Account, "passwordHash" | "emailVerified" | "emailVerifiedAt" | "recoveryRequired" | "lastLoginAt" | "status" | "googleSubject" | "updatedAt">>): Promise<Account | undefined> {
    const { accounts } = await import("@shared/models/auth");
    const results = await db.update(accounts).set({ ...updates, updatedAt: new Date() }).where(eq(accounts.id, accountId)).returning();
    return results[0];
  }

  async getAccountWorkspace(accountId: string): Promise<AccountWorkspace | undefined> {
    const { accountWorkspaces } = await import("@shared/models/auth");
    const results = await db.select().from(accountWorkspaces).where(eq(accountWorkspaces.accountId, accountId));
    return results[0];
  }

  async linkAccountWorkspace(data: { accountId: string; workspaceUserId: string; legacyDeviceUserId?: string | null; migrationSource: string; migrationState?: string }): Promise<AccountWorkspace> {
    const { accountWorkspaces } = await import("@shared/models/auth");
    const results = await db.insert(accountWorkspaces).values({
      accountId: data.accountId,
      workspaceUserId: data.workspaceUserId,
      legacyDeviceUserId: data.legacyDeviceUserId ?? null,
      migrationSource: data.migrationSource,
      migrationState: data.migrationState ?? "completed",
    }).onConflictDoUpdate({
      target: accountWorkspaces.accountId,
      set: {
        workspaceUserId: data.workspaceUserId,
        legacyDeviceUserId: data.legacyDeviceUserId ?? null,
        migrationSource: data.migrationSource,
        migrationState: data.migrationState ?? "completed",
        updatedAt: new Date(),
      },
    }).returning();
    return results[0];
  }

  async getAccountDevices(accountId: string): Promise<AccountDevice[]> {
    const { accountDevices } = await import("@shared/models/auth");
    return db.select().from(accountDevices).where(eq(accountDevices.accountId, accountId));
  }

  async getAccountDeviceByDeviceId(deviceId: string): Promise<AccountDevice | undefined> {
    const { accountDevices } = await import("@shared/models/auth");
    const results = await db.select().from(accountDevices).where(eq(accountDevices.deviceId, deviceId));
    return results[0];
  }

  async upsertAccountDevice(data: { accountId: string; workspaceUserId: string; deviceUserId: string; deviceId: string; deviceName?: string | null; platform?: string | null; authProvider?: string; status?: string }): Promise<AccountDevice> {
    const { accountDevices } = await import("@shared/models/auth");
    const results = await db.insert(accountDevices).values({
      accountId: data.accountId,
      workspaceUserId: data.workspaceUserId,
      deviceUserId: data.deviceUserId,
      deviceId: data.deviceId,
      deviceName: data.deviceName ?? null,
      platform: data.platform ?? null,
      authProvider: data.authProvider ?? "local",
      status: data.status ?? "active",
      lastSeenAt: new Date(),
    }).onConflictDoUpdate({
      target: accountDevices.deviceId,
      set: {
        accountId: data.accountId,
        workspaceUserId: data.workspaceUserId,
        deviceUserId: data.deviceUserId,
        deviceName: data.deviceName ?? null,
        platform: data.platform ?? null,
        authProvider: data.authProvider ?? "local",
        status: data.status ?? "active",
        revokedAt: null,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      },
    }).returning();
    return results[0];
  }

  async revokeAccountDevice(accountId: string, deviceId: string, now = new Date()): Promise<AccountDevice | undefined> {
    const { accountDevices } = await import("@shared/models/auth");
    const results = await db.update(accountDevices).set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    }).where(and(eq(accountDevices.accountId, accountId), eq(accountDevices.deviceId, deviceId))).returning();
    return results[0];
  }

  async deleteAccountDevices(accountId: string): Promise<void> {
    const { accountDevices } = await import("@shared/models/auth");
    await db.delete(accountDevices).where(eq(accountDevices.accountId, accountId));
  }

  async createAccountToken(data: { accountId: string; tokenType: string; tokenHash: string; expiresAt: Date; metadata?: Record<string, unknown> | null }): Promise<AccountToken> {
    const { accountTokens } = await import("@shared/models/auth");
    const results = await db.insert(accountTokens).values({
      accountId: data.accountId,
      tokenType: data.tokenType,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      metadata: data.metadata ?? null,
    }).returning();
    return results[0];
  }

  async getAccountToken(tokenType: string, tokenHash: string): Promise<AccountToken | undefined> {
    const { accountTokens } = await import("@shared/models/auth");
    const results = await db.select().from(accountTokens).where(and(eq(accountTokens.tokenType, tokenType), eq(accountTokens.tokenHash, tokenHash)));
    return results[0];
  }

  async consumeAccountToken(tokenId: string, now = new Date()): Promise<void> {
    const { accountTokens } = await import("@shared/models/auth");
    await db.update(accountTokens).set({ consumedAt: now }).where(eq(accountTokens.id, tokenId));
  }

  async createAccountAuditEvent(data: { accountId?: string | null; workspaceUserId?: string | null; deviceId?: string | null; eventType: string; result?: string; detail?: string | null; metadata?: Record<string, unknown> | null; occurredAt?: Date }): Promise<AccountAuditEvent> {
    const { accountAuditEvents } = await import("@shared/models/auth");
    const results = await db.insert(accountAuditEvents).values({
      accountId: data.accountId ?? null,
      workspaceUserId: data.workspaceUserId ?? null,
      deviceId: data.deviceId ?? null,
      eventType: data.eventType,
      result: data.result ?? "success",
      detail: data.detail ?? null,
      metadata: data.metadata ?? null,
      occurredAt: data.occurredAt ?? new Date(),
    }).returning();
    return results[0];
  }

  async getAccountAuditEvents(accountId: string): Promise<AccountAuditEvent[]> {
    const { accountAuditEvents } = await import("@shared/models/auth");
    return db.select().from(accountAuditEvents).where(eq(accountAuditEvents.accountId, accountId)).orderBy(desc(accountAuditEvents.occurredAt));
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

  async deleteSystemSetting(key: string): Promise<void> {
    await db.delete(systemSettings).where(eq(systemSettings.key, key));
  }

  async listSystemSettings(prefix: string): Promise<Array<{ key: string; value: string }>> {
    const pattern = `${prefix}%`;
    const rows = await db.select({ key: systemSettings.key, value: systemSettings.value })
      .from(systemSettings)
      .where(sql`${systemSettings.key} LIKE ${pattern}`);
    return rows;
  }

  async listWorkspaceUserIds(): Promise<string[]> {
    const { users } = await import("@shared/models/auth");
    const rows = await db.select({ id: users.id, sharedUserId: users.sharedUserId }).from(users);
    return [...new Set(rows.map((row) => row.sharedUserId || row.id))];
  }

  // === FIELD TEST ISSUES ===
  async createFieldIssue(data: { userId?: string; inviteCodeRef?: string; title: string; description: string; area: string; severity: string; deviceType?: string; appMode?: string; contactName?: string; currentRoute?: string; appVersion?: string }): Promise<FieldIssue> {
    const [issue] = await db.insert(fieldIssues).values({
      userId: data.userId || null,
      inviteCodeRef: data.inviteCodeRef || null,
      title: data.title,
      description: data.description,
      area: data.area,
      severity: data.severity,
      deviceType: data.deviceType || null,
      appMode: data.appMode || null,
      contactName: data.contactName || null,
      currentRoute: data.currentRoute || null,
      appVersion: data.appVersion || null,
      status: "new",
      emailSent: false,
    }).returning();
    return issue;
  }

  async getFieldIssues(filters?: { status?: string; severity?: string; area?: string; search?: string }): Promise<FieldIssue[]> {
    let query = db.select().from(fieldIssues).$dynamic();
    const conditions = [];
    if (filters?.status) conditions.push(eq(fieldIssues.status, filters.status));
    if (filters?.severity) conditions.push(eq(fieldIssues.severity, filters.severity));
    if (filters?.area) conditions.push(eq(fieldIssues.area, filters.area));
    if (filters?.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(ilike(fieldIssues.title, s), ilike(fieldIssues.description, s)));
    }
    if (conditions.length > 0) query = query.where(and(...conditions));
    return query.orderBy(desc(fieldIssues.createdAt));
  }

  async getFieldIssue(id: number): Promise<FieldIssue | undefined> {
    const [issue] = await db.select().from(fieldIssues).where(eq(fieldIssues.id, id));
    return issue;
  }

  async updateFieldIssue(id: number, updates: { status?: string; adminNotes?: string; emailSent?: boolean }): Promise<FieldIssue | undefined> {
    const [updated] = await db.update(fieldIssues)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fieldIssues.id, id))
      .returning();
    return updated;
  }

  // ── Activity Telemetry ─────────────────────────────────────────────────────

  async createActivityEvent(data: Omit<InsertActivityEvent, 'id' | 'createdAt'>): Promise<ActivityEvent> {
    const [row] = await db.insert(userActivityEvents).values({ ...data }).returning();
    return row;
  }

  async upsertAppSession(sessionId: string, userId: string, deviceId?: string): Promise<AppSession> {
    const existing = await db.select().from(userAppSessions)
      .where(eq(userAppSessions.sessionId, sessionId)).limit(1);
    if (existing.length > 0) return existing[0];
    const [row] = await db.insert(userAppSessions)
      .values({ sessionId, userId, deviceId: deviceId ?? null, isActive: true })
      .returning();
    return row;
  }

  async heartbeatAppSession(sessionId: string, userId: string): Promise<AppSession | undefined> {
    const now = new Date();
    const [session] = await db.select().from(userAppSessions)
      .where(and(eq(userAppSessions.sessionId, sessionId), eq(userAppSessions.userId, userId)))
      .limit(1);
    if (!session) return undefined;
    const durationSeconds = Math.round((now.getTime() - session.startedAt.getTime()) / 1000);
    const [updated] = await db.update(userAppSessions)
      .set({ lastHeartbeatAt: now, durationSeconds, isActive: true })
      .where(eq(userAppSessions.sessionId, sessionId))
      .returning();
    return updated;
  }

  async endAppSession(sessionId: string, userId: string): Promise<void> {
    const [session] = await db.select().from(userAppSessions)
      .where(and(eq(userAppSessions.sessionId, sessionId), eq(userAppSessions.userId, userId)))
      .limit(1);
    if (!session) return;
    const endedAt = new Date();
    const durationSeconds = Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000);
    await db.update(userAppSessions)
      .set({ endedAt, durationSeconds, isActive: false })
      .where(eq(userAppSessions.sessionId, sessionId));
  }

  private async _buildActivityUser(activation: UserActivation, inviteCode: InviteCode | undefined): Promise<AdminActivityUser> {
    const uid = activation.userId;
    const now = new Date();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const events = await db.select().from(userActivityEvents)
      .where(eq(userActivityEvents.userId, uid))
      .orderBy(desc(userActivityEvents.occurredAt));

    const sessions = await db.select().from(userAppSessions)
      .where(eq(userAppSessions.userId, uid))
      .orderBy(desc(userAppSessions.startedAt));

    const lastSeen = events[0]?.occurredAt ?? sessions[0]?.lastHeartbeatAt ?? null;
    const syncEvents = events.filter(e => e.eventType === 'sync_success');
    const lastSync = syncEvents[0]?.occurredAt ?? null;
    const sortedSessions = sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const lastSessionStart = sortedSessions[0]?.startedAt ?? null;
    const lastSessionEnd = sortedSessions[0]?.endedAt ?? sortedSessions[0]?.lastHeartbeatAt ?? null;
    const totalSeconds = sessions.reduce((s, sess) => s + (sess.durationSeconds ?? 0), 0);
    const exportEvents = events.filter(e => e.eventCategory === 'export');
    const lastFeature = events.find(e => e.feature)?.feature ?? null;

    // Activity score
    let score = 0;
    const hasRecentOpen = events.some(e => e.eventType === 'app_open' && e.occurredAt >= day1);
    const hasActiveSession = sessions.some(s => s.lastHeartbeatAt >= day1);
    const hasSyncLast7d = syncEvents.some(e => e.occurredAt >= day7);
    const hasRecordLast7d = events.some(e => ['animal_created','animal_updated','breeding_record_created','health_record_created','performance_record_created'].includes(e.eventType) && e.occurredAt >= day7);
    const hasExport = exportEvents.length > 0;
    const sessions7d = sessions.filter(s => s.startedAt >= day7);
    if (hasRecentOpen) score += 15;
    if (hasActiveSession) score += 20;
    if (hasSyncLast7d) score += 15;
    if (hasRecordLast7d) score += 20;
    if (hasExport) score += 10;
    if (sessions7d.length > 1) score += 20;
    score = Math.min(100, score);

    let status = 'No activity';
    if (score >= 80) status = 'Strong tester';
    else if (score >= 50) status = 'Active tester';
    else if (score >= 20) status = 'Light activity';
    else if (score >= 1) status = 'Low use';

    return {
      userId: uid,
      deviceId: activation.deviceId,
      deviceType: activation.deviceType,
      inviteCode: inviteCode?.code ?? null,
      activatedAt: activation.activatedAt,
      lastSeen,
      lastSync,
      lastSessionStart,
      lastSessionEnd,
      estimatedTimeSpentSeconds: totalSeconds,
      sessionCount: sessions.length,
      activityScore: score,
      exportDownloadCount: exportEvents.length,
      lastFeatureUsed: lastFeature,
      status,
    };
  }

  async getAdminActivitySummary(): Promise<AdminActivitySummary> {
    const now = new Date();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const min30 = new Date(now.getTime() - 30 * 60 * 1000);

    const [totalActivatedUsers] = await db.select({ c: count() }).from(userActivations)
      .where(eq(userActivations.status, 'active'));
    const [activeToday] = await db.select({ c: sql<number>`count(distinct ${userActivityEvents.userId})` })
      .from(userActivityEvents).where(gte(userActivityEvents.occurredAt, day1));
    const [activeLast7Days] = await db.select({ c: sql<number>`count(distinct ${userActivityEvents.userId})` })
      .from(userActivityEvents).where(gte(userActivityEvents.occurredAt, day7));
    const [recentlySeen] = await db.select({ c: sql<number>`count(distinct ${userActivityEvents.userId})` })
      .from(userActivityEvents).where(gte(userActivityEvents.occurredAt, min30));
    const [withSync] = await db.select({ c: sql<number>`count(distinct ${userActivityEvents.userId})` })
      .from(userActivityEvents).where(eq(userActivityEvents.eventType, 'sync_success'));
    const [totalSessions] = await db.select({ c: count() }).from(userAppSessions);
    const [avgDur] = await db.select({ a: avg(userAppSessions.durationSeconds) }).from(userAppSessions)
      .where(sql`${userAppSessions.durationSeconds} is not null`);
    const [exportCount] = await db.select({ c: count() }).from(userActivityEvents)
      .where(eq(userActivityEvents.eventCategory, 'export'));

    const activations = await db.select().from(userActivations).where(eq(userActivations.status, 'active'));
    const codes = await db.select().from(inviteCodes);
    const codeMap = new Map(codes.map(c => [c.id, c]));

    const allUsers = await Promise.all(activations.map(a => this._buildActivityUser(a, codeMap.get(a.inviteCodeId))));
    const usersWithNoActivity = allUsers.filter(u => u.activityScore === 0).length;
    const mostActiveTesters = [...allUsers].sort((a, b) => b.activityScore - a.activityScore).slice(0, 5);

    return {
      totalActivatedUsers: Number(totalActivatedUsers?.c ?? 0),
      activeToday: Number(activeToday?.c ?? 0),
      activeLast7Days: Number(activeLast7Days?.c ?? 0),
      recentlySeen: Number(recentlySeen?.c ?? 0),
      usersWithSyncActivity: Number(withSync?.c ?? 0),
      usersWithNoActivity,
      totalSessions: Number(totalSessions?.c ?? 0),
      avgSessionDurationSeconds: Number(avgDur?.a ?? 0),
      exportDownloadCount: Number(exportCount?.c ?? 0),
      mostActiveTesters,
    };
  }

  async getAdminActivityUsers(filters?: { sortBy?: string; filterBy?: string }): Promise<AdminActivityUser[]> {
    const activations = await db.select().from(userActivations).where(eq(userActivations.status, 'active'));
    const codes = await db.select().from(inviteCodes);
    const codeMap = new Map(codes.map(c => [c.id, c]));
    let users = await Promise.all(activations.map(a => this._buildActivityUser(a, codeMap.get(a.inviteCodeId))));

    if (filters?.filterBy === 'active_today') {
      const day1 = new Date(Date.now() - 24 * 60 * 60 * 1000);
      users = users.filter(u => u.lastSeen && u.lastSeen >= day1);
    } else if (filters?.filterBy === 'dormant') {
      const day7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      users = users.filter(u => !u.lastSeen || u.lastSeen < day7);
    } else if (filters?.filterBy === 'no_activity') {
      users = users.filter(u => u.activityScore === 0);
    }

    const sortBy = filters?.sortBy ?? 'activityScore';
    users.sort((a, b) => {
      if (sortBy === 'lastSeen') return (b.lastSeen?.getTime() ?? 0) - (a.lastSeen?.getTime() ?? 0);
      if (sortBy === 'lastSync') return (b.lastSync?.getTime() ?? 0) - (a.lastSync?.getTime() ?? 0);
      if (sortBy === 'sessionCount') return b.sessionCount - a.sessionCount;
      if (sortBy === 'activatedAt') return (b.activatedAt?.getTime() ?? 0) - (a.activatedAt?.getTime() ?? 0);
      return b.activityScore - a.activityScore;
    });
    return users;
  }

  async getAdminActivityUserDetail(userId: string): Promise<AdminActivityUserDetail | undefined> {
    const activation = await db.select().from(userActivations)
      .where(eq(userActivations.userId, userId)).limit(1);
    if (!activation.length) return undefined;
    const codes = await db.select().from(inviteCodes);
    const codeMap = new Map(codes.map(c => [c.id, c]));
    const base = await this._buildActivityUser(activation[0], codeMap.get(activation[0].inviteCodeId));
    const recentEvents = await db.select().from(userActivityEvents)
      .where(eq(userActivityEvents.userId, userId))
      .orderBy(desc(userActivityEvents.occurredAt)).limit(50);
    const day7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sessions7d = await db.select().from(userAppSessions)
      .where(and(eq(userAppSessions.userId, userId), gte(userAppSessions.startedAt, day7)))
      .orderBy(desc(userAppSessions.startedAt));
    return { ...base, recentEvents, sessions7d };
  }

  async getAdminActivityEvents(filters?: { userId?: string; eventType?: string; limit?: number }): Promise<ActivityEvent[]> {
    let query = db.select().from(userActivityEvents).$dynamic();
    const conditions = [];
    if (filters?.userId) conditions.push(eq(userActivityEvents.userId, filters.userId));
    if (filters?.eventType) conditions.push(eq(userActivityEvents.eventType, filters.eventType));
    if (conditions.length) query = query.where(and(...conditions));
    query = query.orderBy(desc(userActivityEvents.occurredAt)).limit(filters?.limit ?? 100);
    return query;
  }

  // ── Genetics Module ──────────────────────────────────────────────────────────
  async getBloodlines(userId: string): Promise<Bloodline[]> {
    return db.select().from(bloodlines).where(eq(bloodlines.userId, userId)).orderBy(bloodlines.name);
  }
  async createBloodline(userId: string, data: InsertBloodline): Promise<Bloodline> {
    const [row] = await db.insert(bloodlines).values({ ...data, userId }).returning();
    return row;
  }
  async updateBloodline(userId: string, id: number, data: Partial<InsertBloodline>): Promise<Bloodline | undefined> {
    const [row] = await db.update(bloodlines).set(data).where(and(eq(bloodlines.id, id), eq(bloodlines.userId, userId))).returning();
    return row;
  }
  async deleteBloodline(userId: string, id: number): Promise<void> {
    await db.delete(bloodlines).where(and(eq(bloodlines.id, id), eq(bloodlines.userId, userId)));
  }
  async getGeneticLines(userId: string): Promise<GeneticLine[]> {
    return db.select().from(geneticLines).where(eq(geneticLines.userId, userId)).orderBy(geneticLines.lineName);
  }
  async createGeneticLine(userId: string, data: InsertGeneticLine): Promise<GeneticLine> {
    const [row] = await db.insert(geneticLines).values({ ...data, userId }).returning();
    return row;
  }
  async updateGeneticLine(userId: string, id: number, data: Partial<InsertGeneticLine>): Promise<GeneticLine | undefined> {
    const [row] = await db.update(geneticLines).set(data).where(and(eq(geneticLines.id, id), eq(geneticLines.userId, userId))).returning();
    return row;
  }
  async deleteGeneticLine(userId: string, id: number): Promise<void> {
    await db.delete(geneticLines).where(and(eq(geneticLines.id, id), eq(geneticLines.userId, userId)));
  }
  async getAnimalBloodlines(userId: string, animalId: number): Promise<AnimalBloodline[]> {
    return db.select().from(animalBloodlines).where(and(eq(animalBloodlines.userId, userId), eq(animalBloodlines.animalId, animalId)));
  }
  async setAnimalBloodline(userId: string, data: InsertAnimalBloodline): Promise<AnimalBloodline> {
    const existing = await db.select().from(animalBloodlines)
      .where(and(eq(animalBloodlines.userId, userId), eq(animalBloodlines.animalId, data.animalId), eq(animalBloodlines.role, data.role ?? 'primary'))).limit(1);
    if (existing.length) {
      const [row] = await db.update(animalBloodlines).set({ bloodlineId: data.bloodlineId, geneticLineId: data.geneticLineId, breedingSystem: data.breedingSystem, sourceConfidence: data.sourceConfidence, notes: data.notes })
        .where(eq(animalBloodlines.id, existing[0].id)).returning();
      return row;
    }
    const [row] = await db.insert(animalBloodlines).values({ ...data, userId }).returning();
    return row;
  }
  async removeAnimalBloodline(userId: string, id: number): Promise<void> {
    await db.delete(animalBloodlines).where(and(eq(animalBloodlines.id, id), eq(animalBloodlines.userId, userId)));
  }
  async seedGeneticsForUser(userId: string, bloodlineNames: string[]): Promise<void> {
    const existing = await this.getBloodlines(userId);
    const existingNames = new Set(existing.map(b => b.name));
    for (const name of bloodlineNames) {
      if (!existingNames.has(name)) {
        await this.createBloodline(userId, { name, type: 'foundation_line', status: 'active', evidenceStatus: 'unknown', notes: 'Kwantam demo bloodline' });
      }
    }
  }
}

export class InMemoryStorage implements IStorage {
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
  private accounts = new Map<string, Account>();
  private accountWorkspacesMap = new Map<string, AccountWorkspace>();
  private accountDevicesMap = new Map<string, AccountDevice>();
  private accountTokensMap = new Map<string, AccountToken>();
  private accountAuditMap = new Map<string, AccountAuditEvent>();

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
      createdAt: (animal as Partial<Animal>).createdAt ?? this.now(),
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
  async clearAllData(userId: string): Promise<void> {
    for (const [id, a] of this.animals.entries()) if (a.userId === userId) this.animals.delete(id);
    for (const [id, e] of this.breedingEvents.entries()) if (e.userId === userId) this.breedingEvents.delete(id);
    for (const [id, g] of this.matingGroups.entries()) if (g.userId === userId) this.matingGroups.delete(id);
    for (const [id, r] of this.performanceRecords.entries()) if (r.userId === userId) this.performanceRecords.delete(id);
    for (const [id, r] of this.healthRecords.entries()) if (r.userId === userId) this.healthRecords.delete(id);
    for (const [id, e] of this.evaluations.entries()) if (e.userId === userId) this.evaluations.delete(id);
    for (const [id, d] of this.documents.entries()) if (d.userId === userId) this.documents.delete(id);
    for (const [id, i] of this.animalImages.entries()) if (i.userId === userId) this.animalImages.delete(id);
    for (const [id, e] of this.eidEvents.entries()) if (e.userId === userId) this.eidEvents.delete(id);
    for (const [id, d] of this.exportedDocuments.entries()) if (d.userId === userId) this.exportedDocuments.delete(id);
    for (const [id, e] of this.flockEvents.entries()) if (e.userId === userId) this.flockEvents.delete(id);
    for (const [id, t] of this.flockTreatments.entries()) if (t.userId === userId) this.flockTreatments.delete(id);
    for (const [id, b] of this.bloodlinesMap.entries()) if (b.userId === userId) this.bloodlinesMap.delete(id);
    for (const [id, l] of this.geneticLinesMap.entries()) if (l.userId === userId) this.geneticLinesMap.delete(id);
    for (const [id, ab] of this.animalBloodlinesMap.entries()) if (ab.userId === userId) this.animalBloodlinesMap.delete(id);
    this.farmSettings.delete(userId);
  }
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
  async getUserByDeviceId(deviceId: string): Promise<{ id: string; deviceId: string; sharedUserId: string | null; deviceName?: string | null } | undefined> { return [...this.users.values()].find(u => u.deviceId === deviceId); }
  async upsertUser(data: { deviceId: string; deviceName?: string }): Promise<{ id: string; deviceId: string; sharedUserId: string | null; deviceName?: string | null }> {
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
  async getAccountByEmail(email: string): Promise<Account | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    return [...this.accounts.values()].find((account) => account.email === normalizedEmail);
  }
  async getAccountById(accountId: string): Promise<Account | undefined> { return this.accounts.get(accountId); }
  async createAccount(data: { email: string; passwordHash?: string | null; authProvider?: string; emailVerified?: boolean; googleSubject?: string | null }): Promise<Account> {
    const id = crypto.randomUUID();
    const now = this.now();
    const account: Account = {
      id,
      email: data.email.trim().toLowerCase(),
      passwordHash: data.passwordHash ?? null,
      authProvider: data.authProvider ?? "local",
      emailVerified: data.emailVerified ?? false,
      emailVerifiedAt: data.emailVerified ? now : null,
      recoveryRequired: false,
      googleSubject: data.googleSubject ?? null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
    this.accounts.set(id, account);
    return account;
  }
  async updateAccount(accountId: string, updates: Partial<Pick<Account, "passwordHash" | "emailVerified" | "emailVerifiedAt" | "recoveryRequired" | "lastLoginAt" | "status" | "googleSubject" | "updatedAt">>): Promise<Account | undefined> {
    const existing = this.accounts.get(accountId);
    if (!existing) return undefined;
    const updated: Account = { ...existing, ...updates, updatedAt: this.now() };
    this.accounts.set(accountId, updated);
    return updated;
  }
  async getAccountWorkspace(accountId: string): Promise<AccountWorkspace | undefined> {
    return [...this.accountWorkspacesMap.values()].find((workspace) => workspace.accountId === accountId);
  }
  async linkAccountWorkspace(data: { accountId: string; workspaceUserId: string; legacyDeviceUserId?: string | null; migrationSource: string; migrationState?: string }): Promise<AccountWorkspace> {
    const existing = await this.getAccountWorkspace(data.accountId);
    const now = this.now();
    const row: AccountWorkspace = {
      id: existing?.id ?? crypto.randomUUID(),
      accountId: data.accountId,
      workspaceUserId: data.workspaceUserId,
      legacyDeviceUserId: data.legacyDeviceUserId ?? null,
      migrationSource: data.migrationSource,
      migrationState: data.migrationState ?? "completed",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.accountWorkspacesMap.set(row.id, row);
    return row;
  }
  async getAccountDevices(accountId: string): Promise<AccountDevice[]> {
    return [...this.accountDevicesMap.values()].filter((device) => device.accountId === accountId);
  }
  async getAccountDeviceByDeviceId(deviceId: string): Promise<AccountDevice | undefined> {
    return [...this.accountDevicesMap.values()].find((device) => device.deviceId === deviceId);
  }
  async upsertAccountDevice(data: { accountId: string; workspaceUserId: string; deviceUserId: string; deviceId: string; deviceName?: string | null; platform?: string | null; authProvider?: string; status?: string }): Promise<AccountDevice> {
    const existing = [...this.accountDevicesMap.values()].find((device) => device.deviceId === data.deviceId);
    const now = this.now();
    const row: AccountDevice = {
      id: existing?.id ?? crypto.randomUUID(),
      accountId: data.accountId,
      workspaceUserId: data.workspaceUserId,
      deviceUserId: data.deviceUserId,
      deviceId: data.deviceId,
      deviceName: data.deviceName ?? null,
      platform: data.platform ?? null,
      authProvider: data.authProvider ?? "local",
      status: data.status ?? "active",
      lastSeenAt: now,
      revokedAt: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.accountDevicesMap.set(row.id, row);
    return row;
  }
  async revokeAccountDevice(accountId: string, deviceId: string, now = new Date()): Promise<AccountDevice | undefined> {
    const existing = [...this.accountDevicesMap.values()].find((device) => device.accountId === accountId && device.deviceId === deviceId);
    if (!existing) return undefined;
    const updated: AccountDevice = { ...existing, status: "revoked", revokedAt: now, updatedAt: now };
    this.accountDevicesMap.set(updated.id, updated);
    return updated;
  }
  async deleteAccountDevices(accountId: string): Promise<void> {
    for (const [id, device] of this.accountDevicesMap.entries()) if (device.accountId === accountId) this.accountDevicesMap.delete(id);
  }
  async createAccountToken(data: { accountId: string; tokenType: string; tokenHash: string; expiresAt: Date; metadata?: Record<string, unknown> | null }): Promise<AccountToken> {
    const row: AccountToken = {
      id: crypto.randomUUID(),
      accountId: data.accountId,
      tokenType: data.tokenType,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      consumedAt: null,
      metadata: data.metadata ?? null,
      createdAt: this.now(),
    };
    this.accountTokensMap.set(row.id, row);
    return row;
  }
  async getAccountToken(tokenType: string, tokenHash: string): Promise<AccountToken | undefined> {
    return [...this.accountTokensMap.values()].find((token) => token.tokenType === tokenType && token.tokenHash === tokenHash);
  }
  async consumeAccountToken(tokenId: string, now = new Date()): Promise<void> {
    const existing = this.accountTokensMap.get(tokenId);
    if (!existing) return;
    this.accountTokensMap.set(tokenId, { ...existing, consumedAt: now });
  }
  async createAccountAuditEvent(data: { accountId?: string | null; workspaceUserId?: string | null; deviceId?: string | null; eventType: string; result?: string; detail?: string | null; metadata?: Record<string, unknown> | null; occurredAt?: Date }): Promise<AccountAuditEvent> {
    const row: AccountAuditEvent = {
      id: crypto.randomUUID(),
      accountId: data.accountId ?? null,
      workspaceUserId: data.workspaceUserId ?? null,
      deviceId: data.deviceId ?? null,
      eventType: data.eventType,
      result: data.result ?? "success",
      detail: data.detail ?? null,
      metadata: data.metadata ?? null,
      occurredAt: data.occurredAt ?? this.now(),
    };
    this.accountAuditMap.set(row.id, row);
    return row;
  }
  async getAccountAuditEvents(accountId: string): Promise<AccountAuditEvent[]> {
    return [...this.accountAuditMap.values()]
      .filter((event) => event.accountId === accountId)
      .sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0));
  }
  async getSystemSetting(key: string): Promise<string | undefined> { return this.settings.get(key); }
  async setSystemSetting(key: string, value: string): Promise<void> { this.settings.set(key, value); }
  async deleteSystemSetting(key: string): Promise<void> { this.settings.delete(key); }
  async listSystemSettings(prefix: string): Promise<Array<{ key: string; value: string }>> {
    return [...this.settings.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value }));
  }
  async listWorkspaceUserIds(): Promise<string[]> { return [...new Set([...this.users.values()].map((user) => user.sharedUserId || user.id))]; }

  private fieldIssueSeq = 1;
  private fieldIssuesMap = new Map<number, FieldIssue>();
  async createFieldIssue(data: { userId?: string; inviteCodeRef?: string; title: string; description: string; area: string; severity: string; deviceType?: string; appMode?: string; contactName?: string; currentRoute?: string; appVersion?: string }): Promise<FieldIssue> {
    const id = this.fieldIssueSeq++;
    const now = this.now();
    const issue: FieldIssue = { id, status: "new", adminNotes: null, emailSent: false, createdAt: now, updatedAt: now, userId: data.userId || null, inviteCodeRef: data.inviteCodeRef || null, title: data.title, description: data.description, area: data.area, severity: data.severity, deviceType: data.deviceType || null, appMode: data.appMode || null, contactName: data.contactName || null, currentRoute: data.currentRoute || null, appVersion: data.appVersion || null };
    this.fieldIssuesMap.set(id, issue);
    return issue;
  }
  async getFieldIssues(filters?: { status?: string; severity?: string; area?: string; search?: string }): Promise<FieldIssue[]> {
    let results = [...this.fieldIssuesMap.values()];
    if (filters?.status) results = results.filter(i => i.status === filters.status);
    if (filters?.severity) results = results.filter(i => i.severity === filters.severity);
    if (filters?.area) results = results.filter(i => i.area === filters.area);
    if (filters?.search) { const s = filters.search.toLowerCase(); results = results.filter(i => i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s)); }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async getFieldIssue(id: number): Promise<FieldIssue | undefined> { return this.fieldIssuesMap.get(id); }
  async updateFieldIssue(id: number, updates: { status?: string; adminNotes?: string; emailSent?: boolean }): Promise<FieldIssue | undefined> {
    const issue = this.fieldIssuesMap.get(id);
    if (!issue) return undefined;
    const updated = { ...issue, ...updates, updatedAt: this.now() } as FieldIssue;
    this.fieldIssuesMap.set(id, updated);
    return updated;
  }

  // ── Activity Telemetry (in-memory) ─────────────────────────────────────────
  private activityEventSeq = 1;
  private activityEvents = new Map<number, ActivityEvent>();
  private appSessionMap = new Map<string, AppSession>();
  private appSessionIdSeq = 1;

  async createActivityEvent(data: Omit<InsertActivityEvent, 'id' | 'createdAt'>): Promise<ActivityEvent> {
    const id = this.activityEventSeq++;
    const now = this.now();
    const ev: ActivityEvent = { id, createdAt: now, occurredAt: data.occurredAt ?? now, userId: data.userId, deviceId: data.deviceId ?? null, eventType: data.eventType, eventCategory: data.eventCategory ?? null, route: data.route ?? null, feature: data.feature ?? null, metadata: data.metadata ?? null };
    this.activityEvents.set(id, ev);
    return ev;
  }

  async upsertAppSession(sessionId: string, userId: string, deviceId?: string): Promise<AppSession> {
    const existing = this.appSessionMap.get(sessionId);
    if (existing) return existing;
    const id = this.appSessionIdSeq++;
    const now = this.now();
    const s: AppSession = { id, sessionId, userId, deviceId: deviceId ?? null, startedAt: now, lastHeartbeatAt: now, endedAt: null, durationSeconds: null, isActive: true, createdAt: now };
    this.appSessionMap.set(sessionId, s);
    return s;
  }

  async heartbeatAppSession(sessionId: string, userId: string): Promise<AppSession | undefined> {
    const s = this.appSessionMap.get(sessionId);
    if (!s || s.userId !== userId) return undefined;
    const now = this.now();
    const durationSeconds = Math.round((now.getTime() - s.startedAt.getTime()) / 1000);
    const updated: AppSession = { ...s, lastHeartbeatAt: now, durationSeconds, isActive: true };
    this.appSessionMap.set(sessionId, updated);
    return updated;
  }

  async endAppSession(sessionId: string, userId: string): Promise<void> {
    const s = this.appSessionMap.get(sessionId);
    if (!s || s.userId !== userId) return;
    const endedAt = this.now();
    const durationSeconds = Math.round((endedAt.getTime() - s.startedAt.getTime()) / 1000);
    this.appSessionMap.set(sessionId, { ...s, endedAt, durationSeconds, isActive: false });
  }

  private _computeScore(events: ActivityEvent[], sessions: AppSession[]): number {
    const now = Date.now();
    const day1 = new Date(now - 24 * 60 * 60 * 1000);
    const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    let score = 0;
    if (events.some(e => e.eventType === 'app_open' && e.occurredAt >= day1)) score += 15;
    if (sessions.some(s => s.lastHeartbeatAt >= day1)) score += 20;
    if (events.some(e => e.eventType === 'sync_success' && e.occurredAt >= day7)) score += 15;
    if (events.some(e => ['animal_created','animal_updated','breeding_record_created','health_record_created','performance_record_created'].includes(e.eventType) && e.occurredAt >= day7)) score += 20;
    if (events.some(e => e.eventCategory === 'export')) score += 10;
    if (sessions.filter(s => s.startedAt >= day7).length > 1) score += 20;
    return Math.min(100, score);
  }

  private _activityStatus(score: number): string {
    if (score >= 80) return 'Strong tester';
    if (score >= 50) return 'Active tester';
    if (score >= 20) return 'Light activity';
    if (score >= 1) return 'Low use';
    return 'No activity';
  }

  private _buildMemActivityUser(activation: UserActivation, inviteCode?: InviteCode): AdminActivityUser {
    const uid = activation.userId;
    const events = [...this.activityEvents.values()].filter(e => e.userId === uid).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const sessions = [...this.appSessionMap.values()].filter(s => s.userId === uid).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const score = this._computeScore(events, sessions);
    const syncEvents = events.filter(e => e.eventType === 'sync_success');
    const exportEvents = events.filter(e => e.eventCategory === 'export');
    return {
      userId: uid,
      deviceId: activation.deviceId,
      deviceType: activation.deviceType,
      inviteCode: inviteCode?.code ?? null,
      activatedAt: activation.activatedAt,
      lastSeen: events[0]?.occurredAt ?? sessions[0]?.lastHeartbeatAt ?? null,
      lastSync: syncEvents[0]?.occurredAt ?? null,
      lastSessionStart: sessions[0]?.startedAt ?? null,
      lastSessionEnd: sessions[0]?.endedAt ?? sessions[0]?.lastHeartbeatAt ?? null,
      estimatedTimeSpentSeconds: sessions.reduce((s, sess) => s + (sess.durationSeconds ?? 0), 0),
      sessionCount: sessions.length,
      activityScore: score,
      exportDownloadCount: exportEvents.length,
      lastFeatureUsed: events.find(e => e.feature)?.feature ?? null,
      status: this._activityStatus(score),
    };
  }

  async getAdminActivitySummary(): Promise<AdminActivitySummary> {
    const now = Date.now();
    const day1 = new Date(now - 24 * 60 * 60 * 1000);
    const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const min30 = new Date(now - 30 * 60 * 1000);
    const allEvents = [...this.activityEvents.values()];
    const allSessions = [...this.appSessionMap.values()];
    const activations = [...this.activations.values()].filter(a => a.status === 'active');
    const codes = [...this.inviteCodes.values()];
    const codeMap = new Map(codes.map(c => [c.id, c]));
    const allUsers = activations.map(a => this._buildMemActivityUser(a, codeMap.get(a.inviteCodeId)));
    const activeUserIds = new Set(allEvents.map(e => e.userId));
    const todayIds = new Set(allEvents.filter(e => e.occurredAt >= day1).map(e => e.userId));
    const week7Ids = new Set(allEvents.filter(e => e.occurredAt >= day7).map(e => e.userId));
    const recentIds = new Set(allEvents.filter(e => e.occurredAt >= min30).map(e => e.userId));
    const syncIds = new Set(allEvents.filter(e => e.eventType === 'sync_success').map(e => e.userId));
    const totalSeconds = allSessions.filter(s => s.durationSeconds != null).map(s => s.durationSeconds!);
    const avgDur = totalSeconds.length > 0 ? totalSeconds.reduce((a, b) => a + b, 0) / totalSeconds.length : 0;
    return {
      totalActivatedUsers: activations.length,
      activeToday: todayIds.size,
      activeLast7Days: week7Ids.size,
      recentlySeen: recentIds.size,
      usersWithSyncActivity: syncIds.size,
      usersWithNoActivity: allUsers.filter(u => u.activityScore === 0).length,
      totalSessions: allSessions.length,
      avgSessionDurationSeconds: Math.round(avgDur),
      exportDownloadCount: allEvents.filter(e => e.eventCategory === 'export').length,
      mostActiveTesters: [...allUsers].sort((a, b) => b.activityScore - a.activityScore).slice(0, 5),
    };
  }

  async getAdminActivityUsers(filters?: { sortBy?: string; filterBy?: string }): Promise<AdminActivityUser[]> {
    const activations = [...this.activations.values()].filter(a => a.status === 'active');
    const codes = [...this.inviteCodes.values()];
    const codeMap = new Map(codes.map(c => [c.id, c]));
    let users = activations.map(a => this._buildMemActivityUser(a, codeMap.get(a.inviteCodeId)));
    if (filters?.filterBy === 'active_today') {
      const day1 = new Date(Date.now() - 24 * 60 * 60 * 1000);
      users = users.filter(u => u.lastSeen && u.lastSeen >= day1);
    } else if (filters?.filterBy === 'dormant') {
      const day7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      users = users.filter(u => !u.lastSeen || u.lastSeen < day7);
    } else if (filters?.filterBy === 'no_activity') {
      users = users.filter(u => u.activityScore === 0);
    }
    const sortBy = filters?.sortBy ?? 'activityScore';
    users.sort((a, b) => {
      if (sortBy === 'lastSeen') return (b.lastSeen?.getTime() ?? 0) - (a.lastSeen?.getTime() ?? 0);
      if (sortBy === 'lastSync') return (b.lastSync?.getTime() ?? 0) - (a.lastSync?.getTime() ?? 0);
      if (sortBy === 'sessionCount') return b.sessionCount - a.sessionCount;
      return b.activityScore - a.activityScore;
    });
    return users;
  }

  async getAdminActivityUserDetail(userId: string): Promise<AdminActivityUserDetail | undefined> {
    const activation = [...this.activations.values()].find(a => a.userId === userId);
    if (!activation) return undefined;
    const inviteCode = [...this.inviteCodes.values()].find(c => c.id === activation.inviteCodeId);
    const base = this._buildMemActivityUser(activation, inviteCode);
    const recentEvents = [...this.activityEvents.values()].filter(e => e.userId === userId).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 50);
    const day7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sessions7d = [...this.appSessionMap.values()].filter(s => s.userId === userId && s.startedAt >= day7).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return { ...base, recentEvents, sessions7d };
  }

  async getAdminActivityEvents(filters?: { userId?: string; eventType?: string; limit?: number }): Promise<ActivityEvent[]> {
    let events = [...this.activityEvents.values()];
    if (filters?.userId) events = events.filter(e => e.userId === filters.userId);
    if (filters?.eventType) events = events.filter(e => e.eventType === filters.eventType);
    return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, filters?.limit ?? 100);
  }

  // ── Genetics Module (in-memory) ───────────────────────────────────────────
  private bloodlineSeq = 1;
  private bloodlinesMap = new Map<number, Bloodline>();
  private geneticLineSeq = 1;
  private geneticLinesMap = new Map<number, GeneticLine>();
  private animalBloodlineSeq = 1;
  private animalBloodlinesMap = new Map<number, AnimalBloodline>();

  async getBloodlines(userId: string): Promise<Bloodline[]> {
    return [...this.bloodlinesMap.values()].filter(b => b.userId === userId).sort((a, b) => a.name.localeCompare(b.name));
  }
  async createBloodline(userId: string, data: InsertBloodline): Promise<Bloodline> {
    const id = this.bloodlineSeq++;
    const row: Bloodline = { id, userId, name: data.name, type: data.type ?? 'unknown', originFarmOrBreeder: data.originFarmOrBreeder ?? null, foundationAnimalId: data.foundationAnimalId ?? null, selectedTraits: data.selectedTraits ?? null, knownWeaknesses: data.knownWeaknesses ?? null, notes: data.notes ?? null, status: data.status ?? 'active', evidenceStatus: data.evidenceStatus ?? 'unknown', createdAt: this.now() };
    this.bloodlinesMap.set(id, row);
    return row;
  }
  async updateBloodline(userId: string, id: number, data: Partial<InsertBloodline>): Promise<Bloodline | undefined> {
    const existing = this.bloodlinesMap.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated = { ...existing, ...data } as Bloodline;
    this.bloodlinesMap.set(id, updated);
    return updated;
  }
  async deleteBloodline(userId: string, id: number): Promise<void> {
    const b = this.bloodlinesMap.get(id);
    if (b?.userId === userId) this.bloodlinesMap.delete(id);
  }
  async getGeneticLines(userId: string): Promise<GeneticLine[]> {
    return [...this.geneticLinesMap.values()].filter(l => l.userId === userId).sort((a, b) => a.lineName.localeCompare(b.lineName));
  }
  async createGeneticLine(userId: string, data: InsertGeneticLine): Promise<GeneticLine> {
    const id = this.geneticLineSeq++;
    const row: GeneticLine = { id, userId, lineName: data.lineName, lineGoal: data.lineGoal ?? null, primaryTraits: data.primaryTraits ?? null, selectionNotes: data.selectionNotes ?? null, activeStatus: data.activeStatus ?? true, createdAt: this.now() };
    this.geneticLinesMap.set(id, row);
    return row;
  }
  async updateGeneticLine(userId: string, id: number, data: Partial<InsertGeneticLine>): Promise<GeneticLine | undefined> {
    const existing = this.geneticLinesMap.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated = { ...existing, ...data } as GeneticLine;
    this.geneticLinesMap.set(id, updated);
    return updated;
  }
  async deleteGeneticLine(userId: string, id: number): Promise<void> {
    const l = this.geneticLinesMap.get(id);
    if (l?.userId === userId) this.geneticLinesMap.delete(id);
  }
  async getAnimalBloodlines(userId: string, animalId: number): Promise<AnimalBloodline[]> {
    return [...this.animalBloodlinesMap.values()].filter(ab => ab.userId === userId && ab.animalId === animalId);
  }
  async setAnimalBloodline(userId: string, data: InsertAnimalBloodline): Promise<AnimalBloodline> {
    const role = data.role ?? 'primary';
    const existing = [...this.animalBloodlinesMap.values()].find(ab => ab.userId === userId && ab.animalId === data.animalId && ab.role === role);
    if (existing) {
      const updated = { ...existing, bloodlineId: data.bloodlineId, geneticLineId: data.geneticLineId ?? null, breedingSystem: data.breedingSystem ?? null, sourceConfidence: data.sourceConfidence ?? 'unknown', notes: data.notes ?? null } as AnimalBloodline;
      this.animalBloodlinesMap.set(existing.id, updated);
      return updated;
    }
    const id = this.animalBloodlineSeq++;
    const row: AnimalBloodline = { id, userId, animalId: data.animalId, bloodlineId: data.bloodlineId, role, geneticLineId: data.geneticLineId ?? null, breedingSystem: data.breedingSystem ?? null, sourceConfidence: data.sourceConfidence ?? 'unknown', notes: data.notes ?? null, assignedAt: this.now() };
    this.animalBloodlinesMap.set(id, row);
    return row;
  }
  async removeAnimalBloodline(userId: string, id: number): Promise<void> {
    const ab = this.animalBloodlinesMap.get(id);
    if (ab?.userId === userId) this.animalBloodlinesMap.delete(id);
  }
  async seedGeneticsForUser(userId: string, bloodlineNames: string[]): Promise<void> {
    const existing = await this.getBloodlines(userId);
    const existingNames = new Set(existing.map(b => b.name));
    for (const name of bloodlineNames) {
      if (!existingNames.has(name)) {
        await this.createBloodline(userId, { name, type: 'foundation_line', status: 'active', evidenceStatus: 'unknown', notes: 'Kwantam demo bloodline' });
      }
    }
  }
}

export const storage = process.env.USE_IN_MEMORY_STORAGE === "1"
  ? new InMemoryStorage()
  : new DatabaseStorage();
