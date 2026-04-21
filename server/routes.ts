import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { DuplicateElectronicIdError } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupDeviceAuth, registerDeviceAuthRoutes, requireDeviceAuth, requireAdminPin, getUserId as getDeviceUserId, getDeviceId } from "./device-auth";
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
      if (err instanceof DuplicateElectronicIdError) {
        return res.status(400).json({
          message: err.message,
          field: "electronicId",
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
      if (err instanceof DuplicateElectronicIdError) {
        return res.status(400).json({
          message: err.message,
          field: "electronicId",
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

  app.get('/api/performance-records', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const records = await storage.getAllPerformanceRecords(userId);
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

  app.get('/api/health-records', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const records = await storage.getAllHealthRecords(userId);
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
          tattooId: record.tattooId || record.tattoo_id || record.tattoo || record.Tattoo || null,
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
      if (err instanceof DuplicateElectronicIdError) {
        return res.status(400).json({ message: err.message, field: "electronicId" });
      }
      console.error("CSV Import error:", err);
      res.status(500).json({ message: err.message || "Failed to import CSV" });
    }
  });

  app.post(api.eid.scan.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.eid.scan.input.parse(req.body);
      const electronicIdRaw = input.electronicIdRaw.trim();

      if (!electronicIdRaw) {
        return res.status(400).json({ message: "electronicIdRaw is required", field: "electronicIdRaw" });
      }

      const animal = await storage.getAnimalByElectronicId(userId, electronicIdRaw);
      const scanEvent = await storage.createEidScanEvent(userId, {
        animalId: animal?.id ?? null,
        electronicIdRaw,
        readerSource: input.readerSource ?? null,
        readerSessionId: input.readerSessionId ?? null,
        scannedAt: new Date(),
        matched: !!animal,
        matchMethod: animal ? "electronicId" : null,
        payload: input.payload ?? null,
      });

      return res.json({
        matched: !!animal,
        animal: animal ?? null,
        scanEvent,
        status: animal ? "matched" : "unassigned",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      console.error("EID scan error:", err);
      return res.status(500).json({ message: "Failed to process EID scan" });
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
  // Only available in non-production + admin-authenticated contexts.
  if (process.env.NODE_ENV !== "production") {
    app.get("/api/debug/test", requireAdminPin, (req, res) => {
      res.json({ success: true, timestamp: new Date().toISOString() });
    });
  }

  // === BETA ACCESS SYSTEM ===
  const BETA_CONFIG = {
    DEFAULT_EXPIRY_DAYS: 30,
    OFFLINE_GRACE_DAYS: 7,
  };
  
  // Get max testers from database (single source of truth)
  async function getMaxTesters(): Promise<number> {
    const value = await storage.getSystemSetting('max_testers');
    return value ? parseInt(value, 10) : 50; // Default to 50 if not set
  }
  
  // Generate a secure random code
  function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // Detect device type from User-Agent string
  function detectDeviceType(userAgent: string): 'mobile' | 'desktop' {
    const ua = userAgent.toLowerCase();
    // Check for mobile indicators
    if (
      ua.includes('android') ||
      ua.includes('iphone') ||
      ua.includes('ipad') ||
      ua.includes('ipod') ||
      ua.includes('blackberry') ||
      ua.includes('windows phone') ||
      ua.includes('mobile') ||
      ua.includes('tablet')
    ) {
      return 'mobile';
    }
    return 'desktop';
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
    // Always set no-cache headers for auth endpoints
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    
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
      
      // The 7-day offline grace window is enforced CLIENT-SIDE only (via localStorage
      // lastCheck in BetaAccessGate.tsx). If a request reaches THIS endpoint, the
      // device is online and reaching the server — by definition not in offline mode.
      // Refresh lastOnlineCheck unconditionally so future offline windows start fresh.
      await storage.updateUserActivation(userId, { 
        lastOnlineCheck: new Date(),
        offlineGraceStart: null 
      });
      
      // WORKSPACE HEALING: If this user has no sharedUserId set yet but another active
      // device is using the same invite code, link them to the same data workspace.
      // Uses the activation's own deviceId (not the request's session deviceId) to avoid
      // any session/cookie ambiguity in the middleware chain.
      try {
        const currentUser = await storage.getUserByDeviceId(activation.deviceId);
        if (currentUser && !currentUser.sharedUserId) {
          const allActivations = await storage.getAllActiveActivations();
          const codeActivations = allActivations.filter(
            a => a.inviteCodeId === activation.inviteCodeId && a.status === 'active'
          );
          const otherActivation = codeActivations.find(a => a.deviceId !== activation.deviceId);
          if (otherActivation) {
            const otherUser = await storage.getUserByDeviceId(otherActivation.deviceId);
            if (otherUser) {
              const primaryUserId = otherUser.sharedUserId || otherUser.id;
              await storage.setSharedUserId(currentUser.id, primaryUserId);
              console.log(`[Beta Access] Healed workspace: user ${currentUser.id} → ${primaryUserId}`);
            }
          }
        }
      } catch (healErr) {
        console.error("[Beta Access] Healing error (non-fatal):", healErr);
      }
      
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
  // Returns a device token for localStorage-based auth
  app.post("/api/beta/validate", async (req, res) => {
    // Always set no-cache headers for auth endpoints
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    
    try {
      const { code: inputCode, deviceId: clientDeviceId } = req.body;
      
      if (!inputCode || typeof inputCode !== 'string') {
        return res.status(400).json({ message: 'Please enter an access code.' });
      }
      
      if (!clientDeviceId || typeof clientDeviceId !== 'string' || clientDeviceId.length < 32) {
        return res.status(400).json({ message: 'Device ID missing. Please refresh the page and try again.' });
      }
      
      const codeUpper = inputCode.toUpperCase().trim();
      
      // STEP 1: Look up code and check basic eligibility (exists, not revoked, not expired)
      // NOTE: maxUses check is done AFTER slot checks below so we can give better error messages
      const inviteCode = await storage.getInviteCodeByCode(codeUpper);
      
      if (!inviteCode) {
        console.log(`[Beta Validate] Code not found in DB: "${codeUpper}"`);
        return res.status(400).json({ message: 'Code not found. Please check and try again.' });
      }
      if (inviteCode.status === 'revoked') {
        return res.status(400).json({ message: 'This code has been revoked.' });
      }
      if (inviteCode.status === 'expired' || new Date(inviteCode.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'This code has expired.' });
      }
      
      // STEP 2: Register/find device (atomic with activation)
      let user = await storage.getUserByDeviceId(clientDeviceId);
      
      if (!user) {
        try {
          user = await storage.upsertUser({
            deviceId: clientDeviceId,
            deviceName: "Unknown Device",
          });
          console.log("[Beta Validate] Created new user:", user.id);
        } catch (err: any) {
          // Handle race condition
          if (err.code === '23505' || err.message?.includes('unique constraint')) {
            user = await storage.getUserByDeviceId(clientDeviceId);
          }
          if (!user) {
            return res.status(500).json({ message: 'Activation failed. Please refresh and try again.' });
          }
        }
      }
      
      const userId = user.id;
      const deviceId = clientDeviceId;
      
      // Generate device token for localStorage-based auth
      const { generateDeviceToken } = await import('./device-auth');
      const token = generateDeviceToken(deviceId);
      
      // Check if user already has an activation
      const existingActivation = await storage.getUserActivation(userId);
      if (existingActivation && existingActivation.status === 'active') {
        // HEALING: If sharedUserId is missing, check if another device used the same code earlier
        // and set sharedUserId so this device resolves to the shared workspace.
        if (!user.sharedUserId) {
          const allActivations = await storage.getAllActiveActivations();
          const codeActivations = allActivations.filter(a => a.inviteCodeId === existingActivation.inviteCodeId && a.status === 'active');
          const otherActivation = codeActivations.find(a => a.deviceId !== deviceId);
          if (otherActivation) {
            // Find the other device's user to get their effective workspace ID
            const { users } = await import("@shared/models/auth");
            const { db } = await import("./db");
            const { eq } = await import("drizzle-orm");
            const otherUsers = await db.select().from(users).where(eq(users.id, otherActivation.userId));
            const otherUser = otherUsers[0];
            if (otherUser) {
              // The primary workspace is: their sharedUserId (if set) or their own id
              const primaryUserId = otherUser.sharedUserId || otherUser.id;
              await storage.setSharedUserId(userId, primaryUserId);
              user = { ...user, sharedUserId: primaryUserId };
              console.log(`[Beta Validate] Healed sharedUserId for ${userId} → ${primaryUserId}`);
            }
          }
        }
        // Use the effective userId (sharedUserId takes priority) for the session
        const effectiveUserId = user.sharedUserId || userId;
        req.session.deviceId = deviceId;
        req.session.userId = effectiveUserId;
        return res.json({ 
          success: true, 
          message: 'Already activated',
          token,
          deviceId,
          userId: effectiveUserId
        });
      }
      
      // Check max testers limit (from database)
      const activeTesters = await storage.getActiveTestersCount();
      const maxTesters = await getMaxTesters();
      if (activeTesters >= maxTesters) {
        return res.status(400).json({ message: 'Beta testing is currently full. Please try again later.' });
      }
      
      // Detect device type from User-Agent
      const userAgent = req.headers['user-agent'] || '';
      const deviceType = detectDeviceType(userAgent);
      console.log(`[Beta Validate] Device type detected: ${deviceType} (UA: ${userAgent.substring(0, 60)})`);

      // Check device slot limits (1 desktop + 1 mobile per code)
      const allActivations = await storage.getAllActiveActivations();
      const codeActivations = allActivations.filter(a => a.inviteCodeId === inviteCode!.id);
      
      // Check if this exact device already has a (revoked/expired) activation for this code
      const sameDeviceActivation = codeActivations.find(a => a.deviceId === deviceId);
      
      if (!sameDeviceActivation) {
        // New device trying to activate — check the slot for this device type FIRST
        // (before maxUses check so we give specific slot-full messages)
        const desktopActivations = codeActivations.filter(a => a.deviceType === 'desktop' && a.status === 'active');
        const mobileActivations = codeActivations.filter(a => a.deviceType === 'mobile' && a.status === 'active');
        
        if (deviceType === 'desktop' && desktopActivations.length >= 1) {
          console.log(`[Beta Validate] Desktop slot full for code ${inviteCode.id}`);
          return res.status(400).json({ 
            message: 'The desktop slot for this code is already taken. One desktop and one mobile device are allowed per code. Contact the admin to reset your desktop slot.' 
          });
        }
        if (deviceType === 'mobile' && mobileActivations.length >= 1) {
          console.log(`[Beta Validate] Mobile slot full for code ${inviteCode.id}`);
          return res.status(400).json({ 
            message: 'The mobile slot for this code is already taken. One desktop and one mobile device are allowed per code. Contact the admin to reset your mobile slot.' 
          });
        }
        
        // Final safety: count ACTIVE slots (1 desktop + 1 mobile = max 2 devices per code).
        // Using actual active-slot count instead of usesCount avoids blocking the mobile slot
        // when desktop has already activated (which was a bug for old codes with maxUses=1).
        const activeDeviceCount = codeActivations.filter(a => a.status === 'active').length;
        if (activeDeviceCount >= 2) {
          return res.status(400).json({ message: 'This code already has both device slots occupied (one desktop + one mobile). Contact the admin to reset a slot.' });
        }
      }
      
      // STEP 2b: Workspace sharing — if another device already activated this code,
      // link this device to the same data workspace (shared_user_id = primary userId).
      // This is what makes both devices see the same animals, breeding records, etc.
      const existingCodeActivations = codeActivations.filter(a => a.status === 'active');
      let effectiveUserId = userId;
      
      if (existingCodeActivations.length > 0) {
        // There's already an active device for this code — find their workspace ID
        const firstActivation = existingCodeActivations[0];
        const { users } = await import("@shared/models/auth");
        const { db } = await import("./db");
        const { eq } = await import("drizzle-orm");
        const primaryUsers = await db.select().from(users).where(eq(users.id, firstActivation.userId));
        const primaryUser = primaryUsers[0];
        if (primaryUser) {
          // The workspace owner is: their sharedUserId (if they're also secondary) or their own id
          const primaryUserId = primaryUser.sharedUserId || primaryUser.id;
          // Link this new device to the same workspace
          await storage.setSharedUserId(userId, primaryUserId);
          effectiveUserId = primaryUserId;
          console.log(`[Beta Validate] Linked device ${deviceId} (user ${userId}) to shared workspace ${primaryUserId}`);
        }
      }
      
      // Set session using the effective workspace userId
      req.session.deviceId = deviceId;
      req.session.userId = effectiveUserId;
      
      // STEP 3: Create activation (atomic - only after all checks pass)
      await storage.createUserActivation({
        userId,
        inviteCodeId: inviteCode!.id,
        deviceId,
        deviceType,
        status: 'active',
      });
      
      // STEP 4: Increment uses count (only after activation created)
      await storage.incrementInviteCodeUses(inviteCode!.id);
      
      console.log("[Beta Validate] Activation success for device:", deviceId);
      
      res.json({ 
        success: true, 
        message: 'Access granted!',
        expiresAt: inviteCode!.expiresAt,
        token,
        deviceId,
        userId: effectiveUserId
      });
    } catch (err: any) {
      console.error("Beta validation error:", err);
      if (err.message?.includes('unique constraint')) {
        // User already has activation - generate token and return success
        try {
          const { generateDeviceToken } = await import('./device-auth');
          const { deviceId: clientDeviceId } = req.body;
          const token = generateDeviceToken(clientDeviceId);
          return res.json({ 
            success: true, 
            message: 'Already activated',
            token,
            deviceId: clientDeviceId
          });
        } catch {
          return res.json({ success: true, message: 'Already activated' });
        }
      }
      res.status(500).json({ message: 'Activation failed. Please refresh and try again.' });
    }
  });
  
  // === VERSION ENDPOINT (for cache-busting) ===
  // Returns current app version - client checks on startup and forces reload if mismatched
  const APP_VERSION = "1.0.1"; // Increment on each deployment
  app.get("/api/version", (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    res.json({ 
      version: APP_VERSION,
      serverTime: new Date().toISOString()
    });
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
    setNoCacheHeaders(res);
    try {
      const codes = await storage.getInviteCodes();
      const activationsCount = await storage.getActiveTestersCount();
      const dbUrl = process.env.DATABASE_URL || '';
      // Mask password in connection string
      const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
      const dbHost = maskedUrl.match(/@([^:\/]+)/)?.[1] || 'unknown';
      const dbName = maskedUrl.match(/\/([^?]+)/)?.[1] || 'unknown';
      
      // Detect production vs development
      // Production is determined by: 
      // 1. NODE_ENV=production OR
      // 2. Being accessed from breedlog.replit.app
      const isProduction = process.env.NODE_ENV === 'production' || 
                           process.env.REPL_SLUG?.includes('breedlog') ||
                           dbHost.includes('neon') || 
                           dbHost.includes('prod');
      
      res.json({
        env: process.env.NODE_ENV || 'unknown',
        isProduction,
        dbHost,
        dbName,
        totalCodesCount: codes.length,
        activationsCount,
        codesList: codes.map(c => c.code).join(', '),
        serverTime: new Date().toISOString(),
        appVersion: APP_VERSION
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // List all invite codes with device slot info
  app.get("/api/admin/invite-codes", requireAdminPin, async (req, res) => {
    try {
      setNoCacheHeaders(res);
      const codes = await storage.getInviteCodes();
      const activeTesters = await storage.getActiveTestersCount();
      const maxTesters = await getMaxTesters();
      const allActivations = await storage.getAllActiveActivations();
      
      // Attach slot info to each code
      const codesWithSlots = codes.map(code => {
        const codeActivations = allActivations.filter(a => a.inviteCodeId === code.id);
        const desktopSlot = codeActivations.find(a => a.deviceType === 'desktop' && a.status === 'active');
        const mobileSlot = codeActivations.find(a => a.deviceType === 'mobile' && a.status === 'active');
        return {
          ...code,
          slots: {
            desktop: desktopSlot ? { taken: true, activatedAt: desktopSlot.activatedAt } : { taken: false },
            mobile: mobileSlot ? { taken: true, activatedAt: mobileSlot.activatedAt } : { taken: false },
          }
        };
      });
      
      res.json({ 
        codes: codesWithSlots, 
        activeTesters,
        maxTesters
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Create new invite code
  app.post("/api/admin/invite-codes", requireAdminPin, async (req, res) => {
    try {
      const { notes, expiryDays = BETA_CONFIG.DEFAULT_EXPIRY_DAYS, maxUses = 2 } = req.body;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);
      
      const code = await storage.createInviteCode({
        code: generateInviteCode(),
        expiresAt,
        maxUses,
        maxDevices: 2, // 1 desktop slot + 1 mobile slot
        notes,
      });
      
      res.status(201).json(code);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Lookup a code by value (admin diagnostic)
  app.get("/api/admin/invite-codes/lookup/:code", requireAdminPin, async (req, res) => {
    setNoCacheHeaders(res);
    try {
      const codeUpper = req.params.code.toUpperCase().trim();
      const inviteCode = await storage.getInviteCodeByCode(codeUpper);
      
      if (!inviteCode) {
        return res.status(404).json({ 
          found: false, 
          message: `Code "${codeUpper}" not found in database.`,
          hint: 'The code does not exist. Create a new code in the admin panel and share it with your tester.'
        });
      }
      
      const allActivations = await storage.getAllActiveActivations();
      const codeActivations = allActivations.filter(a => a.inviteCodeId === inviteCode.id);
      const desktopSlot = codeActivations.find(a => a.deviceType === 'desktop' && a.status === 'active');
      const mobileSlot = codeActivations.find(a => a.deviceType === 'mobile' && a.status === 'active');
      
      const validation = await isCodeValid(inviteCode);
      
      res.json({
        found: true,
        code: inviteCode,
        validation,
        slots: {
          desktop: desktopSlot ? { taken: true, deviceId: desktopSlot.deviceId, activatedAt: desktopSlot.activatedAt } : { taken: false },
          mobile: mobileSlot ? { taken: true, deviceId: mobileSlot.deviceId, activatedAt: mobileSlot.activatedAt } : { taken: false },
        },
        totalActivations: codeActivations.length,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reset a specific device slot for a code (admin can free up desktop or mobile slot)
  app.post("/api/admin/invite-codes/:id/reset-slot", requireAdminPin, async (req, res) => {
    setNoCacheHeaders(res);
    try {
      const id = Number(req.params.id);
      const { slotType } = req.body; // 'desktop' or 'mobile'
      
      if (!slotType || !['desktop', 'mobile'].includes(slotType)) {
        return res.status(400).json({ message: 'slotType must be "desktop" or "mobile"' });
      }
      
      const allActivations = await storage.getAllActiveActivations();
      const slotActivation = allActivations.find(
        a => a.inviteCodeId === id && a.deviceType === slotType && a.status === 'active'
      );
      
      if (!slotActivation) {
        return res.json({ success: true, message: `${slotType} slot is already empty.` });
      }
      
      await storage.updateUserActivation(slotActivation.userId, { status: 'revoked' });
      // Decrement uses count
      const codes = await storage.getInviteCodes();
      const code = codes.find(c => c.id === id);
      if (code && code.usesCount > 0) {
        await storage.updateInviteCode(id, { usesCount: code.usesCount - 1 });
      }
      
      const slotLabel = slotType.charAt(0).toUpperCase() + slotType.slice(1);
      res.json({ success: true, message: `${slotLabel} slot has been reset. The device can now re-activate with the same code.` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Delete invite code (admin can force delete any code)
  app.delete("/api/admin/invite-codes/:id", requireAdminPin, async (req, res) => {
    setNoCacheHeaders(res);
    try {
      const id = Number(req.params.id);
      
      // Check code exists
      const codes = await storage.getInviteCodes();
      const code = codes.find(c => c.id === id);
      
      if (!code) {
        return res.status(404).json({ message: "Code not found" });
      }
      
      // First, delete any activations linked to this code (handles FK constraint)
      await storage.deleteActivationsByInviteCodeId(id);
      
      // Then delete the code itself
      await storage.deleteInviteCode(id);
      res.json({ success: true, message: "Code deleted" });
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
      const maxTesters = await getMaxTesters();
      res.json({ 
        activations,
        count: activations.length,
        max: maxTesters
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
  
  // Update max testers limit (editable from Admin UI)
  app.put("/api/admin/settings/max-testers", requireAdminPin, async (req, res) => {
    try {
      const { maxTesters } = req.body;
      if (typeof maxTesters !== 'number' || maxTesters < 1) {
        return res.status(400).json({ message: 'maxTesters must be a positive number' });
      }
      await storage.setSystemSetting('max_testers', String(maxTesters), 'Maximum number of active testers allowed in beta program');
      res.json({ success: true, maxTesters });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
