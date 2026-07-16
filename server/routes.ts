import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { DuplicateElectronicIdError, DuplicateTagIdError, DuplicateAnimalNameError } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupDeviceAuth, registerDeviceAuthRoutes, requireDeviceAuth, requireAdminPin, isAdminPinHeaderValid, getUserId as getDeviceUserId, getDeviceId } from "./device-auth";
import { registerAIRoutes } from "./ai/breedlog-ai-routes";
import { parse } from "csv-parse/sync";
import { buildBreedLogCsvContent, buildBreedLogCsvRows, parseBreedLogCsvRecords, buildBreedLogImportTemplateCsv } from "@shared/import-export";
import { buildBreedLogSimulationDataset } from "@shared/breedlog-simulation";
import { MASTER_SIMULATION_ACCESS_CODE, MASTER_SIMULATION_BATCH_MARKER, MASTER_SIMULATION_MAX_DEVICES, isMasterSimulationCode } from "@shared/master-simulation";
import {
  BILLING_CATALOG,
  EntitlementDeniedError,
  applyBillingEvent,
  assertCanCreateAnimal,
  billingEventSchema,
  cancelBillingSubscription,
  completeTestCheckoutSession,
  createBillingPortalSession,
  createCheckoutSession,
  getDowngradeVisibleAnimalIdSet,
  getBillingSubscriptionState,
  getEntitlementState,
  listBillingAuditEntries,
  projectDowngradedAnimalVisibility,
  reserveUsage,
  simulateBillingProviderEvent,
  verifyBillingSignature,
} from "./commercial";
import {
  BackupRejectedError,
  createWorkspaceBackup,
  previewWorkspaceBackup,
  restoreWorkspaceBackup,
  type EncryptedBreedLogBackup,
} from "./backup";
import {
  getAutomaticBackupStatus,
  runAutomaticBackupForWorkspace,
  runAutomaticBackupSweep,
} from "./backup-jobs";
import { resolveBackupStorageAdapter } from "./backup-storage";
import {
  AccountDeletionError,
  cancelAccountDeletion,
  getAccountDeletionState,
  isAccountSuspendedForDeletion,
  processExpiredAccountDeletionQueue,
  requestAccountDeletion,
} from "./account-deletion";
import {
  ManagedAuthError,
  buildManagedAuthProfile,
  createManagedAuthProvider,
  loginManagedAccount,
  registerManagedAccount,
  requestPasswordRecovery,
  resetPasswordWithToken,
  revokeManagedDevice,
  verifyAccountEmail,
} from "./managed-auth";
import {
  BREEDLOG_DATA_SCHEMA_VERSION,
  BREEDLOG_RUNTIME_BUILD_DATE,
  BREEDLOG_RUNTIME_VERSION,
  BREEDLOG_ANDROID_VERSION_CODE,
  evaluateRuntimeUpdateState,
  type BreedLogRuntimePlatform,
} from "@shared/update-runtime";

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
const managedAuthProvider = createManagedAuthProvider(storage);
const backupStorageAdapter = resolveBackupStorageAdapter();
const billingTestRoutesEnabled = process.env.NODE_ENV === "test" || process.env.BILLING_TEST_ROUTES === "1";

function inferExportQuotaClass(documentType: string, subfolder: string, animalId: number | null | undefined, metadata: Record<string, any> | null | undefined) {
  if (metadata?.quotaClass === "individual_pdf" || metadata?.quotaClass === "batch_pdf") {
    return metadata.quotaClass;
  }
  if (metadata?.exportType !== "pdf") {
    return null;
  }
  return documentType === "individual" && subfolder === "individual" && animalId
    ? "individual_pdf"
    : "batch_pdf";
}

async function getCurrentDeviceUser(req: Request) {
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    throw new ManagedAuthError("DEVICE_NOT_REGISTERED", "Device must be registered before account authentication.", 401);
  }
  const deviceUser = await storage.getUserByDeviceId(deviceId);
  if (!deviceUser) {
    throw new ManagedAuthError("DEVICE_NOT_REGISTERED", "Device must be registered before account authentication.", 401);
  }
  return { deviceId, deviceUser };
}

function accountDeletionBypass(path: string): boolean {
  return path.startsWith("/api/account/deletion")
    || path.startsWith("/api/billing/webhook/")
    || path === "/api/auth/me"
    || path === "/api/device/info"
    || path === "/api/auth/logout"
    || path === "/api/device/logout"
    || path === "/api/beta/logout";
}

type DowngradeVisibilityContext = {
  visibleAnimalIds: Set<number>;
  hiddenAnimalIds: Set<number>;
};

async function getDowngradeVisibilityContext(userId: string): Promise<DowngradeVisibilityContext | null> {
  const entitlement = await getEntitlementState(storage, userId);
  if (entitlement.planId !== "free") {
    return null;
  }
  const allAnimals = await storage.getAnimals(userId, {});
  const visibleAnimalIds = getDowngradeVisibleAnimalIdSet(allAnimals);
  const hiddenAnimalIds = new Set(
    allAnimals
      .filter((animal) => (animal.status ?? "active") === "active" && !visibleAnimalIds.has(animal.id))
      .map((animal) => animal.id),
  );
  return { visibleAnimalIds, hiddenAnimalIds };
}

function isAnimalVisible(context: DowngradeVisibilityContext | null, animalId: number | null | undefined) {
  if (!context || animalId == null) return true;
  return context.visibleAnimalIds.has(animalId);
}

function filterRowsForVisibleAnimals<T>(
  context: DowngradeVisibilityContext | null,
  rows: T[],
  selectors: Array<(row: T) => number | null | undefined>,
): T[] {
  if (!context) return rows;
  return rows.filter((row) => selectors.every((selector) => isAnimalVisible(context, selector(row))));
}

function hiddenAnimalNotFound(res: Response) {
  return res.status(404).json({
    message: "Animal is hidden on the Free plan. Reactivate Premium to restore the full workspace.",
    code: "ANIMAL_HIDDEN_BY_DOWNGRADE",
  });
}

