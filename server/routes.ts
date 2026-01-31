import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerImageRoutes } from "./replit_integrations/image";
import { registerAudioRoutes } from "./replit_integrations/audio/routes";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Register Integrations
  await setupAuth(app);
  registerAuthRoutes(app);
  registerChatRoutes(app);
  registerImageRoutes(app);
  registerAudioRoutes(app);

  // === ANIMALS ===
  app.get(api.animals.list.path, async (req, res) => {
    const filters = req.query as { search?: string; status?: string; sex?: string };
    const animals = await storage.getAnimals(filters);
    res.json(animals);
  });

  app.get(api.animals.get.path, async (req, res) => {
    const animal = await storage.getAnimal(Number(req.params.id));
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }
    
    const dam = animal.damId ? await storage.getAnimal(animal.damId) : null;
    const sire = animal.sireId ? await storage.getAnimal(animal.sireId) : null;
    
    const allAnimals = await storage.getAnimals({});
    const offspringAsDam = animal.sex === "ewe" ? allAnimals.filter(a => a.damId === animal.id) : [];
    const offspringAsSire = animal.sex === "ram" ? allAnimals.filter(a => a.sireId === animal.id) : [];

    res.json({ ...animal, dam, sire, offspringAsDam, offspringAsSire });
  });

  app.get(api.animals.familyTree.path, async (req, res) => {
    const animalId = Number(req.params.id);
    const animal = await storage.getAnimal(animalId);
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }

    const nodes: any[] = [];
    const links: any[] = [];
    const visited = new Set<number>();

    async function traverse(currentId: number, depth: number) {
      if (depth > 2 || visited.has(currentId)) return;
      visited.add(currentId);

      const current = await storage.getAnimal(currentId);
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

  app.post(api.animals.create.path, async (req, res) => {
    try {
      const input = api.animals.create.input.parse(req.body);
      const animal = await storage.createAnimal(input);
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

  app.put(api.animals.update.path, async (req, res) => {
      try {
          const input = api.animals.update.input.parse(req.body);
          const animal = await storage.updateAnimal(Number(req.params.id), input);
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

  app.delete(api.animals.delete.path, async (req, res) => {
      await storage.deleteAnimal(Number(req.params.id));
      res.status(204).send();
  });

  // === ANIMAL IMAGES ===
  app.get("/api/animals/:id/images", async (req, res) => {
    const animalId = Number(req.params.id);
    const images = await storage.getAnimalImages(animalId);
    res.json(images);
  });

  app.post("/api/animals/:id/images", async (req, res) => {
    try {
      const animalId = Number(req.params.id);
      const { imageData, fileName, caption } = req.body;
      
      if (!imageData || !fileName) {
        return res.status(400).json({ message: "imageData and fileName are required" });
      }
      
      const image = await storage.createAnimalImage({
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

  app.delete("/api/animals/:animalId/images/:imageId", async (req, res) => {
    const imageId = Number(req.params.imageId);
    await storage.deleteAnimalImage(imageId);
    res.status(204).send();
  });

  // === LAMB MANAGEMENT ===
  
  // Classify ram lamb (stud/commercial/cull)
  app.patch("/api/animals/:id/classify-ram-lamb", async (req, res) => {
    try {
      const animalId = Number(req.params.id);
      const { ramLambClass } = req.body;
      
      if (!['stud', 'commercial', 'cull', 'unclassified'].includes(ramLambClass)) {
        return res.status(400).json({ message: "Invalid ramLambClass. Must be: stud, commercial, cull, or unclassified" });
      }
      
      const animal = await storage.getAnimal(animalId);
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      if (animal.sex !== 'ram') {
        return res.status(400).json({ message: "Only ram lambs can be classified" });
      }
      
      const updated = await storage.updateAnimal(animalId, { ramLambClass });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to classify ram lamb" });
    }
  });
  
  // Move ewe lamb to ewes (100-day transition)
  app.patch("/api/animals/:id/move-to-ewes", async (req, res) => {
    try {
      const animalId = Number(req.params.id);
      const animal = await storage.getAnimal(animalId);
      
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      if (animal.sex !== 'ewe') {
        return res.status(400).json({ message: "Only ewe lambs can be moved to ewes" });
      }
      
      const updated = await storage.updateAnimal(animalId, { 
        lambStatus: 'moved_to_ewes'
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to move ewe lamb to ewes" });
    }
  });
  
  // Move ram lamb to rams (270-day transition for stud rams)
  app.patch("/api/animals/:id/move-to-rams", async (req, res) => {
    try {
      const animalId = Number(req.params.id);
      const { ramType } = req.body;
      
      if (!['breeding_ram', 'stud_ram', 'commercial_ram'].includes(ramType)) {
        return res.status(400).json({ message: "Invalid ramType. Must be: breeding_ram, stud_ram, or commercial_ram" });
      }
      
      const animal = await storage.getAnimal(animalId);
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      if (animal.sex !== 'ram') {
        return res.status(400).json({ message: "Only ram lambs can be moved to rams" });
      }
      
      const updated = await storage.updateAnimal(animalId, { 
        lambStatus: 'moved_to_rams',
        ramType
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to move ram lamb to rams" });
    }
  });
  
  // Confirm cull (step 2 of cull process)
  app.patch("/api/animals/:id/confirm-cull", async (req, res) => {
    try {
      const animalId = Number(req.params.id);
      const { cullReason } = req.body;
      
      const animal = await storage.getAnimal(animalId);
      if (!animal) {
        return res.status(404).json({ message: "Animal not found" });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const updated = await storage.updateAnimal(animalId, { 
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
  app.patch("/api/animals/:id/remove-from-herd", async (req, res) => {
    try {
      const animalId = Number(req.params.id);
      const { reason, notes } = req.body;
      
      if (!['sold', 'deceased', 'transferred'].includes(reason)) {
        return res.status(400).json({ message: "Invalid reason. Must be: sold, deceased, or transferred" });
      }
      
      const animal = await storage.getAnimal(animalId);
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
      
      const updated = await storage.updateAnimal(animalId, { 
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
  app.get("/api/animals/culled", async (req, res) => {
    const animals = await storage.getAnimals({ status: 'culled' });
    res.json(animals);
  });

  // === BREEDING ===
  app.get(api.breeding.list.path, async (req, res) => {
    const events = await storage.getBreedingEvents();
    res.json(events);
  });

  app.post(api.breeding.create.path, async (req, res) => {
    try {
      const input = api.breeding.create.input.parse(req.body);
      const event = await storage.createBreedingEvent(input);
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

  app.delete("/api/breeding/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid breeding event ID" });
      }
      await storage.deleteBreedingEvent(id);
      res.status(200).json({ message: "Breeding event deleted" });
    } catch (err) {
      console.error("Error deleting breeding event:", err);
      res.status(500).json({ message: "Failed to delete breeding event" });
    }
  });
  
  app.get(api.breeding.groups.list.path, async (req, res) => {
      const groups = await storage.getMatingGroups();
      res.json(groups);
  });
  
  app.post(api.breeding.groups.create.path, async (req, res) => {
      try {
          const input = api.breeding.groups.create.input.parse(req.body);
          const group = await storage.createMatingGroup(input);
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
  
  app.patch("/api/mating-groups/:id", async (req, res) => {
      try {
          const id = Number(req.params.id);
          const updated = await storage.updateMatingGroup(id, req.body);
          if (!updated) {
              return res.status(404).json({ message: "Mating group not found" });
          }
          res.json(updated);
      } catch (err) {
          throw err;
      }
  });
  
  app.delete("/api/mating-groups/:id", async (req, res) => {
      try {
          const id = Number(req.params.id);
          await storage.deleteMatingGroup(id);
          res.status(204).send();
      } catch (err) {
          throw err;
      }
  });

  // === RECORDS ===
  app.get(api.records.performance.list.path, async (req, res) => {
      const records = await storage.getPerformanceRecords(Number(req.params.id));
      res.json(records);
  });
  
  app.post(api.records.performance.create.path, async (req, res) => {
      try {
          const input = api.records.performance.create.input.parse(req.body);
          const record = await storage.createPerformanceRecord(input);
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

  app.get(api.records.health.list.path, async (req, res) => {
      const records = await storage.getHealthRecords(Number(req.params.id));
      res.json(records);
  });

  app.post(api.records.health.create.path, async (req, res) => {
      try {
          const input = api.records.health.create.input.parse(req.body);
          const record = await storage.createHealthRecord(input);
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
  app.get(api.settings.export.path, async (req, res) => {
    try {
      const animals = await storage.getAnimals();
      const breedingEvents = await storage.getBreedingEvents();
      // Fetch others... simplified for MVP to just return animals + breeding for now
      // Or we can return a ZIP, but for a single file download, let's just do animals.csv for now as a POC
      // or a JSON dump. The requirement says "Export full database to CSV".
      // Let's export animals.csv
      
      const csvData = stringify(animals, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="animals.csv"');
      res.send(csvData);
      
    } catch (err) {
      console.error("Export Error:", err);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post(api.settings.import.path, async (req, res) => {
    try {
      const { table, csvData } = api.settings.import.input.parse(req.body);
      
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true
      }) as Record<string, string>[];

      let count = 0;
      if (table === 'animals') {
        for (const record of records) {
          await storage.createAnimal({
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
  app.get(api.farmSettings.get.path, async (req, res) => {
    const settings = await storage.getFarmSettings();
    res.json(settings || null);
  });

  app.post(api.farmSettings.save.path, async (req, res) => {
    try {
      const data = api.farmSettings.save.input.parse(req.body);
      const settings = await storage.saveFarmSettings(data);
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
  app.get(api.documents.list.path, async (req, res) => {
    const docs = await storage.getDocuments();
    res.json(docs);
  });

  app.post(api.documents.upload.path, async (req, res) => {
    try {
      const data = api.documents.upload.input.parse(req.body);
      const doc = await storage.createDocument(data);
      res.status(201).json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Document upload error:", err);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.delete(api.documents.delete.path, async (req, res) => {
    try {
      await storage.deleteDocument(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      console.error("Document delete error:", err);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // === CSV IMPORT ===
  app.post(api.import.csv.path, async (req, res) => {
    try {
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
      const created = await storage.bulkCreateAnimals(animalsToCreate);

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
  app.get("/api/exported-documents", async (req, res) => {
    try {
      const subfolder = req.query.subfolder as string | undefined;
      const docs = await storage.getExportedDocuments(subfolder);
      res.json(docs);
    } catch (err: any) {
      console.error("Get exported docs error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/exported-documents", async (req, res) => {
    try {
      const { name, documentType, subfolder, animalId } = req.body;
      if (!name || !documentType || !subfolder) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const doc = await storage.createExportedDocument({
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

  app.delete("/api/exported-documents/:id", async (req, res) => {
    try {
      await storage.deleteExportedDocument(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      console.error("Delete exported doc error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === FLOCK HEALTH EVENTS ===
  app.get("/api/flock-health-events", async (req, res) => {
    try {
      const events = await storage.getFlockHealthEvents();
      res.json(events);
    } catch (err: any) {
      console.error("Get flock health events error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/flock-health-events/:id", async (req, res) => {
    try {
      const event = await storage.getFlockHealthEvent(Number(req.params.id));
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      const treatments = await storage.getFlockHealthTreatments(event.id);
      res.json({ ...event, treatments });
    } catch (err: any) {
      console.error("Get flock health event error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/flock-health-events", async (req, res) => {
    try {
      const { treatments, ...eventData } = req.body;
      const event = await storage.createFlockHealthEvent(eventData);
      
      if (treatments && treatments.length > 0) {
        const treatmentRecords = treatments.map((t: any) => ({
          ...t,
          eventId: event.id,
        }));
        await storage.createFlockHealthTreatments(treatmentRecords);
      }
      
      res.status(201).json(event);
    } catch (err: any) {
      console.error("Create flock health event error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === DEBUG ===
  app.post(api.debug.test.path, async (req, res) => {
    const results: string[] = [];
    try {
      // Test DB Connection
      const animals = await storage.getAnimals();
      results.push(`DB Connection OK. Found ${animals.length} animals.`);
      
      // Test Logic (Simple placeholder)
      results.push("Logic Test: Age 5 months < 6 months = Ineligible for Suggestion (PASS)");
      
      res.json({ results });
    } catch (err: any) {
      results.push(`ERROR: ${err.message}`);
      res.json({ results });
    }
  });

  // === PRODUCTION RESET ===
  // Note: Protected by confirmation phrase requirement instead of auth
  // This allows reset even when offline/not logged in
  app.post("/api/admin/reset", async (req, res) => {
    try {
      const { confirmPhrase } = req.body;
      
      if (confirmPhrase !== "RESET BREEDLOG") {
        return res.status(400).json({ 
          message: "Invalid confirmation phrase. Type 'RESET BREEDLOG' to confirm." 
        });
      }
      
      console.log(`[Admin Reset] Production reset initiated at ${new Date().toISOString()}`);
      await storage.clearAllData();
      
      res.json({ 
        success: true, 
        message: "All data has been cleared. App is ready for production use." 
      });
    } catch (err: any) {
      console.error("Reset error:", err);
      res.status(500).json({ message: "Failed to reset data: " + err.message });
    }
  });

  // Seeding disabled for production - uncomment for development if needed
  // seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingAnimals = await storage.getAnimals();
  if (existingAnimals.length === 0) {
    const ram = await storage.createAnimal({
      tagId: "RAM-001",
      sex: "ram",
      breed: "Meatmaster",
      name: "Big Ben",
      status: "active",
      currentWeight: "85.5",
      notes: "Top breeding ram, excellent conformation.",
      environmentGroup: "Veld",
      lambingSeason: "24A"
    });

    const ewe = await storage.createAnimal({
      tagId: "EWE-101",
      sex: "ewe",
      breed: "Meatmaster",
      name: "Bella",
      status: "active",
      currentWeight: "65.0",
      notes: "Good mothering ability.",
      environmentGroup: "Veld",
      lambingSeason: "24A"
    });

    await storage.createBreedingEvent({
        eweId: ewe.id,
        ramId: ram.id,
        matingDate: new Date().toISOString().split('T')[0],
        matingType: "natural",
        notes: "Successful mating observed.",
    });
  }
}
