import { pgTable, text, serial, integer, boolean, timestamp, decimal, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export Auth & Chat models
export * from "./models/auth";
export * from "./models/chat";

// === ANIMALS ===
export const animals = pgTable("animals", {
  id: serial("id").primaryKey(),
  tagId: text("tag_id").notNull().unique(),
  electronicId: text("electronic_id"),
  name: text("name"),
  sex: text("sex").notNull(), // ram, ewe, wether
  breed: text("breed").default("Meatmaster"),
  birthDate: date("birth_date"),
  birthWeight: decimal("birth_weight"),
  currentWeight: decimal("current_weight"),
  damId: integer("dam_id"), // Self-referential FK handled in relations
  sireId: integer("sire_id"), // Self-referential FK handled in relations
  status: text("status").default("active"), // active, sold, dead, culled, lost
  notes: text("notes"),
  photo: text("photo"), // URL/Path to photo
  breederName: text("breeder_name"),
  ownerName: text("owner_name"),
  farmName: text("farm_name"),
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
  performanceRecords: many(performanceRecords),
  healthRecords: many(healthRecords),
  evaluations: many(evaluations),
  aiValuations: many(aiValuations),
}));

export const insertAnimalSchema = createInsertSchema(animals).omit({ id: true });

// === BREEDING EVENTS ===
export const breedingEvents = pgTable("breeding_events", {
  id: serial("id").primaryKey(),
  eweId: integer("ewe_id").notNull(),
  ramId: integer("ram_id").notNull(),
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