async function seedMasterSimulationIfNeeded(targetUserId: string, code: string) {
  if (!isMasterSimulationCode(code)) return;
  const existing = await storage.getAnimals(targetUserId, {});
  if (existing.some((a: any) => (a.notes || "").includes(MASTER_SIMULATION_BATCH_MARKER))) return; // idempotent/current batch already present
  const ds = buildBreedLogSimulationDataset();
  const idMap = new Map<number, number>();
  const mark = (txt?: string | null) => [txt, MASTER_SIMULATION_BATCH_MARKER].filter(Boolean).join(" | ");

  for (const a of ds.animals) {
    const { id: _id, userId: _userId, ...rest } = a as any;
    const created = await storage.createAnimal(targetUserId, { ...rest, sireId: null, damId: null, notes: mark(rest.notes) });
    idMap.set(a.id, created.id);
  }
  for (const a of ds.animals) {
    const newId = idMap.get(a.id)!;
    const sireId = a.sireId ? idMap.get(a.sireId) || null : null;
    const damId = a.damId ? idMap.get(a.damId) || null : null;
    if (sireId || damId) await storage.updateAnimal(targetUserId, newId, { sireId, damId, notes: mark((a as any).notes) });
  }

  for (const g of ds.matingGroups) {
    const { id: _gid, userId: _guid, ...gRest } = g as any;
    await storage.createMatingGroup(targetUserId, { ...gRest, ramId: idMap.get(gRest.ramId)!, eweIds: (gRest.eweIds || []).map((id: number) => idMap.get(id)).filter(Boolean), notes: mark(gRest.notes) });
  }
  for (const e of ds.breedingEvents) {
    const { id: _eid, userId: _euid, ...eRest } = e as any;
    await storage.createBreedingEvent(targetUserId, { ...eRest, eweId: idMap.get(eRest.eweId)!, ramId: idMap.get(eRest.ramId)!, notes: mark(eRest.notes), matingGroupId: null });
  }

  for (const h of ds.healthRecords) {
    const { id: _hid, userId: _huid, ...hRest } = h as any;
    const animalId = idMap.get(hRest.animalId);
    if (!animalId) continue;
    await storage.createHealthRecord(targetUserId, { ...hRest, animalId, notes: mark(hRest.notes) });
  }

  const flockEvent = await storage.createFlockHealthEvent(targetUserId, {
    date: '2026-01-15',
    title: `Master Simulation Batch ${MASTER_SIMULATION_BATCH_MARKER}`,
    category: 'vaccination',
    severity: 'info',
    status: 'completed',
    affectedCount: 400,
    notes: `Seeded by ${MASTER_SIMULATION_BATCH_MARKER}`,
  } as any);
  await storage.createFlockHealthTreatments(targetUserId, [{ eventId: flockEvent.id, treatmentType: 'vaccine', product: 'Routine', dosage: 'batch', notes: `Seeded by ${MASTER_SIMULATION_BATCH_MARKER}` } as any]);

  // Seed Kwantam demo bloodlines for master simulation workspace only
  await storage.seedGeneticsForUser(targetUserId, ['Baksteen', 'Bosch', 'Zelenski', 'Rolo', 'Nitro']);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup device-based authentication
  setupDeviceAuth(app);
  registerDeviceAuthRoutes(app);
  
  // NOTE: The Replit-template AI integration routes (chat /api/conversations*,
  // image /api/generate-image, audio voice-stream) are intentionally NOT
  // registered. They had no authentication and no per-user scoping, which
  // exposed every conversation globally and allowed anonymous use of the
  // OpenAI key. The BreedLog assistant (/api/ai/*) is the supported,
  // authenticated AI surface.

  app.use(async (req, res, next) => {
    const userId = getDeviceUserId(req);
    if (!userId || accountDeletionBypass(req.path)) {
      return next();
    }
    if (await isAccountSuspendedForDeletion(storage, userId)) {
      return res.status(423).json({
        message: "This account is suspended during the deletion recovery window. Cancel deletion to resume normal access.",
        code: "ACCOUNT_DELETION_SUSPENDED",
      });
    }
    return next();
  });

  // Register BreedLog AI Assistant routes after deletion gating so recovery
  // windows suspend AI access just like the rest of the workspace.
  registerAIRoutes(app);

  // === MANAGED ACCOUNT AUTHENTICATION ===
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const sessionAccountId = req.session.accountId;
      const deviceId = getDeviceId(req);
      const accountDevice = !sessionAccountId && deviceId ? await storage.getAccountDeviceByDeviceId(deviceId) : null;
      const accountId = sessionAccountId || accountDevice?.accountId;
      if (!accountId) {
        return res.json({
          authenticated: false,
          provider: managedAuthProvider.providerName,
          googleEnabled: managedAuthProvider.googleEnabled,
        });
      }
      if (!req.session.accountId) {
        req.session.accountId = accountId;
      }
      res.json({
        authenticated: true,
        provider: managedAuthProvider.providerName,
        googleEnabled: managedAuthProvider.googleEnabled,
        profile: await buildManagedAuthProfile(storage, accountId),
      });
    } catch (err) {
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/auth/register", requireAuth, async (req, res) => {
    try {
      const body = z.object({
        email: z.string().email(),
        password: z.string().min(10),
        deviceName: z.string().max(120).optional(),
        platform: z.string().max(32).optional(),
      }).parse(req.body);
      const { deviceId, deviceUser } = await getCurrentDeviceUser(req);
      const result = await registerManagedAccount(storage, managedAuthProvider, {
        email: body.email,
        password: body.password,
        deviceId,
        deviceUserId: deviceUser.id,
        deviceName: body.deviceName ?? deviceUser.deviceName ?? null,
        platform: body.platform ?? null,
      });
      req.session.accountId = result.account.id;
      req.session.userId = result.profile.workspaceUserId;
      req.session.deviceId = deviceId;
      res.status(201).json({
        authenticated: true,
        profile: result.profile,
        verification: process.env.NODE_ENV === "production" ? { expiresAt: result.verification.expiresAt.toISOString() } : {
          token: result.verification.token,
          expiresAt: result.verification.expiresAt.toISOString(),
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", requireAuth, async (req, res) => {
    try {
      const body = z.object({
        email: z.string().email(),
        password: z.string().min(1),
        deviceName: z.string().max(120).optional(),
        platform: z.string().max(32).optional(),
      }).parse(req.body);
      const { deviceId, deviceUser } = await getCurrentDeviceUser(req);
      const result = await loginManagedAccount(storage, managedAuthProvider, {
        email: body.email,
        password: body.password,
        deviceId,
        deviceUserId: deviceUser.id,
        deviceName: body.deviceName ?? deviceUser.deviceName ?? null,
        platform: body.platform ?? null,
      });
      req.session.accountId = result.account.id;
      req.session.userId = result.workspaceUserId;
      req.session.deviceId = deviceId;
      res.json({ authenticated: true, profile: result.profile });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    req.session.accountId = undefined;
    res.json({ success: true });
  });

  app.post("/api/auth/recovery/request", async (req, res) => {
    try {
      const body = z.object({ email: z.string().email() }).parse(req.body);
      const result = await requestPasswordRecovery(storage, managedAuthProvider, body.email);
      res.json(process.env.NODE_ENV === "production" ? { requested: true } : {
        requested: true,
        token: result.token,
        expiresAt: result.expiresAt?.toISOString() ?? null,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/auth/recovery/confirm", async (req, res) => {
    try {
      const body = z.object({
        token: z.string().min(10),
        newPassword: z.string().min(10),
      }).parse(req.body);
      const profile = await resetPasswordWithToken(storage, managedAuthProvider, body.token, body.newPassword);
      res.json({ success: true, profile });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const body = z.object({ token: z.string().min(10) }).parse(req.body);
      const profile = await verifyAccountEmail(storage, managedAuthProvider, body.token);
      res.json({ success: true, profile });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.get("/api/auth/devices", requireAuth, async (req, res) => {
    try {
      const accountId = req.session.accountId;
      if (!accountId) {
        return res.status(401).json({ message: "Managed account session required", code: "ACCOUNT_SESSION_REQUIRED" });
      }
      res.json(await buildManagedAuthProfile(storage, accountId));
    } catch (err) {
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/auth/devices/revoke", requireAuth, async (req, res) => {
    try {
      const accountId = req.session.accountId;
      if (!accountId) {
        return res.status(401).json({ message: "Managed account session required", code: "ACCOUNT_SESSION_REQUIRED" });
      }
      const body = z.object({ deviceId: z.string().min(8) }).parse(req.body);
      const currentDeviceId = getDeviceId(req);
      if (currentDeviceId === body.deviceId) {
        return res.status(400).json({ message: "Use logout on this device instead of self-revocation.", code: "CANNOT_REVOKE_CURRENT_DEVICE" });
      }
      res.json(await revokeManagedDevice(storage, accountId, body.deviceId));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof ManagedAuthError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  // === COMMERCIAL ENTITLEMENTS AND BILLING ===
  app.get("/api/billing/catalog", requireAuth, async (_req, res) => {
    res.json({
      provider: "test-provider",
      pricingVersion: "2026-07-locked-commercial-model",
      products: Object.values(BILLING_CATALOG),
    });
  });

  app.get("/api/billing/subscription", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    res.json({
      subscription: await getBillingSubscriptionState(storage, userId),
      entitlement: await getEntitlementState(storage, userId),
      audit: await listBillingAuditEntries(storage, userId),
    });
  });

  app.post("/api/billing/checkout-session", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const body = z.object({
        productCode: z.enum(["premium_monthly", "premium_annual", "addon_pdf_250"]),
        returnUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      }).parse(req.body);
      const session = await createCheckoutSession(storage, userId, body.productCode, {
        returnUrl: body.returnUrl,
        cancelUrl: body.cancelUrl,
      });
      res.status(201).json(session);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/billing/portal-session", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    res.status(201).json(await createBillingPortalSession(storage, userId));
  });

  app.post("/api/billing/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      res.json(await cancelBillingSubscription(storage, userId, {
        atPeriodEnd: req.body?.atPeriodEnd !== false,
      }));
    } catch (err) {
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  if (billingTestRoutesEnabled) {
    app.post("/api/billing/test/checkout/:sessionId/complete", requireAuth, async (req, res) => {
      try {
        res.json(await completeTestCheckoutSession(storage, String(req.params.sessionId)));
      } catch (err) {
        if (err instanceof EntitlementDeniedError) {
          return res.status(err.status).json({ message: err.message, code: err.code });
        }
        throw err;
      }
    });

    app.post("/api/billing/test/simulate", requireAuth, async (req, res) => {
      try {
        const userId = getUserId(req);
        const body = z.object({
          eventType: z.enum([
            "subscription.created",
            "subscription.renewed",
            "subscription.cancelled",
            "subscription.grace_period",
            "subscription.payment_failed",
            "subscription.refunded",
            "subscription.reversed",
            "subscription.expired",
          ]),
        }).parse(req.body);
        res.json(await simulateBillingProviderEvent(storage, userId, { eventType: body.eventType }));
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
        }
        if (err instanceof EntitlementDeniedError) {
          return res.status(err.status).json({ message: err.message, code: err.code });
        }
        throw err;
      }
    });
  }

  app.get("/api/entitlements/me", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const entitlement = await getEntitlementState(storage, userId);
    const animals = await storage.getAnimals(userId, {});
    const downgradeProjection = projectDowngradedAnimalVisibility(animals);
    res.json({
      entitlement,
      downgradeProjection: {
        visibleAnimalIds: downgradeProjection.visible.map((animal) => animal.id),
        hiddenAnimalIds: downgradeProjection.hidden.map((animal) => animal.id),
        rule: downgradeProjection.rule,
      },
    });
  });

  app.post("/api/billing/webhook/:provider", async (req, res) => {
    try {
      const rawBody = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : typeof req.rawBody === "string"
          ? Buffer.from(req.rawBody, "utf8")
          : null;
      const provider = String(req.params.provider || "");
      const signature = req.header("X-BreedLog-Signature");
      const secret = process.env.BILLING_WEBHOOK_SECRET;
      if (!rawBody) {
        return res.status(400).json({ message: "Missing raw billing webhook body" });
      }
      if (!verifyBillingSignature(rawBody, signature, secret)) {
        return res.status(401).json({ message: "Invalid billing webhook signature" });
      }
      const event = billingEventSchema.parse({ ...req.body, provider });
      const result = await applyBillingEvent(storage, event);
      res.status(result.idempotent ? 200 : 202).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  // === ANIMALS ===
  // All animal routes now require authentication and filter by userId
  app.get(api.animals.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const filters = req.query as { search?: string; status?: string; sex?: string };
    const visibility = await getDowngradeVisibilityContext(userId);
    const animals = filterRowsForVisibleAnimals(
      visibility,
      await storage.getAnimals(userId, filters),
      [(animal) => animal.id],
    );
    res.json(animals);
  });

  app.get(api.animals.get.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const visibility = await getDowngradeVisibilityContext(userId);
    const animalId = Number(req.params.id);
    if (!isAnimalVisible(visibility, animalId)) {
      return hiddenAnimalNotFound(res);
    }
    const animal = await storage.getAnimal(userId, animalId);
    if (!animal) {
      return res.status(404).json({ message: "Animal not found" });
    }

    const dam = animal.damId && isAnimalVisible(visibility, animal.damId) ? await storage.getAnimal(userId, animal.damId) : null;
    const sire = animal.sireId && isAnimalVisible(visibility, animal.sireId) ? await storage.getAnimal(userId, animal.sireId) : null;

    const allAnimals = filterRowsForVisibleAnimals(
      visibility,
      await storage.getAnimals(userId, {}),
      [(candidate) => candidate.id],
    );
    const offspringAsDam = animal.sex === "ewe" ? allAnimals.filter(a => a.damId === animal.id) : [];
    const offspringAsSire = animal.sex === "ram" ? allAnimals.filter(a => a.sireId === animal.id) : [];

    res.json({ ...animal, dam, sire, offspringAsDam, offspringAsSire });
  });

  app.get(api.animals.familyTree.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const animalId = Number(req.params.id);
    const visibility = await getDowngradeVisibilityContext(userId);
    if (!isAnimalVisible(visibility, animalId)) {
      return hiddenAnimalNotFound(res);
    }
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
      if (!current || !isAnimalVisible(visibility, current.id)) return;

      nodes.push(current);

      if (current.damId && isAnimalVisible(visibility, current.damId)) {
        links.push({ source: current.damId, target: currentId, type: "dam" });
        await traverse(current.damId, depth + 1);
      }
      if (current.sireId && isAnimalVisible(visibility, current.sireId)) {
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
      const idempotencyKey = req.header("X-Idempotency-Key")?.trim();
      if (idempotencyKey) {
        const existing = await storage.getAnimalByClientId(userId, idempotencyKey);
        if (existing) {
          return res.status(200).json(existing);
        }
      }
      const input = api.animals.create.input.parse(req.body);
      const createInput = idempotencyKey ? { ...input, clientId: idempotencyKey } : input;
      await assertCanCreateAnimal(storage, userId);
      const animal = await storage.createAnimal(userId, createInput);
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
      if (err instanceof DuplicateTagIdError) {
        return res.status(400).json({
          message: err.message,
          field: "tagId",
        });
      }
      if (err instanceof DuplicateAnimalNameError) {
        return res.status(400).json({
          message: err.message,
          field: "name",
        });
      }
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({
          message: err.message,
          code: err.code,
        });
      }
      if (req.header("X-Idempotency-Key")) {
        const existing = await storage.getAnimalByClientId(getUserId(req), req.header("X-Idempotency-Key")!.trim());
        if (existing) {
          return res.status(200).json(existing);
        }
      }
      throw err;
    }
  });

  app.put(api.animals.update.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const visibility = await getDowngradeVisibilityContext(userId);
      const animalId = Number(req.params.id);
      if (!isAnimalVisible(visibility, animalId)) {
        return hiddenAnimalNotFound(res);
      }
      const input = api.animals.update.input.parse(req.body);
      const existing = await storage.getAnimal(userId, animalId);
      if (!existing) {
        return res.status(404).json({ message: "Animal not found" });
      }
      const nextStatus = input.status ?? existing.status ?? "active";
      const wasActive = (existing.status ?? "active") === "active";
      if (!wasActive && nextStatus === "active") {
        await assertCanCreateAnimal(storage, userId);
      }
      const animal = await storage.updateAnimal(userId, animalId, input);
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
      if (err instanceof DuplicateTagIdError) {
        return res.status(400).json({
          message: err.message,
          field: "tagId",
        });
      }
      if (err instanceof DuplicateAnimalNameError) {
        return res.status(400).json({
          message: err.message,
          field: "name",
        });
      }
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({
          message: err.message,
          code: err.code,
        });
      }
      throw err;
    }
  });

  app.delete(api.animals.delete.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const visibility = await getDowngradeVisibilityContext(userId);
    const animalId = Number(req.params.id);
    if (!isAnimalVisible(visibility, animalId)) {
      return hiddenAnimalNotFound(res);
    }
    await storage.deleteAnimal(userId, animalId);
    res.status(204).send();
  });

  // === ANIMAL IMAGES ===
  app.get("/api/animals/:id/images", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const animalId = Number(req.params.id);
    const visibility = await getDowngradeVisibilityContext(userId);
    if (!isAnimalVisible(visibility, animalId)) {
      return hiddenAnimalNotFound(res);
    }
    const images = await storage.getAnimalImages(userId, animalId);
    res.json(images);
  });

  app.post("/api/animals/:id/images", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const animalId = Number(req.params.id);
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, animalId)) {
        return hiddenAnimalNotFound(res);
      }
      const { ramType, ramBreedingStatus } = req.body;
      
      if (!['breeding_ram', 'stud_ram', 'commercial_ram'].includes(ramType)) {
        return res.status(400).json({ message: "Invalid ramType. Must be: breeding_ram, stud_ram, or commercial_ram" });
      }

      const validBreedingStatuses = ['breeding_ram', 'marketable_ram', 'not_selected', 'unknown'];
      if (ramBreedingStatus && !validBreedingStatuses.includes(ramBreedingStatus)) {
        return res.status(400).json({ message: "Invalid ramBreedingStatus" });
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
        ramType,
        ...(ramBreedingStatus ? { ramBreedingStatus } : {})
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
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
    const visibility = await getDowngradeVisibilityContext(userId);
    const animals = filterRowsForVisibleAnimals(
      visibility,
      await storage.getAnimals(userId, { status: 'culled' }),
      [(animal) => animal.id],
    );
    res.json(animals);
  });

  // === BREEDING ===
  app.get(api.breeding.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const visibility = await getDowngradeVisibilityContext(userId);
    const events = filterRowsForVisibleAnimals(
      visibility,
      await storage.getBreedingEvents(userId),
      [(event) => event.eweId, (event) => event.ramId],
    );
    res.json(events);
  });

  app.post(api.breeding.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.breeding.create.input.parse(req.body);
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, input.eweId) || !isAnimalVisible(visibility, input.ramId)) {
        return hiddenAnimalNotFound(res);
      }
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
    const visibility = await getDowngradeVisibilityContext(userId);
    const groups = (await storage.getMatingGroups(userId)).filter((group) => {
      if (!visibility) return true;
      return isAnimalVisible(visibility, group.ramId)
        && (group.eweIds ?? []).every((animalId) => isAnimalVisible(visibility, animalId));
    });
    res.json(groups);
  });
  
  app.post(api.breeding.groups.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.breeding.groups.create.input.parse(req.body);
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, input.ramId) || (input.eweIds ?? []).some((id) => !isAnimalVisible(visibility, id))) {
        return hiddenAnimalNotFound(res);
      }
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
      const visibility = await getDowngradeVisibilityContext(userId);
      const existing = (await storage.getMatingGroups(userId)).find((group) => group.id === id);
      if (!existing) {
        return res.status(404).json({ message: "Mating group not found" });
      }
      if (!isAnimalVisible(visibility, existing.ramId) || (existing.eweIds ?? []).some((animalId) => !isAnimalVisible(visibility, animalId))) {
        return hiddenAnimalNotFound(res);
      }
      if ((req.body?.ramId != null && !isAnimalVisible(visibility, req.body.ramId))
        || (Array.isArray(req.body?.eweIds) && req.body.eweIds.some((animalId: number) => !isAnimalVisible(visibility, animalId)))) {
        return hiddenAnimalNotFound(res);
      }
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
      const visibility = await getDowngradeVisibilityContext(userId);
      const existing = (await storage.getMatingGroups(userId)).find((group) => group.id === id);
      if (!existing) {
        return res.status(404).json({ message: "Mating group not found" });
      }
      if (!isAnimalVisible(visibility, existing.ramId) || (existing.eweIds ?? []).some((animalId) => !isAnimalVisible(visibility, animalId))) {
        return hiddenAnimalNotFound(res);
      }
      await storage.deleteMatingGroup(userId, id);
      res.status(204).send();
    } catch (err) {
      throw err;
    }
  });

  // === RECORDS ===
  app.get(api.records.performance.list.path, requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const visibility = await getDowngradeVisibilityContext(userId);
    const animalId = Number(req.params.id);
    if (!isAnimalVisible(visibility, animalId)) {
      return hiddenAnimalNotFound(res);
    }
    const records = await storage.getPerformanceRecords(userId, animalId);
    res.json(records);
  });

  app.get('/api/performance-records', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const visibility = await getDowngradeVisibilityContext(userId);
    const records = filterRowsForVisibleAnimals(visibility, await storage.getAllPerformanceRecords(userId), [
      (record) => record.animalId,
    ]);
    res.json(records);
  });
  
  app.post(api.records.performance.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.records.performance.create.input.parse(req.body);
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, input.animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
    const visibility = await getDowngradeVisibilityContext(userId);
    const animalId = Number(req.params.id);
    if (!isAnimalVisible(visibility, animalId)) {
      return hiddenAnimalNotFound(res);
    }
    const records = await storage.getHealthRecords(userId, animalId);
    res.json(records);
  });

  app.get('/api/health-records', requireAuth, async (req, res) => {
    const userId = getUserId(req);
    const visibility = await getDowngradeVisibilityContext(userId);
    const records = filterRowsForVisibleAnimals(visibility, await storage.getAllHealthRecords(userId), [
      (record) => record.animalId,
    ]);
    res.json(records);
  });

  app.post(api.records.health.create.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.records.health.create.input.parse(req.body);
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, input.animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
      const visibility = await getDowngradeVisibilityContext(userId);
      const animals = filterRowsForVisibleAnimals(visibility, await storage.getAnimals(userId), [
        (animal) => animal.id,
      ]);
      const farmSettings = await storage.getFarmSettings(userId);
      const csvRows = buildBreedLogCsvRows(animals, farmSettings?.studPrefix || null);
      const csvData = buildBreedLogCsvContent(csvRows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="breedlog-herd-export.csv"');
      res.send(csvData);
    } catch (err) {
      console.error("Export Error:", err);
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.get('/api/import/template/csv', requireAuth, async (_req, res) => {
    try {
      const csvTemplate = buildBreedLogImportTemplateCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="breedlog-import-template.csv"');
      res.send(csvTemplate);
    } catch (err) {
      console.error('CSV template export failed:', err);
      res.status(500).json({ message: 'Failed to create import template' });
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

      // Per-row error handling: one bad row (e.g. duplicate tag) must not
      // 500 the whole request after earlier rows were already committed.
      let count = 0;
      let duplicates = 0;
      const errors: string[] = [];
      if (table === 'animals') {
        for (const record of records) {
          const tagId = record.tagId || record.tag_id;
          if (!tagId) {
            errors.push('Row skipped: missing tagId');
            continue;
          }
          try {
            const status = record.status || "active";
            if (status === "active") {
              await assertCanCreateAnimal(storage, userId);
            }
            await storage.createAnimal(userId, {
              tagId,
              sex: record.sex || 'ewe',
              breed: record.breed || "Meatmaster",
              status,
            });
            count++;
          } catch (rowErr) {
            if (
              rowErr instanceof DuplicateElectronicIdError ||
              rowErr instanceof DuplicateTagIdError ||
              rowErr instanceof DuplicateAnimalNameError
            ) {
              duplicates++;
            } else {
              errors.push(`Create failed for ${tagId}: ${rowErr instanceof Error ? rowErr.message : 'unknown error'}`);
            }
          }
        }
      }

      res.json({ count, duplicates, failed: errors.length, errors });
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
    const visibility = await getDowngradeVisibilityContext(userId);
    const docs = filterRowsForVisibleAnimals(visibility, await storage.getDocuments(userId), [
      (doc) => doc.animalId,
    ]);
    res.json(docs);
  });

  app.post(api.documents.upload.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const data = api.documents.upload.input.parse(req.body);
      const visibility = await getDowngradeVisibilityContext(userId);
      if (!isAnimalVisible(visibility, data.animalId)) {
        return hiddenAnimalNotFound(res);
      }
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
        trim: true,
      }) as Record<string, string>[];

      const existingAnimals = await storage.getAnimals(userId);
      const farmSettings = await storage.getFarmSettings(userId);
      const parsed = parseBreedLogCsvRecords(records, existingAnimals, farmSettings?.studPrefix || null);

      let created = 0;
      let duplicates = parsed.duplicates;
      const errors = [...parsed.validationErrors];

      for (const animal of parsed.rowsToCreate) {
        try {
          await assertCanCreateAnimal(storage, userId);
          await storage.createAnimal(userId, animal);
          created += 1;
        } catch (err) {
          if (err instanceof DuplicateElectronicIdError || err instanceof DuplicateTagIdError || err instanceof DuplicateAnimalNameError) {
            duplicates += 1;
          } else if (err instanceof EntitlementDeniedError) {
            errors.push(`Create failed for ${animal.tagId}: ${err.message}`);
          } else {
            errors.push(`Create failed for ${animal.tagId}: ${err instanceof Error ? err.message : 'unknown error'}`);
          }
        }
      }

      res.json({
        imported: created,
        created,
        updated: 0,
        skipped: parsed.skipped,
        duplicate: duplicates,
        failed: errors.length,
        validationErrors: errors,
        errors,
      });
    } catch (err: any) {
      console.error("CSV Import error:", err);
      res.status(500).json({ message: err.message || "Failed to import CSV" });
    }
  });

  app.post(api.eid.scan.path, requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const input = api.eid.scan.input.parse(req.body);
      const electronicIdRaw = input.electronicIdRaw.trim();
      const visibility = await getDowngradeVisibilityContext(userId);

      if (!electronicIdRaw) {
        return res.status(400).json({ message: "electronicIdRaw is required", field: "electronicIdRaw" });
      }

      const animal = await storage.getAnimalByElectronicId(userId, electronicIdRaw);
      const visibleMatch = animal && isAnimalVisible(visibility, animal.id) ? animal : null;
      const scanEvent = await storage.createEidScanEvent(userId, {
        animalId: visibleMatch?.id ?? null,
        electronicIdRaw,
        readerSource: input.readerSource ?? null,
        readerSessionId: input.readerSessionId ?? null,
        scannedAt: new Date(),
        matched: !!visibleMatch,
        matchMethod: visibleMatch ? "electronicId" : null,
        payload: input.payload ?? null,
      });

      return res.json({
        matched: !!visibleMatch,
        animal: visibleMatch,
        scanEvent,
        status: visibleMatch ? "matched" : "unassigned",
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
      const visibility = await getDowngradeVisibilityContext(userId);
      const subfolder = req.query.subfolder as string | undefined;
      const docs = filterRowsForVisibleAnimals(visibility, await storage.getExportedDocuments(userId, subfolder), [
        (doc) => doc.animalId,
      ]);
      res.json(docs);
    } catch (err: any) {
      console.error("Get exported docs error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/exported-documents", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const visibility = await getDowngradeVisibilityContext(userId);
      const { name, documentType, subfolder, animalId, metadata } = req.body;
      if (!name || !documentType || !subfolder) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!isAnimalVisible(visibility, animalId ?? null)) {
        return hiddenAnimalNotFound(res);
      }
      const quotaClass = inferExportQuotaClass(documentType, subfolder, animalId, metadata ?? null);
      if (quotaClass === "individual_pdf") {
        await reserveUsage(storage, userId, "individualPdfExports");
      } else if (quotaClass === "batch_pdf") {
        await reserveUsage(storage, userId, "batchPdfExports");
      }
      const doc = await storage.createExportedDocument(userId, {
        name,
        documentType,
        subfolder,
        animalId: animalId || null,
        metadata: metadata ?? null,
      });
      res.status(201).json(doc);
    } catch (err: any) {
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
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

  // === ENCRYPTED BREEDLOG BACKUPS ===
  app.post("/api/backups/manual", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const backup = await createWorkspaceBackup(storage, userId, {
        manual: true,
        passphrase: req.body?.passphrase,
      });
      res.status(201).json({
        fileName: `breedlog-${userId.slice(0, 8)}-${backup.exportedAt.slice(0, 10)}.breedlogbackup`,
        backup,
      });
    } catch (err: any) {
      if (err instanceof EntitlementDeniedError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      if (err instanceof BackupRejectedError) {
        return res.status(400).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/backups/preview-restore", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const preview = previewWorkspaceBackup(req.body?.backup as EncryptedBreedLogBackup, userId, req.body?.passphrase);
      res.json(preview);
    } catch (err: any) {
      if (err instanceof BackupRejectedError) {
        return res.status(400).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/backups/restore", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const result = await restoreWorkspaceBackup(storage, userId, req.body?.backup as EncryptedBreedLogBackup, {
        passphrase: req.body?.passphrase,
        confirmOverwrite: req.body?.confirmOverwrite === true,
      });
      res.json(result);
    } catch (err: any) {
      if (err instanceof BackupRejectedError) {
        return res.status(400).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.get("/api/backups/automatic/status", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    res.json(await getAutomaticBackupStatus(storage, userId));
  });

  app.post("/api/backups/automatic/run", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const result = await runAutomaticBackupForWorkspace(storage, backupStorageAdapter, userId, {
        now: req.body?.now ? new Date(req.body.now) : undefined,
        force: req.body?.force === true,
        passphrase: req.body?.passphrase,
      });
      res.status(result.status === "skipped" ? 200 : 201).json(result);
    } catch (err: any) {
      if (err instanceof BackupRejectedError) {
        return res.status(400).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/admin/backups/automatic/run", requireAdminPin, async (req, res) => {
    const requestedWorkspace = typeof req.body?.workspaceUserId === "string" ? req.body.workspaceUserId : undefined;
    const results = requestedWorkspace
      ? [await runAutomaticBackupForWorkspace(storage, backupStorageAdapter, requestedWorkspace, {
          now: req.body?.now ? new Date(req.body.now) : undefined,
          force: req.body?.force === true,
          passphrase: req.body?.passphrase,
        })]
      : await runAutomaticBackupSweep(storage, backupStorageAdapter, {
          now: req.body?.now ? new Date(req.body.now) : undefined,
        });
    res.json({ results });
  });

  // === ACCOUNT DELETION AND RECOVERY WINDOW ===
  app.get("/api/account/deletion", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    res.json(await getAccountDeletionState(storage, userId));
  });

  app.post("/api/account/deletion", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const result = await requestAccountDeletion(storage, userId, {
        typedConfirmation: req.body?.typedConfirmation,
        exportBeforeDeletion: req.body?.exportBeforeDeletion === true,
        passphrase: req.body?.passphrase,
      });
      res.status(202).json(result);
    } catch (err) {
      if (err instanceof AccountDeletionError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/account/deletion/cancel", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      res.json(await cancelAccountDeletion(storage, userId));
    } catch (err) {
      if (err instanceof AccountDeletionError) {
        return res.status(err.status).json({ message: err.message, code: err.code });
      }
      throw err;
    }
  });

  app.post("/api/admin/account-deletion/process", requireAdminPin, async (req, res) => {
    res.json({
      results: await processExpiredAccountDeletionQueue(
        storage,
        req.body?.now ? new Date(req.body.now) : new Date(),
      ),
    });
  });

  // === FIELD TEST ISSUE REPORTS ===
  app.post("/api/field-issues", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { title, description, area, severity, deviceType, appMode, contactName, currentRoute, appVersion } = req.body;
      if (!title || !description || !area) {
        return res.status(400).json({ message: "title, description, and area are required" });
      }
      // Get safe invite code reference (not the secret code itself, just a display identifier)
      let inviteCodeRef: string | undefined;
      try {
        const activation = await storage.getUserActivation(userId);
        if (activation) {
          inviteCodeRef = `code:${activation.inviteCodeId}`;
        }
      } catch {}

      const issue = await storage.createFieldIssue({
        userId,
        inviteCodeRef,
        title: String(title).slice(0, 120),
        description: String(description).slice(0, 2000),
        area: String(area).slice(0, 64),
        severity: ["low", "medium", "high", "blocking"].includes(severity) ? severity : "medium",
        deviceType: deviceType ? String(deviceType).slice(0, 20) : undefined,
        appMode: appMode ? String(appMode).slice(0, 20) : undefined,
        contactName: contactName ? String(contactName).slice(0, 80) : undefined,
        currentRoute: currentRoute ? String(currentRoute).slice(0, 200) : undefined,
        appVersion: appVersion ? String(appVersion).slice(0, 100) : undefined,
      });

      // Send email notification (non-blocking)
      import("./email").then(({ sendIssueNotification }) => {
        sendIssueNotification(issue).then((sent) => {
          if (sent) {
            storage.updateFieldIssue(issue.id, { emailSent: true }).catch(() => {});
          }
        }).catch(() => {});
      }).catch(() => {});

      res.status(201).json(issue);
    } catch (err: any) {
      console.error("Create field issue error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: list all issues (admin auth required)
  app.get("/api/admin/field-issues", async (req, res) => {
    try {
      if (!isAdminPinHeaderValid(req.headers.authorization)) {
        return res.status(401).json({ message: "Admin authentication required" });
      }
      const { status, severity, area, search } = req.query as Record<string, string>;
      const issues = await storage.getFieldIssues({ status, severity, area, search });
      res.json(issues);
    } catch (err: any) {
      console.error("Get field issues error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: update issue status/notes
  app.patch("/api/admin/field-issues/:id", async (req, res) => {
    try {
      if (!isAdminPinHeaderValid(req.headers.authorization)) {
        return res.status(401).json({ message: "Admin authentication required" });
      }
      const id = Number(req.params.id);
      const { status, adminNotes } = req.body;
      const validStatuses = ["new", "reviewing", "in_progress", "fixed", "closed"];
      const updates: { status?: string; adminNotes?: string } = {};
      if (status && validStatuses.includes(status)) updates.status = status;
      if (adminNotes !== undefined) updates.adminNotes = String(adminNotes).slice(0, 2000);
      const updated = await storage.updateFieldIssue(id, updates);
      if (!updated) return res.status(404).json({ message: "Issue not found" });
      res.json(updated);
    } catch (err: any) {
      console.error("Update field issue error:", err);
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
      const { confirmPhrase, backupBeforeReset, passphrase } = req.body;
      
      if (confirmPhrase !== "RESET BREEDLOG") {
        return res.status(400).json({ message: "Invalid confirmation phrase" });
      }
      const backup = backupBeforeReset
        ? await createWorkspaceBackup(storage, userId, { manual: false, passphrase })
        : null;
      await storage.clearAllData(userId);
      res.json({ message: "All data cleared successfully", backup });
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
  
  // NOTE: a local getDeviceId() helper used to live here, hashing
  // User-Agent + Accept-Language. It shadowed the real getDeviceId import
  // from ./device-auth, so telemetry recorded a browser fingerprint instead
  // of the actual device ID. It has been removed — the imported helper is
  // the single source of device identity.

  // Returns the code's own usability — independent of how many slots are taken.
  // A code is usable if it exists, is not revoked, and is not expired.
  // Slot availability (desktop/mobile) is computed separately at the call site.
  // NOTE: usesCount is intentionally NOT consulted here. The real source of truth
  // for slot availability is the count of active rows in user_activations for the
  // requested deviceType. Old codes with maxUses=1 must still allow the second
  // (different-deviceType) slot.
  // Code status / block-reason helpers come from the shared invite-activation
  // service so admin lookup and activation always read from the same source of truth.
  const {
    getCodeStatus,
    getCodeBlockReason,
    evaluateActivation,
    summarizeSlot,
  } = await import('./invite-activation');
  
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
        // needsCode: true — the device can re-enter its invite code to restore access.
        // Returning false here was the root cause of the "Access revoked or expired"
        // pre-entry error: the frontend showed the reason text even before the user
        // typed anything, making it look like a permanent block.
        return res.json({ 
          hasAccess: false, 
          reason: 'Re-enter your invite code to restore access.',
          needsCode: true 
        });
      }
      
      // Get linked invite code to check its status
      const codes = await storage.getInviteCodes();
      const code = codes.find(c => c.id === activation.inviteCodeId);
      
      if (code && (code.status === 'revoked' || new Date(code.expiresAt) < new Date())) {
        // NOTE: Do NOT silently revoke the activation row here. Doing so creates an
        // infinite revoke→validate-upsert→revoke loop: validate upserts the activation
        // back to 'active' on the next call, then this check immediately re-revokes it.
        // Activation-row status is managed only by explicit admin revoke/reactivate actions.
        return res.json({ 
          hasAccess: false, 
          reason: 'Re-enter your invite code to restore access.',
          needsCode: true 
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
      
      // STEP 1: Look up code and check basic eligibility via the shared
      // invite-activation service (same one the admin diagnostic uses).
      const inviteCode = await storage.getInviteCodeByCode(codeUpper);
      
      if (!inviteCode) {
        console.log(`[Beta Validate] Code not found in DB: "${codeUpper}"`);
        return res.status(400).json({ message: 'Code not found. Please check and try again.', reasonCode: 'CODE_NOT_FOUND' });
      }
      const codeLevelStatus = getCodeStatus(inviteCode);
      if (codeLevelStatus === 'revoked') {
        return res.status(400).json({ message: 'This code has been revoked.', reasonCode: 'CODE_REVOKED' });
      }
      if (codeLevelStatus === 'expired') {
        return res.status(400).json({ message: 'This code has expired.', reasonCode: 'CODE_EXPIRED' });
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
        // SAME CODE re-login: heal sharedUserId if needed and return existing workspace.
        // DIFFERENT CODE: fall through to workspace-switch path below (do NOT silently
        // return the old workspace — that was the workspace-switching bug).
        if (existingActivation.inviteCodeId === inviteCode!.id) {
          // HEALING: If sharedUserId is missing, check if another device used the same code earlier
          // and set sharedUserId so this device resolves to the shared workspace.
          if (!user.sharedUserId) {
            const allActivations = await storage.getAllActiveActivations();
            const codeActivations = allActivations.filter(a => a.inviteCodeId === existingActivation.inviteCodeId && a.status === 'active');
            const otherActivation = codeActivations.find(a => a.deviceId !== deviceId);
            if (otherActivation) {
              // Find the other device's user to get their effective workspace ID
              const otherUser = await storage.getUserByDeviceId(otherActivation.deviceId);
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
          await seedMasterSimulationIfNeeded(effectiveUserId, inviteCode!.code);
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

        // === WORKSPACE SWITCH PATH ===
        // Device already had an active activation under a DIFFERENT invite code.
        // Validate the new code's slot for this device type, then switch the
        // device/session to the new code's workspace. The unique constraint on
        // user_activations.userId means we UPDATE the existing row in-place
        // rather than create a new one.
        const switchUserAgent = req.headers['user-agent'] || '';
        const switchDeviceType = detectDeviceType(switchUserAgent);
        console.log(`[Beta Validate] Workspace switch attempt: device ${deviceId} (${switchDeviceType}) from code ${existingActivation.inviteCodeId} to ${inviteCode!.id}`);

        const switchAllActivations = await storage.getAllActiveActivations();
        const switchNewCodeActivations = switchAllActivations.filter(a => a.inviteCodeId === inviteCode!.id && a.status === 'active');
        // Exclude this device's existing activation (still pointing at old code, will be overwritten)
        const switchOtherActivations = switchNewCodeActivations.filter(a => a.deviceId !== deviceId);
        const switchDesktopTaken = switchOtherActivations.filter(a => a.deviceType === 'desktop').length;
        const switchMobileTaken = switchOtherActivations.filter(a => a.deviceType === 'mobile').length;

        if (switchDeviceType === 'desktop' && switchDesktopTaken >= 1) {
          return res.status(400).json({
            message: 'The desktop slot for this code is already taken. One desktop and one mobile device are allowed per code. Contact the admin to reset your desktop slot.'
          });
        }
        if (switchDeviceType === 'mobile' && switchMobileTaken >= 1) {
          return res.status(400).json({
            message: 'The mobile slot for this code is already taken. One desktop and one mobile device are allowed per code. Contact the admin to reset your mobile slot.'
          });
        }
        if (switchOtherActivations.length >= 2) {
          return res.status(400).json({ message: 'This code already has both device slots occupied (one desktop + one mobile). Contact the admin to reset a slot.' });
        }

        // Determine the new effective workspace userId.
        // Per-code workspace identity is persisted in system_settings under
        // `workspace:invite_code:<id>` so that switching away and back returns
        // to the same workspace data, and so a code's workspace identity does
        // not collide with any device's own user.id.
        const workspaceSettingKey = `workspace:invite_code:${inviteCode!.id}`;
        let switchEffectiveUserId: string;
        if (switchOtherActivations.length > 0) {
          const switchPrimaryActivation = switchOtherActivations[0];
          const switchPrimaryUser = await storage.getUserByDeviceId(switchPrimaryActivation.deviceId);
          switchEffectiveUserId = switchPrimaryUser
            ? (switchPrimaryUser.sharedUserId || switchPrimaryUser.id)
            : userId;
          // Backfill the persistent mapping if missing.
          const existingMapping = await storage.getSystemSetting(workspaceSettingKey);
          if (!existingMapping) {
            await storage.setSystemSetting(workspaceSettingKey, switchEffectiveUserId);
          }
        } else {
          const persisted = await storage.getSystemSetting(workspaceSettingKey);
          if (persisted) {
            switchEffectiveUserId = persisted;
            console.log(`[Beta Validate] Reusing persisted workspace ${persisted} for code ${inviteCode!.code}`);
          } else {
            const stub = await storage.createWorkspaceUser(`workspace:${inviteCode!.code}`);
            await storage.setSystemSetting(workspaceSettingKey, stub.id);
            // Re-read after write: if a concurrent request also tried to mint a
            // workspace and won the write race, defer to the persisted value so
            // both requests converge on the same workspace identity.
            const confirmed = await storage.getSystemSetting(workspaceSettingKey);
            switchEffectiveUserId = confirmed || stub.id;
            if (confirmed && confirmed !== stub.id) {
              console.log(`[Beta Validate] Race detected; deferring to persisted workspace ${confirmed} for code ${inviteCode!.code}`);
            } else {
              console.log(`[Beta Validate] Minted stub workspace ${stub.id} for code ${inviteCode!.code}`);
            }
          }
        }

        // Update existing activation row to point at the new code (preserves UNIQUE on userId).
        await storage.updateUserActivation(userId, {
          inviteCodeId: inviteCode!.id,
          deviceId,
          deviceType: switchDeviceType,
          status: 'active',
        });

        // Set or clear sharedUserId so it matches the new workspace.
        const newSharedValue = switchEffectiveUserId !== userId ? switchEffectiveUserId : null;
        if (user.sharedUserId !== newSharedValue) {
          await storage.setSharedUserId(userId, newSharedValue);
          user = { ...user, sharedUserId: newSharedValue };
        }

        // Increment new code's usesCount (this device is a new occupant on the new code).
        await storage.incrementInviteCodeUses(inviteCode!.id);

        req.session.deviceId = deviceId;
        req.session.userId = switchEffectiveUserId;
        await seedMasterSimulationIfNeeded(switchEffectiveUserId, inviteCode!.code);

        console.log(`[Beta Validate] Workspace switched: device ${deviceId} now on code ${inviteCode!.code}, workspace ${switchEffectiveUserId}`);

        return res.json({
          success: true,
          message: 'Workspace switched',
          token,
          deviceId,
          userId: switchEffectiveUserId,
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

      // Check device slot limits (1 desktop + 1 mobile per code) via shared evaluator.
      const allActivations = await storage.getAllActiveActivations();
      const codeActivations = allActivations.filter(a => a.inviteCodeId === inviteCode!.id);
      const activeForCode = codeActivations.filter(a => a.status === 'active');

      const slotDecision = evaluateActivation({
        code: inviteCode,
        activeActivationsForCode: activeForCode,
        requestedDeviceType: deviceType,
        callerDeviceId: deviceId,
      });

      if (!slotDecision.ok) {
        // Defensive consistency check: if the code itself is healthy and the
        // *only* reason we are rejecting is slot occupancy, log a context
        // line so admin/diagnostic vs activation drift is debuggable.
        if (slotDecision.reasonCode === 'DEVICE_SLOT_ALREADY_USED') {
          console.log(`[Beta Validate] Slot taken for code ${inviteCode.id} (${deviceType})`);
        }
        return res.status(400).json({ message: slotDecision.reason, reasonCode: slotDecision.reasonCode });
      }

      // Final safety: count ACTIVE slots (1 desktop + 1 mobile = max 2 devices per code).
      // Using actual active-slot count instead of usesCount avoids blocking the mobile slot
      // when desktop has already activated (which was a bug for old codes with maxUses=1).
      const activeOtherDevices = activeForCode.filter(a => a.deviceId !== deviceId).length;
      if (!isMasterSimulationCode(inviteCode!.code) && activeOtherDevices >= 2) {
        return res.status(400).json({ message: 'This code already has both device slots occupied (one desktop + one mobile). Contact the admin to reset a slot.', reasonCode: 'DEVICE_SLOT_ALREADY_USED' });
      }
      
      // STEP 2b: Workspace sharing — if another device already activated this code,
      // link this device to the same data workspace (shared_user_id = primary userId).
      // This is what makes both devices see the same animals, breeding records, etc.
      // The per-code workspace identity is also persisted in system_settings under
      // `workspace:invite_code:<id>` so that workspace switches (logout → enter different
      // code → switch back) restore the same workspace data.
      const existingCodeActivations = codeActivations.filter(a => a.status === 'active');
      const firstActivationWorkspaceKey = `workspace:invite_code:${inviteCode!.id}`;
      let effectiveUserId = userId;

      if (existingCodeActivations.length > 0) {
        // There's already an active device for this code — find their workspace ID
        const firstActivation = existingCodeActivations[0];
        const primaryUser = await storage.getUserByDeviceId(firstActivation.deviceId);
        if (primaryUser) {
          // The workspace owner is: their sharedUserId (if they're also secondary) or their own id
          const primaryUserId = primaryUser.sharedUserId || primaryUser.id;
          // Link this new device to the same workspace
          await storage.setSharedUserId(userId, primaryUserId);
          effectiveUserId = primaryUserId;
          console.log(`[Beta Validate] Linked device ${deviceId} (user ${userId}) to shared workspace ${primaryUserId}`);
        }
      } else {
        // First device activating this code. If a previous workspace identity was persisted
        // (e.g. someone activated this code before, then switched off it), reuse it so the
        // original workspace data is restored. Otherwise this device's own user.id IS the
        // workspace, and we persist that mapping for future switch-backs.
        const persistedWorkspace = await storage.getSystemSetting(firstActivationWorkspaceKey);
        if (persistedWorkspace && persistedWorkspace !== userId) {
          await storage.setSharedUserId(userId, persistedWorkspace);
          effectiveUserId = persistedWorkspace;
          console.log(`[Beta Validate] First device on code ${inviteCode!.code} reusing persisted workspace ${persistedWorkspace}`);
        }
      }
      if (!(await storage.getSystemSetting(firstActivationWorkspaceKey))) {
        await storage.setSystemSetting(firstActivationWorkspaceKey, effectiveUserId);
      }
      
      // Set session using the effective workspace userId
      req.session.deviceId = deviceId;
      req.session.userId = effectiveUserId;
      await seedMasterSimulationIfNeeded(effectiveUserId, inviteCode!.code);
      
      // STEP 3: Upsert activation (atomic — only after all checks pass).
      // CRITICAL: user_activations has UNIQUE(userId), so if this user already
      // has a row (e.g. status='revoked' after admin reset/revoke), we MUST
      // UPDATE it in-place rather than INSERT a new one. The previous code
      // always called createUserActivation here, which threw 23505 in
      // production Postgres → the catch handler returned the generic
      // "Activation failed. Please refresh and try again." that the field
      // tester reported. Admin lookup said "Active, free slot, can activate";
      // activation failed regardless. This upsert is the universal fix.
      const priorActivation = await storage.getUserActivation(userId);
      if (priorActivation) {
        // UPDATE in-place — preserves the UNIQUE(userId) constraint and sets a
        // fresh activatedAt so admin diagnostic shows the current timestamp, not
        // the original Apr-29-style date from a previous activation cycle.
        await storage.updateUserActivation(userId, {
          inviteCodeId: inviteCode!.id,
          deviceId,
          deviceType,
          status: 'active',
          activatedAt: new Date(),
        });
      } else {
        await storage.createUserActivation({
          userId,
          inviteCodeId: inviteCode!.id,
          deviceId,
          deviceType,
          status: 'active',
        });
      }
      
      // STEP 4: Increment uses count (best-effort — purely informational counter;
      // never let it block the 200 response or leave the slot claimed without a token).
      storage.incrementInviteCodeUses(inviteCode!.id).catch((e) => {
        console.warn('[Beta Validate] incrementInviteCodeUses failed (non-fatal):', e?.message);
      });
      
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
      // The previous "unique constraint → silent Already activated" fallback was
      // removed. Existing-activation handling is now done explicitly above
      // (same-code re-login + workspace-switch + revive-revoked-row paths).
      // Surface real errors with a clear reason code so the field tester /
      // admin diagnostic can correlate failures.
      const isUnique = err?.code === '23505' || /unique constraint/i.test(String(err?.message || ''));
      const reasonCode = isUnique ? 'ACTIVATION_STATE_MISMATCH' : 'UNKNOWN_ACTIVATION_ERROR';
      console.error("Beta validation error:", err, "reasonCode=", reasonCode);
      res.status(500).json({ message: 'Activation failed. Please refresh and try again.', reasonCode });
    }
  });
  
  // === VERSION ENDPOINT (for cache-busting) ===
  // Returns current app version - client checks on startup and forces reload if mismatched
  const APP_VERSION = BREEDLOG_RUNTIME_VERSION;
  app.get("/api/version", (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    res.json({ 
      version: BREEDLOG_RUNTIME_VERSION,
      buildDate: BREEDLOG_RUNTIME_BUILD_DATE,
      dataSchemaVersion: BREEDLOG_DATA_SCHEMA_VERSION,
      androidVersionCode: BREEDLOG_ANDROID_VERSION_CODE,
      serverTime: new Date().toISOString()
    });
  });

  app.get("/api/runtime/update-state", (req, res) => {
    const platform = String(req.query.platform || "pwa") as BreedLogRuntimePlatform;
    if (!["pwa", "windows", "android"].includes(platform)) {
      return res.status(400).json({ message: "platform must be pwa, windows, or android" });
    }
    const currentVersion = typeof req.query.currentVersion === "string" && req.query.currentVersion.trim()
      ? req.query.currentVersion.trim()
      : BREEDLOG_RUNTIME_VERSION;
    const currentDataSchemaVersion = typeof req.query.currentDataSchemaVersion === "string"
      ? Number.parseInt(req.query.currentDataSchemaVersion, 10)
      : BREEDLOG_DATA_SCHEMA_VERSION;
    const currentBuildNumber = typeof req.query.currentBuildNumber === "string"
      ? Number.parseInt(req.query.currentBuildNumber, 10)
      : undefined;
    const channel = req.query.channel === "stable" ? "stable" : "test";
    return res.json(evaluateRuntimeUpdateState({
      platform,
      currentVersion,
      currentDataSchemaVersion: Number.isFinite(currentDataSchemaVersion) ? currentDataSchemaVersion : BREEDLOG_DATA_SCHEMA_VERSION,
      currentBuildNumber: Number.isFinite(currentBuildNumber ?? Number.NaN) ? currentBuildNumber : undefined,
      channel,
    }));
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
      const activeForCode = codeActivations.filter(a => a.status === 'active');

      // Code-level status (does NOT depend on slot count or usesCount).
      const codeStatus = getCodeStatus(inviteCode);
      const blockReason = getCodeBlockReason(inviteCode);

      // Per-slot summaries computed by the SAME shared evaluator that
      // /api/beta/validate uses → admin diagnostic and activation cannot drift.
      const desktopSummary = summarizeSlot({ code: inviteCode, activeActivationsForCode: activeForCode, deviceType: 'desktop' });
      const mobileSummary = summarizeSlot({ code: inviteCode, activeActivationsForCode: activeForCode, deviceType: 'mobile' });
      const desktopSlot = activeForCode.find(a => a.deviceType === 'desktop');
      const mobileSlot = activeForCode.find(a => a.deviceType === 'mobile');

      // License activation date = earliest active activation timestamp.
      const sortedActive = [...activeForCode]
        .sort((a, b) => new Date(a.activatedAt as any).getTime() - new Date(b.activatedAt as any).getTime());
      const licenseActivatedAt = sortedActive[0]?.activatedAt ?? null;

      // Workspace identity for this code (persisted in system_settings).
      const workspaceKey = `workspace:invite_code:${inviteCode.id}`;
      const workspaceUserId = await storage.getSystemSetting(workspaceKey);
      let workspaceAnimalCount: number | null = null;
      if (workspaceUserId) {
        try {
          const animalsList = await storage.getAnimals(workspaceUserId);
          workspaceAnimalCount = animalsList.length;
        } catch {
          workspaceAnimalCount = null;
        }
      }

      const isMasterCode = isMasterSimulationCode(inviteCode.code);
      const masterSimulationBlock = isMasterCode ? {
        isMasterTestCode: true,
        label: "Master test / simulation code — multi-device allowed",
        maxDevices: MASTER_SIMULATION_MAX_DEVICES,
        activeDeviceCount: activeForCode.length,
        activeDevices: activeForCode.map(a => ({
          userId: a.userId,
          deviceId: a.deviceId,
          deviceType: a.deviceType,
          activatedAt: a.activatedAt,
        })),
        slotsRemaining: Math.max(0, MASTER_SIMULATION_MAX_DEVICES - activeForCode.length),
      } : null;

      res.json({
        found: true,
        code: inviteCode,
        codeStatus,
        blockReason,
        licenseActivatedAt,
        slots: isMasterCode ? {
          desktop: { taken: false, canActivate: true, reason: null, reasonCode: 'OK', note: 'Master test code — no per-type limit' },
          mobile: { taken: false, canActivate: true, reason: null, reasonCode: 'OK', note: 'Master test code — no per-type limit' },
        } : {
          desktop: desktopSlot
            ? { taken: true, deviceId: desktopSlot.deviceId, activatedAt: desktopSlot.activatedAt, canActivate: false, reason: 'Desktop slot already taken', reasonCode: desktopSummary.reasonCode }
            : { taken: false, canActivate: desktopSummary.canActivate, reason: desktopSummary.canActivate ? null : (desktopSummary.reason ?? blockReason), reasonCode: desktopSummary.reasonCode },
          mobile: mobileSlot
            ? { taken: true, deviceId: mobileSlot.deviceId, activatedAt: mobileSlot.activatedAt, canActivate: false, reason: 'Mobile slot already taken', reasonCode: mobileSummary.reasonCode }
            : { taken: false, canActivate: mobileSummary.canActivate, reason: mobileSummary.canActivate ? null : (mobileSummary.reason ?? blockReason), reasonCode: mobileSummary.reasonCode },
        },
        masterSimulation: masterSimulationBlock,
        workspace: {
          userId: workspaceUserId ?? null,
          animalCount: workspaceAnimalCount,
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
      // NOTE: Do NOT decrement invite_codes.usesCount here. usesCount is informational
      // and is intentionally NOT consulted by /api/beta/validate — slot availability
      // is computed live from active rows in user_activations. Mutating usesCount
      // risks resurrecting the legacy "max uses reached" gating bug if any caller
      // ever re-couples to it. Slot freeing is fully expressed by revoking the row.

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
  
  // Reactivate a revoked or expired code. Restores the invite_code status to
  // 'active' AND revives any previously-revoked activation rows for this code so
  // existing devices regain access immediately (no re-entry of invite code required).
  // This fixes the scenario where admin revoke → reactivate left devices in a
  // permanently-blocked state even though the admin panel showed the code as Active.
  // When the code's expiry is in the past it is pushed forward by `extendDays`
  // (default 30). Animals and workspace data are never touched.
  app.post("/api/admin/invite-codes/:id/reactivate", requireAdminPin, async (req, res) => {
    setNoCacheHeaders(res);
    try {
      const id = Number(req.params.id);
      const { extendDays } = (req.body ?? {}) as { extendDays?: number };
      const codes = await storage.getInviteCodes();
      const code = codes.find(c => c.id === id);
      if (!code) return res.status(404).json({ message: 'Code not found' });

      const updates: { status: string; expiresAt?: Date } = { status: 'active' };
      const days = typeof extendDays === 'number' && Number.isFinite(extendDays) && extendDays > 0
        ? Math.floor(extendDays)
        : null;
      if (days !== null) {
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + days);
        updates.expiresAt = newExpiry;
      } else if (new Date(code.expiresAt) < new Date()) {
        // Past expiry — bump by default 30 days so the reactivation is meaningful.
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 30);
        updates.expiresAt = newExpiry;
      }

      const updated = await storage.updateInviteCode(id, updates);

      // Restore any revoked activation rows for this code so existing devices
      // regain access immediately without needing to re-enter the invite code.
      // activatedAt is refreshed to now so admin diagnostic shows the correct timestamp.
      const allCodeActivations = await storage.getActivationsByCodeId(id);
      const revokedRows = allCodeActivations.filter(a => a.status === 'revoked');
      let restoredCount = 0;
      for (const row of revokedRows) {
        await storage.updateUserActivation(row.userId, {
          status: 'active',
          activatedAt: new Date(),
        });
        restoredCount++;
      }

      res.json({
        success: true,
        code: updated,
        restoredActivations: restoredCount,
        message: restoredCount > 0
          ? `Code reactivated and ${restoredCount} device activation(s) restored. Existing devices will regain access automatically on next app open.`
          : 'Code reactivated. No prior activation rows to restore — devices must enter the invite code to activate.',
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Extend the expiry of an invite code. Accepts either { days } (relative to current
  // expiry if still in the future, otherwise to now) or { expiresAt } (ISO date string).
  // Does NOT change status — use /reactivate for that. Data-safe.
  app.post("/api/admin/invite-codes/:id/extend-expiry", requireAdminPin, async (req, res) => {
    setNoCacheHeaders(res);
    try {
      const id = Number(req.params.id);
      const { days, expiresAt } = (req.body ?? {}) as { days?: number; expiresAt?: string };
      const codes = await storage.getInviteCodes();
      const code = codes.find(c => c.id === id);
      if (!code) return res.status(404).json({ message: 'Code not found' });

      let newExpiry: Date;
      if (typeof expiresAt === 'string' && expiresAt.length > 0) {
        newExpiry = new Date(expiresAt);
        if (Number.isNaN(newExpiry.getTime())) {
          return res.status(400).json({ message: 'Invalid expiresAt value' });
        }
      } else if (typeof days === 'number' && Number.isFinite(days) && days > 0) {
        const base = new Date(code.expiresAt) > new Date() ? new Date(code.expiresAt) : new Date();
        newExpiry = new Date(base);
        newExpiry.setDate(newExpiry.getDate() + Math.floor(days));
      } else {
        return res.status(400).json({ message: 'Provide { days: number } or { expiresAt: ISO string }' });
      }

      const updated = await storage.updateInviteCode(id, { expiresAt: newExpiry });
      res.json({ success: true, code: updated });
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

  // ── Activity Telemetry — authenticated user endpoints ──────────────────────

  // POST /api/activity/event — record a telemetry event
  app.post("/api/activity/event", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const deviceId = getDeviceId(req) ?? undefined;
      const { eventType, eventCategory, route, feature, metadata, occurredAt, sessionId } = req.body;
      if (!eventType || typeof eventType !== 'string') {
        return res.status(400).json({ message: 'eventType is required' });
      }
      const ev = await storage.createActivityEvent({
        userId,
        deviceId: deviceId ?? null,
        eventType,
        eventCategory: eventCategory ?? null,
        route: route ?? null,
        feature: feature ?? null,
        metadata: metadata ?? null,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      });
      // If a sessionId is included, upsert the session too
      if (sessionId && typeof sessionId === 'string') {
        await storage.upsertAppSession(sessionId, userId, deviceId);
      }
      res.json({ ok: true, id: ev.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/activity/session/heartbeat — update session heartbeat
  app.post("/api/activity/session/heartbeat", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const deviceId = getDeviceId(req) ?? undefined;
      const { sessionId } = req.body;
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      await storage.upsertAppSession(sessionId, userId, deviceId);
      const session = await storage.heartbeatAppSession(sessionId, userId);
      res.json({ ok: true, session });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Activity Telemetry — admin-only endpoints ──────────────────────────────

  // GET /api/admin/activity/summary
  app.get("/api/admin/activity/summary", requireAdminPin, async (_req, res) => {
    try {
      const summary = await storage.getAdminActivitySummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/activity/users
  app.get("/api/admin/activity/users", requireAdminPin, async (req, res) => {
    try {
      const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined;
      const filterBy = typeof req.query.filterBy === 'string' ? req.query.filterBy : undefined;
      const users = await storage.getAdminActivityUsers({ sortBy, filterBy });
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/activity/users/:userId
  app.get("/api/admin/activity/users/:userId", requireAdminPin, async (req, res) => {
    try {
      const detail = await storage.getAdminActivityUserDetail(req.params.userId);
      if (!detail) return res.status(404).json({ message: 'User not found' });
      res.json(detail);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/admin/activity/events
  app.get("/api/admin/activity/events", requireAdminPin, async (req, res) => {
    try {
      const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
      const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
      const events = await storage.getAdminActivityEvents({ userId, eventType, limit: isNaN(limit) ? 100 : limit });
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Genetics Module Routes ─────────────────────────────────────────────────

  // GET /api/genetics/bloodlines
  app.get("/api/genetics/bloodlines", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const rows = await storage.getBloodlines(userId);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/genetics/bloodlines
  app.post("/api/genetics/bloodlines", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const row = await storage.createBloodline(userId, req.body);
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PUT /api/genetics/bloodlines/:id
  app.put("/api/genetics/bloodlines/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const row = await storage.updateBloodline(userId, parseInt(req.params.id), req.body);
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/genetics/bloodlines/:id
  app.delete("/api/genetics/bloodlines/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteBloodline(userId, parseInt(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/genetics/lines
  app.get("/api/genetics/lines", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const rows = await storage.getGeneticLines(userId);
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/genetics/lines
  app.post("/api/genetics/lines", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const row = await storage.createGeneticLine(userId, req.body);
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PUT /api/genetics/lines/:id
  app.put("/api/genetics/lines/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const row = await storage.updateGeneticLine(userId, parseInt(req.params.id), req.body);
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/genetics/lines/:id
  app.delete("/api/genetics/lines/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteGeneticLine(userId, parseInt(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/genetics/animal/:animalId/bloodlines
  app.get("/api/genetics/animal/:animalId/bloodlines", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const rows = await storage.getAnimalBloodlines(userId, parseInt(req.params.animalId));
      res.json(rows);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/genetics/animal/:animalId/bloodlines
  app.post("/api/genetics/animal/:animalId/bloodlines", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const row = await storage.setAnimalBloodline(userId, { ...req.body, animalId: parseInt(req.params.animalId) });
      res.status(201).json(row);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/genetics/animal-bloodlines/:id
  app.delete("/api/genetics/animal-bloodlines/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.removeAnimalBloodline(userId, parseInt(req.params.id));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/genetics/mating-risk  { ramId, eweId }
  app.post("/api/genetics/mating-risk", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ramId, eweId } = req.body as { ramId: number; eweId: number };
      if (!ramId || !eweId) return res.status(400).json({ message: "ramId and eweId required" });
      const allAnimals = await storage.getAnimals(userId, {});
      const animalMap = new Map(allAnimals.map((a: any) => [a.id, a]));
      const ram = animalMap.get(ramId);
      const ewe = animalMap.get(eweId);
      if (!ram || !ewe) return res.status(404).json({ message: "Animal not found" });
      const result = classifyMatingRisk(ram, ewe, animalMap);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/genetics/line-performance/:bloodlineId
  app.get("/api/genetics/line-performance/:bloodlineId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const bloodlineId = parseInt(req.params.bloodlineId);
      const assignments = await storage.getAnimalBloodlines(userId, 0).catch(() => [] as any[]);
      const allAssignments: any[] = [];
      const allAnimals = await storage.getAnimals(userId, {});
      for (const animal of allAnimals) {
        const abs = await storage.getAnimalBloodlines(userId, animal.id);
        abs.forEach(ab => allAssignments.push({ ...ab, animal }));
      }
      const relevant = allAssignments.filter(ab => ab.bloodlineId === bloodlineId);
      const animals = relevant.map(ab => ab.animal);
      const activeAnimals = animals.filter((a: any) => a.status === 'active');
      const deadAnimals = animals.filter((a: any) => a.status === 'dead');
      const rams = activeAnimals.filter((a: any) => a.sex === 'ram');
      const ewes = activeAnimals.filter((a: any) => a.sex === 'ewe');
      const breedingEvts = await storage.getBreedingEvents(userId);
      const ramIds = new Set(rams.map((a: any) => a.id));
      const eweIds = new Set(ewes.map((a: any) => a.id));
      const relevantEvents = breedingEvts.filter((e: any) => ramIds.has(e.ramId) || eweIds.has(e.eweId));
      const lambsBorn = relevantEvents.reduce((s: number, e: any) => s + (e.lambCount || 0), 0);
      const allBweights = allAnimals.filter((a: any) => {
        const parentIds = new Set(animals.map((p: any) => p.id));
        return (parentIds.has(a.sireId) || parentIds.has(a.damId)) && a.birthWeight;
      }).map((a: any) => parseFloat(a.birthWeight));
      const avgBW = allBweights.length ? (allBweights.reduce((s, v) => s + v, 0) / allBweights.length).toFixed(1) : null;
      res.json({
        bloodlineId,
        activeAnimals: activeAnimals.length,
        breedingRams: rams.length,
        breedingEwes: ewes.length,
        lambsBorn,
        animalsSold: animals.filter((a: any) => a.status === 'sold').length,
        animalsCulled: animals.filter((a: any) => a.status === 'culled').length,
        animalsDead: deadAnimals.length,
        avgBirthWeight: avgBW,
        matingsRecorded: relevantEvents.length,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return httpServer;
}

// ── Mating Risk Classifier ─────────────────────────────────────────────────
function buildAncestorSet(animalId: number | null | undefined, animalMap: Map<number, any>, depth: number): Set<number> {
  if (!animalId || depth === 0) return new Set();
  const animal = animalMap.get(animalId);
  if (!animal) return new Set();
  const set = new Set<number>();
  if (animal.sireId) { set.add(animal.sireId); buildAncestorSet(animal.sireId, animalMap, depth - 1).forEach(id => set.add(id)); }
  if (animal.damId) { set.add(animal.damId); buildAncestorSet(animal.damId, animalMap, depth - 1).forEach(id => set.add(id)); }
  return set;
}

function classifyMatingRisk(ram: any, ewe: any, animalMap: Map<number, any>): { risk: string; level: string; explanation: string } {
  if (ram.id === ewe.id) return { risk: "Critical Inbreeding Risk", level: "critical", explanation: "The same animal is selected on both sides. This mating is not valid." };
  if (ram.id === ewe.sireId) return { risk: "Critical Inbreeding Risk", level: "critical", explanation: `${ewe.tagId || 'Ewe'} is a daughter of ${ram.tagId || 'Ram'}. Parent-offspring mating causes extreme inbreeding and is not recommended.` };
  if (ewe.id === ram.damId) return { risk: "Critical Inbreeding Risk", level: "critical", explanation: `${ram.tagId || 'Ram'} is a son of ${ewe.tagId || 'Ewe'}. Parent-offspring mating causes extreme inbreeding and is not recommended.` };

  const ramAncestors1 = buildAncestorSet(ram.id, animalMap, 1);
  const eweAncestors1 = buildAncestorSet(ewe.id, animalMap, 1);
  const sharedParents = [...ramAncestors1].filter(id => eweAncestors1.has(id));
  if (sharedParents.length > 0) {
    const shared = animalMap.get(sharedParents[0]);
    const sharedTag = shared?.tagId || 'Unknown';
    return { risk: "Critical Inbreeding Risk", level: "critical", explanation: `${ram.tagId} and ${ewe.tagId} share a parent (${sharedTag}). They are full or half-siblings — extreme inbreeding.` };
  }

  const ramAncestors3 = buildAncestorSet(ram.id, animalMap, 3);
  const eweAncestors3 = buildAncestorSet(ewe.id, animalMap, 3);
  const sharedClose = [...ramAncestors3].filter(id => eweAncestors3.has(id));
  if (sharedClose.length > 0) {
    const shared = animalMap.get(sharedClose[0]);
    const sharedTag = shared?.tagId || 'Unknown';
    return { risk: "High Relationship Risk", level: "high", explanation: `${ram.tagId} and ${ewe.tagId} share a recent common ancestor (${sharedTag}). This is half-sibling, grandparent-grandchild, or uncle-niece level relationship. Use with caution.` };
  }

  const ramAncestors5 = buildAncestorSet(ram.id, animalMap, 5);
  const eweAncestors5 = buildAncestorSet(ewe.id, animalMap, 5);
  const sharedDeep = [...ramAncestors5].filter(id => eweAncestors5.has(id));
  if (sharedDeep.length > 0) {
    const shared = animalMap.get(sharedDeep[0]);
    const sharedTag = shared?.tagId || 'Unknown';
    return { risk: "Managed Linebreeding", level: "managed", explanation: `${ram.tagId} and ${ewe.tagId} share a common ancestor (${sharedTag}) more than 3 generations back. This is managed linebreeding — acceptable if the shared ancestor is a desired type.` };
  }

  const hasInsufficient = !ram.sireId && !ram.damId && !ewe.sireId && !ewe.damId;
  if (hasInsufficient) return { risk: "Unknown Risk", level: "unknown", explanation: "Pedigree records are too incomplete to classify this mating safely. Record parentage data before making a decision." };

  if (ram.breed && ewe.breed && ram.breed !== ewe.breed) return { risk: "Crossbreeding", level: "safe", explanation: `${ram.tagId} (${ram.breed}) and ${ewe.tagId} (${ewe.breed}) are different breeds. Crossbreeding can leverage heterosis/hybrid vigor if the breeds are complementary.` };

  const ramHasPed = ram.sireId || ram.damId;
  const eweHasPed = ewe.sireId || ewe.damId;
  if (!ramHasPed || !eweHasPed) return { risk: "Unknown Risk", level: "unknown", explanation: "Pedigree data is incomplete for one or both animals. Record parentage to enable a proper risk assessment." };

  return { risk: "Outbreeding", level: "safe", explanation: `No common ancestors found within 5 recorded generations. ${ram.tagId} and ${ewe.tagId} are unrelated within your recorded data — this is an outbreeding mating.` };
}
