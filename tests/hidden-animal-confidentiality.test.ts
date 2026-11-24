import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/routes";
import { storage } from "../server/storage";
import { setEntitlementState } from "../server/commercial";
import { getVisibleAIData } from "../server/animal-visibility";
import { buildBreedLogAIContext } from "../server/ai/breedlog-ai-context";
import { appendExchange } from "../server/ai/ai-chat-memory";
import { fixture } from "./helpers/paytoday-fixture";

test("35 original animals: all read/write surfaces enforce downgrade and verified restoration", async t => {
  assert.equal(process.env.USE_IN_MEMORY_STORAGE, "1");
  const f = fixture(storage.paymentTransaction);
  const user = f.workspace;
  await setEntitlementState(storage, { accountId: user, planId: "premium", status: "active", source: "test-provider", paidUntil: "2031-01-01T00:00:00Z", updatedAt: new Date().toISOString() });
  const animals = [];
  for (let i = 1; i <= 35; i++) animals.push(await storage.createAnimal(user, {
    tagId: `R2-${i}`, name: i > 33 ? `PRIVATE-HIDDEN-${i}` : `Visible ${i}`, sex: i % 2 ? "ram" : "ewe",
    status: i <= 3 ? "culled" : "active", createdAt: new Date(2026, 0, i), clientId: `r2-operation-${i}`,
    notes: i > 33 ? `SECRET-RECORD-${i}` : null,
  } as any));
  const v = animals[3], h = animals[33];
  await storage.updateAnimal(user, v.id, { sireId: h.id, externalSireInfo: h.name });
  await storage.createHealthRecord(user, { animalId: h.id, date: "2026-01-01", type: "treatment", treatment: "HIDDEN-TREATMENT" });
  await storage.createPerformanceRecord(user, { animalId: h.id, date: "2026-01-01", type: "weighing", weight: "91" });
  const breeding = await storage.createBreedingEvent(user, { eweId: v.id, ramId: h.id, matingDate: "2026-01-01", matingType: "natural" } as any);
  const image = await storage.createAnimalImage(user, { animalId: h.id, fileName: "private.jpg", imageData: "HIDDEN-IMAGE" } as any);
  const doc = await storage.createDocument(user, { animalId: h.id, name: "HIDDEN-DOC", data: "opaque" } as any);
  await storage.createExportedDocument(user, { animalId: null, documentType: "herd", subfolder: "herd", fileName: "private-herd.pdf", data: "HIDDEN-HERD-PDF" } as any);
  const flock = await storage.createFlockHealthEvent(user, { eventDate: "2026-01-01", productName: "treatment", route: "oral" } as any);
  await storage.createFlockHealthTreatments(user, [{ eventId: flock.id, animalId: h.id } as any]);
  const bloodline = await storage.createBloodline(user, { name: "test-line" } as any);
  await storage.setAnimalBloodline(user, { animalId: h.id, bloodlineId: bloodline.id } as any);
  await appendExchange(storage, user, { question: "Show my herd", response: { answer: "PRIVATE-HIDDEN-34", answerType: "data", confidence: "high", usedData: [], warnings: [], suggestedNextQuestions: [] }, category: null, id: "r2-history", timestamp: new Date().toISOString() } as any);
  const preserved = JSON.stringify(await storage.getAnimals(user, {}));

  const app = express(); app.use(express.json());
  const server = createServer(app); await registerRoutes(server, app);
  app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err.message }));
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const request = async (path: string, method = "GET", body?: any, device = "device-a", extra = {}) => {
    const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, {
      method, headers: { "Content-Type": "application/json", "x-test-user-id": user, "x-test-device-id": device, ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, text, body: response.headers.get("content-type")?.includes("json") ? JSON.parse(text) : null };
  };
  try {
    assert.equal((await request("/api/animals")).body.length, 35);
    await setEntitlementState(storage, { accountId: user, planId: "free", status: "expired", source: "test-provider", updatedAt: new Date().toISOString() });
    await t.test("full and stale-cursor reads on two devices exclude hidden rows and nested parents", async () => {
      for (const device of ["device-a", "device-b"]) {
        for (const path of ["/api/animals", "/api/animals?since=0&cursor=stale-premium-cursor", "/api/animals?search=PRIVATE-HIDDEN", `/api/animals/${v.id}`, `/api/animals/${v.id}/family-tree`, "/api/breeding-events", "/api/health-records", "/api/performance-records", "/api/documents", "/api/exported-documents", "/api/flock-health-events", "/api/ai/context-summary", "/api/ai/history"]) {
          const result = await request(path, "GET", undefined, device);
          assert.equal(result.status, 200, path);
          assert.doesNotMatch(result.text, /PRIVATE-HIDDEN|SECRET-RECORD|HIDDEN-TREATMENT|HIDDEN-DOC|HIDDEN-IMAGE|HIDDEN-HERD-PDF/, path);
          if (path.startsWith("/api/animals") && result.body) {
            const rows = Array.isArray(result.body) ? result.body : result.body.nodes ?? [result.body];
            assert.ok(rows.every((row: any) => row.id !== h.id && row.sireId !== h.id), path);
          }
        }
      }
      assert.equal((await request("/api/settings/export")).status, 403);
      const list = (await request("/api/animals")).body;
      assert.equal(list.length, 33); assert.equal(list.filter((row: any) => row.status === "culled").length, 3);
      assert.equal((await request("/api/animals/culled")).body.length, 3);
      assert.equal((await request(`/api/animals/${v.id}`)).body.sireId, null);
      const ent = (await request("/api/entitlements/me")).body;
      assert.equal(ent.downgradeProjection.hiddenAnimalCount, 2);
      assert.equal(ent.downgradeProjection.hiddenAnimalIds, undefined);
      const line = (await request(`/api/genetics/line-performance/${bloodline.id}`)).body;
      assert.equal(line.activeAnimals, 0); assert.equal(line.matingsRecorded, 0);
      const aiData = await getVisibleAIData(storage, user);
      const context = JSON.stringify(buildBreedLogAIContext(aiData));
      assert.doesNotMatch(context, /PRIVATE-HIDDEN|SECRET-RECORD|HIDDEN-TREATMENT/);
      assert.equal(aiData.animals.length, 33); assert.equal(aiData.healthRecords.length, 0);
    });
    await t.test("queued writes, replay, deletion and backups cannot reach hidden records", async () => {
      for (const device of ["device-a", "device-b"]) {
        for (const [path, method, body, extra] of [
          [`/api/animals/${h.id}`, "GET"], [`/api/animals/${h.id}`, "PUT", { notes: "queued edit" }],
          [`/api/animals/${h.id}`, "DELETE"], [`/api/animals/${h.id}/health`, "GET"],
          ["/api/animals", "POST", { tagId: "replay", sex: "ewe" }, { "X-Idempotency-Key": h.clientId! }],
          [`/api/animals/${v.id}`, "PUT", { sireId: h.id }],
          [`/api/animals/${h.id}/images/${image.id}`, "DELETE"], [`/api/breeding/${breeding.id}`, "DELETE"],
          [`/api/documents/${doc.id}`, "DELETE"], [`/api/flock-health-events/${flock.id}`, "GET"],
          ["/api/health-records", "POST", { animalId: h.id, date: "2026-01-01", type: "treatment", treatment: "queued treatment" }],
          ["/api/flock-health-events", "POST", { eventDate: "2026-01-01", treatments: [{ animalId: h.id }] }],
        ] as Array<[string, string, any?, any?]>) {
          const result = await request(path, method, body, device, extra);
          assert.equal(result.status, 404, path); assert.doesNotMatch(result.text, /PRIVATE-HIDDEN|SECRET-RECORD/);
        }
      }
      assert.equal((await request("/api/backups/manual", "POST", { passphrase: "test-only" })).status, 403);
      assert.equal((await request("/api/reset-all-data", "POST", { confirmPhrase: "RESET BREEDLOG", backupBeforeReset: true })).status, 403);
      assert.equal((await request("/api/account/deletion", "POST", { typedConfirmation: "DELETE MY BREEDLOG ACCOUNT", exportBeforeDeletion: true })).status, 403);
      assert.equal(JSON.stringify(await storage.getAnimals(user, {})), preserved);
      assert.equal((await storage.getAnimalImages(user, h.id)).length, 1);
      assert.equal((await storage.getBreedingEvents(user)).length, 1);
    });
    await t.test("verified settlement and idempotent reconciliation restore preserved data on both devices", async () => {
      const order = await f.create();
      assert.equal((await f.service.reconcile(user, order.orderId)).status, "paid");
      assert.equal((await f.service.reconcile(user, order.orderId)).status, "paid");
      for (const device of ["device-a", "device-b"]) {
        assert.equal((await request("/api/animals", "GET", undefined, device)).body.length, 35);
        const replay = await request("/api/animals", "POST", { tagId: "ignored", sex: "ewe" }, device, { "X-Idempotency-Key": h.clientId! });
        assert.equal(replay.status, 200); assert.equal(replay.body.id, h.id);
      }
      assert.equal(JSON.stringify(await storage.getAnimals(user, {})), preserved);
      assert.equal((await request(`/api/animals/${v.id}`)).body.sire.id, h.id);
      assert.equal((await request("/api/settings/export")).status, 200);
      assert.equal((await request("/api/health-records")).body.length, 1);
      assert.equal((await request("/api/documents")).body.length, 1);
      assert.equal((await request(`/api/flock-health-events/${flock.id}`)).body.treatments[0].animalId, h.id);
    });
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
