import { pgTable, text, serial, integer, boolean, timestamp, decimal, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export Auth & Chat models
export * from "./models/auth";
export * from "./models/chat";

// === MATING GROUPS ===
export const matingGroups = pgTable("mating_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ramId: integer("ram_id").notNull(),
  dateIn: date("date_in").notNull(),
  dateOut: date("date_out"),
  lambingSeason: text("lambing_season"), // e.g. 26A
  environmentGroup: text("environment_group"),
  managementGroup: text("management_group"),
  status: text("status").default("active"), // active, closed
  notes: text("notes"),
});

export const matingGroupsRelations = relations(matingGroups, ({ one, many }) => ({
  ram: one(animals, {
    fields: [matingGroups.ramId],
    references: [animals.id],
    relationName: "matingGroupRam",
  }),
  breedingEvents: many(breedingEvents),
}));

export const insertMatingGroupSchema = createInsertSchema(matingGroups).omit({ id: true });


// === ANIMALS ===
export const animals = pgTable("animals", {
  id: serial("id").primaryKey(),
  // Identification
  tagId: text("tag_id").notNull().unique(), // Ear tag
  tattooId: text("tattoo_id"), // Tattoo
  electronicId: text("electronic_id"), // RFID
  studPrefix: text("stud_prefix"),
  name: text("name"),
  
  // Basic Info
  sex: text("sex").notNull(), // ram, ewe, wether
  breed: text("breed").default("Meatmaster"),
  status: text("status").default("active"), // active, sold, dead, culled, lost
  photo: text("photo"), // URL/Path to photo
  
  // Birth & Parentage
  birthDate: date("birth_date"),
  birthStatus: text("birth_status"), // single, twin, triplet
  damId: integer("dam_id"), 
  sireId: integer("sire_id"),
  externalDamInfo: text("external_dam_info"), // For dam not in system
  externalSireInfo: text("external_sire_info"), // For sire not in system
  
  // Documents
  evaluationDocument: text("evaluation_document"), // Base64 PDF/image of evaluation
  
  // Grouping & Stamboek Info
  lambingSeason: text("lambing_season"), // e.g. 24A
  environmentGroup: text("environment_group"), // Veld, Lands
  managementGroup: text("management_group"), // 1, 2, 3
  
  // Performance (Specific Stamboek fields)
  birthWeight: decimal("birth_weight"),
  currentWeight: decimal("current_weight"), // Latest known weight
  
  weight100Day: decimal("weight_100_day"),
  weight100DayDate: date("weight_100_day_date"),
  
  weight270Day: decimal("weight_270_day"),
  weight270DayDate: date("weight_270_day_date"),
  
  weaningStatus: text("weaning_status"), // "Twin died before weaning", etc.
  
  // Ownership
  breederName: text("breeder_name"),
  ownerName: text("owner_name"),
  farmName: text("farm_name"),
  location: text("location"), // Camp/Location
  
  // Notes
  notes: text("notes"),
});

export const animalsRelations = relations(animals, ({ one, many }) => ({
  dam: one(animals, {
    fields: [animals.damId],
    references: [animals.id],
    relationName: "damRelation",
  }),
  sire: one(animals, {
    fields: [animals.sireId],
    references: [animals.id],
    relationName: "sireRelation",
  }),
  offspringAsDam: many(animals, { relationName: "damRelation" }),
  offspringAsSire: many(animals, { relationName: "sireRelation" }),
  breedingEventsAsEwe: many(breedingEvents, { relationName: "eweRelation" }),
  breedingEventsAsRam: many(breedingEvents, { relationName: "ramRelation" }),
  matingGroupsAsRam: many(matingGroups, { relationName: "matingGroupRam" }),
  performanceRecords: many(performanceRecords),
  healthRecords: many(healthRecords),
  evaluations: many(evaluations),
}));

export const insertAnimalSchema = createInsertSchema(animals).omit({ id: true });


// === BREEDING EVENTS ===
export const breedingEvents = pgTable("breeding_events", {
  id: serial("id").primaryKey(),
  eweId: integer("ewe_id").notNull(),
  ramId: integer("ram_id").notNull(),
  matingGroupId: integer("mating_group_id"), // Optional link to group
  matingDate: date("mating_date").notNull(),
  matingType: text("mating_type").notNull(), // natural, AI, hand-mated
  lambingDate: date("lambing_date"),
  lambCount: integer("lamb_count"),
  notes: text("notes"),
});

export const breedingEventsRelations = relations(breedingEvents, ({ one, many }) => ({
  ewe: one(animals, {
    fields: [breedingEvents.eweId],
    references: [animals.id],
    relationName: "eweRelation",
  }),
  ram: one(animals, {
    fields: [breedingEvents.ramId],
    references: [animals.id],
    relationName: "ramRelation",
  }),
  matingGroup: one(matingGroups, {
    fields: [breedingEvents.matingGroupId],
    references: [matingGroups.id],
  }),
  offspring: many(offspring),
}));

export const insertBreedingEventSchema = createInsertSchema(breedingEvents).omit({ id: true });


