import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupDeviceAuth, registerDeviceAuthRoutes, requireDeviceAuth, requireAdminPin, getUserId as getDeviceUserId } from "./device-auth";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";

// Helper to extract userId from device session
function getUserId(req: Request): string {
  const userId = getDeviceUserId(req);
  if (!userId) {
    throw new Error("Device not authenticated");
  }
  return userId;
}

// Middleware to require device authentication
const requireAuth = requireDeviceAuth;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup device-based authentication
  setupDeviceAuth(app);
  registerDeviceAuthRoutes(app);
  
  // Register AI Integrations (chat, image, audio)
  registerChatRoutes(app);
  registerImageRoutes(app);
  registerAudioRoutes(app);

  // === ANIMALS ===
  // All animal routes now require authentication and filter by userId
  app.get(api.animals.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const filters = req.query as { search?: string; status?: string; sex?: string };
    const animals = await storage.getAnimals(userId, filters);
    res.json(animals);
  });

  app.get(api.animals.get.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const animal = await storage.getAnimal(userId, Number(req.params.id));
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }
    
    const dam = animal.damId ? await storage.getAnimal(userId, animal.damId) : null;
    const sire = animal.sireId ? await storage.getAnimal(userId, animal.sireId) : null;
    
    const allAnimals = await storage.getAnimals(userId, {});
    const offspringAsDam = animal.sex === "ewe" ? allAnimals.filter(a => a.damId === animal.id) : [];
    const offspringAsSire = animal.sex === "ram" ? allAnimals.filter(a => a.sireId === animal.id) : [];

    res.json({ ...animal, dam, sire, offspringAsDam, offspringAsSire });
  });

  app.get(api.animals.familyTree.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const animalId = Number(req.params.id);
    const animal = await storage.getAnimal(userId, animalId);
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }

    const nodes: any[] = [];
    const links: any[] = [];
    const visited = new Set<number>();

    async function traverse(currentId: number, depth: number) {
      if (depth > 2 || visited.has(currentId)) return;
      visited.add(currentId);

      const current = await storage.getAnimal(userId, currentId);
      if (!current) return;

      nodes.push(current);

      if (current.damId) {
        links.push({ source: current.damId, target: currentId, type: "dam" });
        await traverse(current.damId, depth + 1);
      }
      if (current.sireId) {
        links.push({ source: current.sireId, target: currentId, type: "sire" });
        await traverse(current.sireId, depth + 1);
      }
    }

    await traverse(animalId, 0);

    res.json({ nodes, links });
  });

  app.post(api.animals.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.animals.create.input.parse(req.body);
      const animal = await storage.createAnimal(userId, input);
      res.status(201).json(animal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.put(api.animals.update.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.animals.update.input.parse(req.body);
      const animal = await storage.updateAnimal(userId, Number(req.params.id), input);
      res.json(animal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.delete(api.animals.delete.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    await storage.deleteAnimal(userId, Number(req.params.id));
    res.status(204).send();
  });

  // === ANIMAL IMAGES ===
  app.get("/api/animals/:id/images", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const animalId = Number(req.params.id);
    const images = await storage.getAnimalImages(userId, animalId);
    res.json(images);
  });

  app.post("/api/animals/:id/images", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animalId = Number(req.params.id);
      const { imageData, fileName, caption } = req.body;
      
      if (!imageData || !fileName) {
        return res.status(400).json({ message: "imageData and fileName are required" });
      }
      
      const image = await storage.createAnimalImage(userId, {
        animalId,
        imageData,
        fileName,
        caption: caption || null
      });
      res.status(201).json(image);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.delete("/api/animals/:animalId/images/:imageId", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const imageId = Number(req.params.imageId);
    await storage.deleteAnimalImage(userId, imageId);
    res.status(204).send();
  });

  // === LAMB MANAGEMENT ===
  
  // Classify ram lamb (stud/commercial/cull)
  app.patch("/api/animals/:id/classify-ram-lamb", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animalId = Number(req.params.id);
      const { ramLambClass } = req.body;
      
      if (!['stud', 'commercial', 'cull', 'unclassified'].includes(ramLambClass)) {
        return res.status(400).json({ message: "Invalid ramLambClass. Must be: stud, commercial, cull, or unclassified" });
      }
      
      const animal = await storage.getAnimal(userId, animalId);
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      if (animal.sex !== 'ram') {
        return res.status(400).json({ message: "Only ram lambs can be classified" });
      }
      
      const updated = await storage.updateAnimal(userId, animalId, { ramLambClass });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to classify ram lamb" });
    }
  });
  
  // Move ewe lamb to ewes (100-day transition)
  app.patch("/api/animals/:id/move-to-ewes", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animalId = Number(req.params.id);
      const animal = await storage.getAnimal(userId, animalId);
      
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      if (animal.sex !== 'ewe') {
        return res.status(400).json({ message: "Only ewe lambs can be moved to ewes" });
      }
      
      const updated = await storage.updateAnimal(userId, animalId, { 
        lambStatus: 'moved_to_ewes'
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to move ewe lamb to ewes" });
    }
  });
  
  // Move ram lamb to rams (270-day transition for stud rams)
  app.patch("/api/animals/:id/move-to-rams", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animalId = Number(req.params.id);
      const { ramType } = req.body;
      
      if (!['breeding_ram', 'stud_ram', 'commercial_ram'].includes(ramType)) {
        return res.status(400).json({ message: "Invalid ramType. Must be: breeding_ram, stud_ram, or commercial_ram" });
      }
      
      const animal = await storage.getAnimal(userId, animalId);
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      if (animal.sex !== 'ram') {
        return res.status(400).json({ message: "Only ram lambs can be moved to rams" });
      }
      
      const updated = await storage.updateAnimal(userId, animalId, { 
        lambStatus: 'moved_to_rams',
        ramType
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to move ram lamb to rams" });
    }
  });
  
  // Confirm cull (step 2 of cull process)
  app.patch("/api/animals/:id/confirm-cull", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animalId = Number(req.params.id);
      const { cullReason } = req.body;
      
      const animal = await storage.getAnimal(userId, animalId);
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const updated = await storage.updateAnimal(userId, animalId, { 
        lambStatus: 'culled',
        status: 'culled',
        cullConfirmed: true,
        cullDate: today,
        cullReason: cullReason || null,
        removalReason: 'culled'
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to confirm cull" });
    }
  });
  
  // Remove from herd (sold/deceased/transferred)
  app.patch("/api/animals/:id/remove-from-herd", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animalId = Number(req.params.id);
      const { reason, notes } = req.body;
      
      if (!['sold', 'deceased', 'transferred'].includes(reason)) {
        return res.status(400).json({ message: "Invalid reason. Must be: sold, deceased, or transferred" });
      }
      
      const animal = await storage.getAnimal(userId, animalId);
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      
      const statusMap: Record<string, string> = {
        sold: 'sold',
        deceased: 'dead',
        transferred: 'sold' // transferred treated similar to sold
      };
      
      const lambStatusMap: Record<string, string> = {
        sold: 'sold',
        deceased: 'deceased',
        transferred: 'sold'
      };
      
      const updated = await storage.updateAnimal(userId, animalId, { 
        status: statusMap[reason],
        lambStatus: lambStatusMap[reason],
        removalReason: reason,
        notes: notes ? (animal.notes ? `${animal.notes}\n${notes}` : notes) : animal.notes
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to remove from herd" });
    }
  });
  
  // Get culled animals
  app.get("/api/animals/culled", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const animals = await storage.getAnimals(userId, { status: 'culled' });
    res.json(animals);
  });

  // === BREEDING ===
  app.get(api.breeding.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const events = await storage.getBreedingEvents(userId);
    res.json(events);
  });

  app.post(api.breeding.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.breeding.create.input.parse(req.body);
      const event = await storage.createBreedingEvent(userId, input);
      res.status(201).json(event);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.delete("/api/breeding/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid breeding event ID" });
      }
      await storage.deleteBreedingEvent(userId, id);
      res.status(200).json({ message: "Breeding event deleted" });
    } catch (err) {
      console.error("Error deleting breeding event:", err);
      res.status(500).json({ message: "Failed to delete breeding event" });
    }
  });
  
  app.get(api.breeding.groups.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const groups = await storage.getMatingGroups(userId);
    res.json(groups);
  });
  
  app.post(api.breeding.groups.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.breeding.groups.create.input.parse(req.body);
      const group = await storage.createMatingGroup(userId, input);
      res.status(201).json(group);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });
  
  app.patch("/api/mating-groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = Number(req.params.id);
      const updated = await storage.updateMatingGroup(userId, id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Mating group not found" });
      }
      res.json(updated);
    } catch (err) {
      throw err;
    }
  });
  
  app.delete("/api/mating-groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const id = Number(req.params.id);
      await storage.deleteMatingGroup(userId, id);
      res.status(204).send();
    } catch (err) {
      throw err;
    }
  });

  // === RECORDS ===
  app.get(api.records.performance.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const records = await storage.getPerformanceRecords(userId, Number(req.params.id));
    res.json(records);
  });
  
  app.post(api.records.performance.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.records.performance.create.input.parse(req.body);
      const record = await storage.createPerformanceRecord(userId, input);
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  app.get(api.records.health.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const records = await storage.getHealthRecords(userId, Number(req.params.id));
    res.json(records);
  });

  app.post(api.records.health.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.records.health.create.input.parse(req.body);
      const record = await storage.createHealthRecord(userId, input);
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });


  // === SETTINGS / EXPORT / IMPORT ===
  app.get(api.settings.export.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animals = await storage.getAnimals(userId);
      const csvData = stringify(animals, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="animals.csv"');
      res.send(csvData);
    } catch (err) {
      console.error("Export Error:", err);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post(api.settings.import.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { table, csvData } = api.settings.import.input.parse(req.body);
      
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true
      }) as Record<string, string>[];

      let count = 0;
      if (table === 'animals') {
        for (const record of records) {
          await storage.createAnimal(userId, {
            tagId: record.tagId || record.tag_id,
            sex: record.sex || 'ewe',
            breed: record.breed || "Meatmaster",
            status: record.status || "active",
          });
          count++;
        }
      }
      
      res.json({ count });
    } catch (err) {
      console.error("Import Error:", err);
      res.status(500).json({ message: "Failed to import data" });
    }
  });

  // === FARM SETTINGS ===
  app.get(api.farmSettings.get.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const settings = await storage.getFarmSettings(userId);
    res.json(settings || null);
  });

  app.post(api.farmSettings.save.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const data = api.farmSettings.save.input.parse(req.body);
      const settings = await storage.saveFarmSettings(userId, data);
      res.json(settings);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Farm settings error:", err);
      res.status(500).json({ message: "Failed to save farm settings" });
    }
  });

  // === DOCUMENTS ===
  app.get(api.documents.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const docs = await storage.getDocuments(userId);
    res.json(docs);
  });

  app.post(api.documents.upload.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const data = api.documents.upload.input.parse(req.body);
      const doc = await storage.createDocument(userId, data);
      res.status(201).json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Document upload error:", err);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.delete(api.documents.delete.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteDocument(userId, Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      console.error("Document delete error:", err);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // === CSV IMPORT ===
  app.post(api.import.csv.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { csvData } = req.body;
      if (!csvData) {
        return res.status(400).json({ message: "No CSV data provided" });
      }

      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as Record<string, string>[];

      const errors: string[] = [];
      const animalsToCreate: any[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNum = i + 2;
        
        const tagId = record.tagId || record.tag_id || record.TagID || record['Tag ID'];
        if (!tagId) {
          errors.push(`Row ${rowNum}: Missing required field tagId`);
          continue;
        }

        const sex = (record.sex || record.Sex || 'ewe').toLowerCase();
        if (!['ram', 'ewe', 'wether'].includes(sex)) {
          errors.push(`Row ${rowNum}: Invalid sex value "${sex}"`);
          continue;
        }

        animalsToCreate.push({
          tagId,
          sex,
          breed: record.breed || record.Breed || 'Meatmaster',
          name: record.name || record.Name || null,
          status: record.status || record.Status || 'active',
          birthDate: record.birthDate || record.birth_date || record['Birth Date'] || null,
          birthWeight: record.birthWeight || record.birth_weight || record['Birth Weight'] || null,
          currentWeight: record.currentWeight || record.current_weight || record['Current Weight'] || null,
          notes: record.notes || record.Notes || null,
          tattoo: record.tattoo || record.Tattoo || null,
          electronicId: record.electronicId || record.electronic_id || record['Electronic ID'] || null,
        });
      }

      // Bulk create animals
      const created = await storage.bulkCreateAnimals(userId, animalsToCreate);

      res.json({ 
        imported: created.length, 
        errors 
      });
    } catch (err: any) {
      console.error("CSV Import error:", err);
      res.status(500).json({ message: err.message || "Failed to import CSV" });
    }
  });

  // === EXPORTED DOCUMENTS ===
  app.get("/api/exported-documents", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const subfolder = req.query.subfolder as string | undefined;
      const docs = await storage.getExportedDocuments(userId, subfolder);
      res.json(docs);
    } catch (err: any) {
      console.error("Get exported docs error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/exported-documents", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { name, documentType, subfolder, animalId } = req.body;
      if (!name || !documentType || !subfolder) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const doc = await storage.createExportedDocument(userId, {
        name,
        documentType,
        subfolder,
        animalId: animalId || null,
      });
      res.status(201).json(doc);
    } catch (err: any) {
      console.error("Create exported doc error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/exported-documents/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteExportedDocument(userId, Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      console.error("Delete exported doc error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === FLOCK HEALTH EVENTS ===
  app.get("/api/flock-health-events", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const events = await storage.getFlockHealthEvents(userId);
      res.json(events);
    } catch (err: any) {
      console.error("Get flock health events error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/flock-health-events/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const event = await storage.getFlockHealthEvent(userId, Number(req.params.id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      const treatments = await storage.getFlockHealthTreatments(userId, event.id);
      res.json({ ...event, treatments });
    } catch (err: any) {
      console.error("Get flock health event error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/flock-health-events", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { treatments, ...eventData } = req.body;
      const event = await storage.createFlockHealthEvent(userId, eventData);
      
      if (treatments && treatments.length > 0) {
        const treatmentRecords = treatments.map((t: any) => ({
          ...t,
          eventId: event.id,
        }));
        await storage.createFlockHealthTreatments(userId, treatmentRecords);
      }
      
      res.status(201).json(event);
    } catch (err: any) {
      console.error("Create flock health event error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === EVALUATIONS ===
  app.get(api.evaluations.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const animalId = Number(req.params.id);
    const evals = await storage.getEvaluations(userId, animalId);
    res.json(evals);
  });

  app.post(api.evaluations.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.evaluations.create.input.parse(req.body);
      const evaluation = await storage.createEvaluation(userId, input);
      res.status(201).json(evaluation);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  });

  // === PRODUCTION RESET ===
  app.post("/api/reset-all-data", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { confirmPhrase } = req.body;
      
      if (confirmPhrase !== "RESET BREEDLOG") {
        return res.status(400).json({ message: "Invalid confirmation phrase" });
      }
      
      await storage.clearAllData(userId);
      res.json({ message: "All data cleared successfully" });
    } catch (err: any) {
      console.error("Reset data error:", err);
      res.status(500).json({ message: err.message || "Failed to reset data" });
    }
  });

  // === DEBUG TEST ROUTE ===
  app.get("/api/debug/test", (req, res) => {
    res.json({ success: true, timestamp: new Date().toISOString() });
  });

  // === BETA ACCESS SYSTEM ===
  const BETA_CONFIG = {
    MAX_TESTERS: 10,
    DEFAULT_EXPIRY_DAYS: 30,
    OFFLINE_GRACE_DAYS: 7,
  };
  
  // Generate a secure random code
  function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  
  // Helper to generate device ID from user agent + some user data
  function getDeviceId(req: Request): string {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const acceptLang = req.headers['accept-language'] || 'unknown';
    const hash = Buffer.from(userAgent + acceptLang).toString('base64').substring(0, 32);
    return hash;
  }
  
  // Check if invite code is valid (not expired, not revoked, uses remaining)
  async function isCodeValid(code: any): Promise<{ valid: boolean; reason?: string }> {
    if (!code) return { valid: false, reason: 'Code not found' };
    if (code.status === 'revoked') return { valid: false, reason: 'Code has been revoked' };
    if (code.status === 'expired') return { valid: false, reason: 'Code has expired' };
    if (new Date(code.expiresAt) < new Date()) return { valid: false, reason: 'Code has expired' };
    if (code.usesCount >= code.maxUses) return { valid: false, reason: 'Code has reached maximum uses' };
    return { valid: true };
  }
  
  // Check access status for authenticated user
  app.get("/api/beta/access", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const activation = await storage.getUserActivation(userId);
      
      if (!activation) {
        return res.json({ 
          hasAccess: false, 
          reason: 'No activation found',
          needsCode: true 
        });
      }
      
      // Check if activation is still valid
      if (activation.status !== 'active') {
        return res.json({ 
          hasAccess: false, 
          reason: 'Access revoked or expired',
          needsCode: false 
        });
      }
      
      // Get linked invite code to check its status
      const codes = await storage.getInviteCodes();
      const code = codes.find(c => c.id === activation.inviteCodeId);
      
      if (code && (code.status === 'revoked' || new Date(code.expiresAt) < new Date())) {
        // Update activation status
        await storage.updateUserActivation(userId, { status: 'revoked' });
        return res.json({ 
          hasAccess: false, 
          reason: 'Access has expired or been revoked',
          needsCode: false 
        });
      }
      
      // Check offline grace period
      const lastOnline = new Date(activation.lastOnlineCheck);
      const graceDays = BETA_CONFIG.OFFLINE_GRACE_DAYS;
      const graceEnd = new Date(lastOnline.getTime() + graceDays * 24 * 60 * 60 * 1000);
      
      if (new Date() > graceEnd) {
        return res.json({ 
          hasAccess: false, 
          reason: 'Offline grace period expired. Please connect to the internet.',
          needsCode: false,
          offlineGraceExpired: true
        });
      }
      
      // Update last online check
      await storage.updateUserActivation(userId, { 
        lastOnlineCheck: new Date(),
        offlineGraceStart: null 
      });
      
      res.json({ 
        hasAccess: true,
        activatedAt: activation.activatedAt,
        expiresAt: code?.expiresAt 
      });
    } catch (err: any) {
      console.error("Beta access check error:", err);
      res.status(500).json({ message: err.message });
    }
  });
  
  // Validate and activate with invite code
  // Note: This endpoint handles device registration inline to avoid session cookie issues
  app.post("/api/beta/validate", async (req, res) => {
    try {
      const { code: inputCode, deviceId: clientDeviceId } = req.body;
      
      if (!inputCode || typeof inputCode !== 'string') {
        return res.status(400).json({ message: 'Access code is required' });
      }
      
      // Try to get userId from session first, fallback to deviceId from request
      let userId = getUserId(req);
      let deviceId = getDeviceId(req);
      
      // If no session, try to register/find device using deviceId from request body
      if (!userId && clientDeviceId && typeof clientDeviceId === 'string' && clientDeviceId.length >= 32) {
        console.log("[Beta Validate] No session, attempting inline device registration for:", clientDeviceId);
        
        // Try to find existing user by deviceId
        let user = await storage.getUserByDeviceId(clientDeviceId);
        
        if (!user) {
          // Create new user for this device
          user = await storage.upsertUser({
            deviceId: clientDeviceId,
            deviceName: "Unknown Device",
          });
          console.log("[Beta Validate] Created new user:", user.id);
        }
        
        // Set session for future requests
        req.session.deviceId = clientDeviceId;
        req.session.userId = user.id;
        
        userId = user.id;
        deviceId = clientDeviceId;
      }
      
      if (!userId || !deviceId) {
        return res.status(401).json({ message: 'Device registration failed. Please refresh and try again.' });
      }
      
      const codeUpper = inputCode.toUpperCase().trim();
      
      // Check if user already has an activation
      const existingActivation = await storage.getUserActivation(userId);
      if (existingActivation && existingActivation.status === 'active') {
        return res.json({ success: true, message: 'Already activated' });
      }
      
      // Find the invite code
      const inviteCode = await storage.getInviteCodeByCode(codeUpper);
      const validation = await isCodeValid(inviteCode);
      
      if (!validation.valid) {
        return res.status(400).json({ message: validation.reason });
      }
      
      // Check max testers limit
      const activeTesters = await storage.getActiveTestersCount();
      if (activeTesters >= BETA_CONFIG.MAX_TESTERS) {
        return res.status(400).json({ message: 'Beta testing limit reached. No new testers can be added.' });
      }
      
      // Check device limit (1 device per code)
      const allActivations = await storage.getAllActiveActivations();
      const codeActivations = allActivations.filter(a => a.inviteCodeId === inviteCode!.id);
      
      if (codeActivations.length >= inviteCode!.maxDevices) {
        // Check if it's the same device
        const sameDevice = codeActivations.find(a => a.deviceId === deviceId);
        if (!sameDevice) {
          return res.status(400).json({ message: 'This code has already been used on another device' });
        }
      }
      
      // Create activation
      await storage.createUserActivation({
        userId,
        inviteCodeId: inviteCode!.id,
        deviceId,
        status: 'active',
      });
      
      // Increment uses count
      await storage.incrementInviteCodeUses(inviteCode!.id);
      
      res.json({ 
        success: true, 
        message: 'Access granted!',
        expiresAt: inviteCode!.expiresAt
      });
    } catch (err: any) {
      console.error("Beta validation error:", err);
      if (err.message?.includes('unique constraint')) {
        // User already has activation, this is fine
        return res.json({ success: true, message: 'Already activated' });
      }
      res.status(500).json({ message: err.message });
    }
  });
  
  // === ADMIN ROUTES (require ADMIN_PIN for access) ===
  // Admin routes are now protected by ADMIN_PIN secret (no Replit auth)
  // Admin check is already registered in registerDeviceAuthRoutes
  
  // Helper to set no-cache headers on admin responses
  function setNoCacheHeaders(res: Response): void {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });
  }
  
  // Database info endpoint for debugging environment mismatches
  app.get("/api/admin/db-info", requireAdminPin, async (req, res) => {
    try {
      setNoCacheHeaders(res);
      const codes = await storage.getInviteCodes();
      const dbUrl = process.env.DATABASE_URL || '';
      // Mask password in connection string
      const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
      const dbHost = maskedUrl.match(/@([^:\/]+)/)?.[1] || 'unknown';
      const dbName = maskedUrl.match(/\/([^?]+)/)?.[1] || 'unknown';
      
      res.json({
        env: process.env.NODE_ENV || 'unknown',
        dbHost,
        dbName,
        totalCodesCount: codes.length,
        codesList: codes.map(c => c.code).join(', ')
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // List all invite codes
  app.get("/api/admin/invite-codes", requireAdminPin, async (req, res) => {
    try {
      setNoCacheHeaders(res);
      const codes = await storage.getInviteCodes();
      const activeTesters = await storage.getActiveTestersCount();
      res.json({ 
        codes, 
        activeTesters,
        maxTesters: BETA_CONFIG.MAX_TESTERS
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Create new invite code
  app.post("/api/admin/invite-codes", requireAdminPin, async (req, res) => {
    try {
      const { notes, expiryDays = BETA_CONFIG.DEFAULT_EXPIRY_DAYS, maxUses = 1 } = req.body;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
      
      const code = await storage.createInviteCode({
        code: generateInviteCode(),
        expiresAt,
        maxUses,
        maxDevices: 1,
        notes,
      });
      
      res.status(201).json(code);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Revoke invite code
  app.post("/api/admin/invite-codes/:id/revoke", requireAdminPin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const code = await storage.updateInviteCode(id, { status: 'revoked' });
      
      if (!code) {
        return res.status(404).json({ message: 'Code not found' });
      }
      
      // Also revoke all activations using this code
      const activations = await storage.getAllActiveActivations();
      for (const activation of activations) {
        if (activation.inviteCodeId === id) {
          await storage.updateUserActivation(activation.userId, { status: 'revoked' });
        }
      }
      
      res.json({ success: true, code });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Get active testers
  app.get("/api/admin/testers", requireAdminPin, async (req, res) => {
    try {
      const activations = await storage.getAllActiveActivations();
      res.json({ 
        activations,
        count: activations.length,
        max: BETA_CONFIG.MAX_TESTERS
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