// === OFFSPRING ===
// Links a breeding event to the resulting lamb(s)
export const offspring = pgTable("offspring", {
  id: serial("id").primaryKey(),
  breedingEventId: integer("breeding_event_id").notNull(),
  lambId: integer("lamb_id").notNull(),
});

export const offspringRelations = relations(offspring, ({ one }) => ({
  breedingEvent: one(breedingEvents, {
    fields: [offspring.breedingEventId],
    references: [breedingEvents.id],
  }),
  lamb: one(animals, {
    fields: [offspring.lambId],
    references: [animals.id],
  }),
}));

export const insertOffspringSchema = createInsertSchema(offspring).omit({ id: true });


// === PERFORMANCE RECORDS ===
export const performanceRecords = pgTable("performance_records", {
  id: serial("id").primaryKey(),
  animalId: integer("animal_id").notNull(),
  date: date("date").notNull(),
  weight: decimal("weight"),
  ageDays: integer("age_days"),
  type: text("type"), // 100-day, 270-day, ad-hoc, weaning
  traitNotes: text("trait_notes"),
  notes: text("notes"),
});

export const performanceRecordsRelations = relations(performanceRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [performanceRecords.animalId],
    references: [animals.id],
  }),
}));

export const insertPerformanceRecordSchema = createInsertSchema(performanceRecords).omit({ id: true });


// === HEALTH RECORDS ===
export const healthRecords = pgTable("health_records", {
  id: serial("id").primaryKey(),
  animalId: integer("animal_id").notNull(),
  date: date("date").notNull(),
  treatment: text("treatment").notNull(),
  medication: text("medication"),
  dosage: text("dosage"),
  vet: text("vet"),
  withdrawalPeriod: text("withdrawal_period"),
  notes: text("notes"),
});

export const healthRecordsRelations = relations(healthRecords, ({ one }) => ({
  animal: one(animals, {
    fields: [healthRecords.animalId],
    references: [animals.id],
  }),
}));

export const insertHealthRecordSchema = createInsertSchema(healthRecords).omit({ id: true });


// === EVALUATIONS (Manual) ===
export const evaluations = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  animalId: integer("animal_id").notNull(),
  date: date("date").defaultNow(),
  evaluator: text("evaluator"), // manual or AI
  headScore: integer("head_score"), // 1-6
  frontScore: integer("front_score"), // 1-6
  middleScore: integer("middle_score"), // 1-6
  rearScore: integer("rear_score"), // 1-6
  overallType: text("overall_type"), // Euro, Afro, Middle
  comments: text("comments"),
});

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  animal: one(animals, {
    fields: [evaluations.animalId],
    references: [animals.id],
  }),
}));

export const insertEvaluationSchema = createInsertSchema(evaluations).omit({ id: true });


// === AI VALUATIONS ===
export const aiValuations = pgTable("ai_valuations", {
  id: serial("id").primaryKey(),
  animalId: integer("animal_id").notNull(),
  valuationText: text("valuation_text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiValuationsRelations = relations(aiValuations, ({ one }) => ({
  animal: one(animals, {
    fields: [aiValuations.animalId],
    references: [animals.id],
  }),
}));

export const insertAiValuationSchema = createInsertSchema(aiValuations).omit({ id: true, createdAt: true });


// === EXPLICIT TYPES ===
export type MatingGroup = typeof matingGroups.$inferSelect;
export type InsertMatingGroup = z.infer<typeof insertMatingGroupSchema>;
export type Animal = typeof animals.$inferSelect;
export type InsertAnimal = z.infer<typeof insertAnimalSchema>;
export type BreedingEvent = typeof breedingEvents.$inferSelect;
export type InsertBreedingEvent = z.infer<typeof insertBreedingEventSchema>;
export type Offspring = typeof offspring.$inferSelect;
export type InsertOffspring = z.infer<typeof insertOffspringSchema>;
export type PerformanceRecord = typeof performanceRecords.$inferSelect;
export type InsertPerformanceRecord = z.infer<typeof insertPerformanceRecordSchema>;
export type HealthRecord = typeof healthRecords.$inferSelect;
export type InsertHealthRecord = z.infer<typeof insertHealthRecordSchema>;
export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type AiValuation = typeof aiValuations.$inferSelect;
export type InsertAiValuation = z.infer<typeof insertAiValuationSchema>;

export type AnimalWithRelations = Animal & {
  dam?: Animal | null;
  sire?: Animal | null;
  offspringAsDam?: Animal[];
  offspringAsSire?: Animal[];
  evaluations?: Evaluation[];
};

// === FARM SETTINGS ===
export const farmSettings = pgTable("farm_settings", {
  id: serial("id").primaryKey(),
  farmName: text("farm_name").notNull(),
  studName: text("stud_name"),
  studPrefix: text("stud_prefix"),
  ownerName: text("owner_name"),
  ownerEmail: text("owner_email"),
  ownerPhone: text("owner_phone"),
  farmAddress: text("farm_address"),
  farmLocation: text("farm_location"),
  membershipNumber: text("membership_number"),
  registrationNumber: text("registration_number"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFarmSettingsSchema = createInsertSchema(farmSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type FarmSettings = typeof farmSettings.$inferSelect;
export type InsertFarmSettings = z.infer<typeof insertFarmSettingsSchema>;
