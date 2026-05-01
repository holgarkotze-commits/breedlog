// =====================================================================
// TEMPORARY ONE-SHOT PRODUCTION MAINTENANCE
//
// Tightly scoped to access code U2A2ZAVQ ONLY. After it has been run
// successfully against production and verified, BOTH this file AND the
// route registration in server/routes.ts MUST be removed in a follow-up
// commit. The single-use system_settings flag is a defence-in-depth
// guard so that even before that follow-up commit lands, the action
// cannot be accidentally re-executed.
//
// Wire-up: see server/routes.ts (look for "u2a2zavq" near the admin
// routes section).
// =====================================================================

import type { Express, Response } from "express";
import { and, eq, like, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  animals,
  matingGroups,
  eidScanEvents,
  animalImages,
  breedingEvents,
  offspring,
  performanceRecords,
  healthRecords,
  evaluations,
  aiValuations,
  farmSettings,
  documents,
  exportedDocuments,
  flockHealthEvents,
  flockHealthTreatments,
  inviteCodes,
  userActivations,
  users,
  systemSettings,
} from "@shared/schema";
import {
  buildFieldTestSimulationDataset,
  SIM_BATCH_ID,
  MATING_START,
  MATING_END,
} from "@shared/field-test-simulation";
import { requireAdminPin } from "../device-auth";

// HARD-CODED scope. Refusing any other code/users by construction.
const TARGET_CODE = "U2A2ZAVQ";
const CANONICAL_USER_ID = "d08b57e6-82a0-45cf-b263-b9b4f9fbd193";
const LEGACY_MOBILE_USER_ID = "055a3af0-69bb-4098-836a-1991f6e1719a";
const DONE_FLAG_KEY = "maint:u2a2zavq:unify-and-seed:done";
const CONFIRM_PHRASE = "U2A2ZAVQ-UNIFY-AND-SEED";

// Tables with `userId` ownership column that participate in workspace
// data unification. Order matters only loosely (FK references inside the
// app are by primary key, not by user_id, so column-level UPDATEs are
// independent). userActivations is intentionally NOT in this list:
// the legacy mobile activation row stays put — only its data is moved.
const USER_OWNED_TABLES = [
  { name: "animals", table: animals },
  { name: "mating_groups", table: matingGroups },
  { name: "eid_scan_events", table: eidScanEvents },
  { name: "animal_images", table: animalImages },
  { name: "breeding_events", table: breedingEvents },
  { name: "offspring", table: offspring },
  { name: "performance_records", table: performanceRecords },
  { name: "health_records", table: healthRecords },
  { name: "evaluations", table: evaluations },
  { name: "ai_valuations", table: aiValuations },
  { name: "farm_settings", table: farmSettings },
  { name: "documents", table: documents },
  { name: "exported_documents", table: exportedDocuments },
  { name: "flock_health_events", table: flockHealthEvents },
  { name: "flock_health_treatments", table: flockHealthTreatments },
] as const;

interface MaintReport {
  step: string;
  ok: boolean;
  message?: string;
  mapping?: {
    code: { id: number; code: string; status: string; expiresAt: string | null } | null;
    canonicalUser: { id: string; sharedUserId: string | null } | null;
    legacyMobileUser: { id: string; sharedUserId: string | null } | null;
    activationsOnCode: Array<{ id: number; userId: string; status: string; deviceType: string | null }>;
  };
  snapshotBefore?: SnapshotCounts;
  conflicts?: Array<{ tagId: string }>;
  reassignedRowsByTable?: Record<string, number>;
  snapshotAfterUnify?: SnapshotCounts;
  seed?: {
    applied: boolean;
    skippedReason?: string;
    insertedAnimals: number;
    insertedMatingGroups: number;
  };
  snapshotAfterSeed?: SnapshotCounts;
  totals?: {
    bySex: { ram: number; ewe: number };
    byClassification: { stud: number; commercial: number };
    lambs: number;
    matingGroups: number;
    simBatchAnimals: number;
  };
  otherWorkspacesAnimalCount?: number;
  dryRun: boolean;
  doneFlagSet: boolean;
}

interface SnapshotCounts {
  canonicalAnimals: number;
  legacyMobileAnimals: number;
  simBatchAnimalsInCanonical: number;
  totalProductionAnimals: number;
}

async function countQuery(query: any): Promise<number> {
  const result = await db.execute(query);
  const row = (result as any).rows?.[0] ?? (Array.isArray(result) ? (result as any[])[0] : undefined);
  return Number(row?.c ?? 0);
}

async function snapshot(): Promise<SnapshotCounts> {
  return {
    canonicalAnimals: await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${CANONICAL_USER_ID}`),
    legacyMobileAnimals: await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${LEGACY_MOBILE_USER_ID}`),
    simBatchAnimalsInCanonical: await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${CANONICAL_USER_ID} AND management_group = ${SIM_BATCH_ID}`),
    totalProductionAnimals: await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals`),
  };
}

async function detectTagConflicts(): Promise<Array<{ tagId: string }>> {
  // The app treats animal tagId as logically unique within a workspace.
  // We reject the unification if any legacy-mobile animal would collide
  // with an existing canonical-workspace animal on tagId.
  const result = await db.execute(sql`
    SELECT a1.tag_id AS tag_id
    FROM animals a1
    JOIN animals a2 ON a1.tag_id = a2.tag_id
    WHERE a1.user_id = ${LEGACY_MOBILE_USER_ID}
      AND a2.user_id = ${CANONICAL_USER_ID}
  `);
  const rows = (result as any).rows ?? (Array.isArray(result) ? (result as any[]) : []);
  return rows.map((r: any) => ({ tagId: String(r.tag_id) }));
}

export async function runUnifyAndSeed(opts: { dryRun: boolean }): Promise<MaintReport> {
  const report: MaintReport = {
    step: "start",
    ok: false,
    dryRun: opts.dryRun,
    doneFlagSet: false,
  };

  // --- 1) Verify mapping ---
  report.step = "verify-mapping";
  const codeRows = await db.select().from(inviteCodes).where(eq(inviteCodes.code, TARGET_CODE));
  const canonicalRows = await db.select().from(users).where(eq(users.id, CANONICAL_USER_ID));
  const legacyRows = await db.select().from(users).where(eq(users.id, LEGACY_MOBILE_USER_ID));

  const codeRow = codeRows[0] || null;
  const canonical = canonicalRows[0] || null;
  const legacy = legacyRows[0] || null;

  let activationsOnCode: Array<{ id: number; userId: string; status: string; deviceType: string | null }> = [];
  if (codeRow) {
    const acts = await db.select().from(userActivations).where(eq(userActivations.inviteCodeId, codeRow.id));
    activationsOnCode = acts.map((a) => ({ id: a.id, userId: a.userId, status: a.status, deviceType: a.deviceType ?? null }));
  }

  report.mapping = {
    code: codeRow
      ? { id: codeRow.id, code: codeRow.code, status: codeRow.status, expiresAt: codeRow.expiresAt ? new Date(codeRow.expiresAt).toISOString() : null }
      : null,
    canonicalUser: canonical ? { id: canonical.id, sharedUserId: canonical.sharedUserId ?? null } : null,
    legacyMobileUser: legacy ? { id: legacy.id, sharedUserId: legacy.sharedUserId ?? null } : null,
    activationsOnCode,
  };

  if (!codeRow) {
    report.message = `Code ${TARGET_CODE} not found in this database. Aborting.`;
    return report;
  }
  if (codeRow.status !== "active") {
    report.message = `Code ${TARGET_CODE} status is '${codeRow.status}', expected 'active'. Aborting.`;
    return report;
  }
  if (!canonical) {
    report.message = `Canonical user ${CANONICAL_USER_ID} does not exist in this database. Aborting.`;
    return report;
  }
  if (!legacy) {
    // Legacy user missing is acceptable only if there is also no orphan data.
    // We continue but record the situation.
    report.message = `Legacy mobile user ${LEGACY_MOBILE_USER_ID} not found — continuing (no rows to reassign).`;
  } else if (legacy.sharedUserId !== CANONICAL_USER_ID) {
    report.message = `Legacy mobile user shared_user_id is ${legacy.sharedUserId ?? "null"}, expected ${CANONICAL_USER_ID}. Aborting.`;
    return report;
  }

  const activeActivations = activationsOnCode.filter((a) => a.status === "active");
  const hasCanonicalActivation = activeActivations.some((a) => a.userId === CANONICAL_USER_ID);
  const hasLegacyActivation = activeActivations.some((a) => a.userId === LEGACY_MOBILE_USER_ID);
  if (!hasCanonicalActivation) {
    report.message = `No active activation on ${TARGET_CODE} points at canonical user. Aborting.`;
    return report;
  }
  if (!hasLegacyActivation && legacy) {
    report.message = `Legacy mobile user has no active activation on ${TARGET_CODE}. Aborting (mapping does not match the recorded production state).`;
    return report;
  }

  // --- 2) Idempotency / done-flag check ---
  report.step = "done-flag-check";
  const doneFlag = await db.select().from(systemSettings).where(eq(systemSettings.key, DONE_FLAG_KEY));
  if (doneFlag.length > 0 && !opts.dryRun) {
    report.message = `Done flag '${DONE_FLAG_KEY}' is set (value: ${doneFlag[0].value}). Endpoint is single-use and has already been completed. Aborting.`;
    report.doneFlagSet = true;
    return report;
  }

  // --- 3) Snapshot before ---
  report.step = "snapshot-before";
  report.snapshotBefore = await snapshot();

  // --- 4) Tag conflict pre-check ---
  report.step = "conflict-check";
  const conflicts = await detectTagConflicts();
  report.conflicts = conflicts;
  if (conflicts.length > 0) {
    report.message = `Refusing to reassign: ${conflicts.length} tagId collision(s) between legacy mobile bucket and canonical workspace. Manual resolution required.`;
    return report;
  }

  // --- 5) Reassign rows table-by-table (skipped on dry-run) ---
  report.step = "reassign";
  const reassignedRowsByTable: Record<string, number> = {};
  if (!opts.dryRun) {
    await db.transaction(async (tx) => {
      for (const t of USER_OWNED_TABLES) {
        const result = await tx.execute(
          sql`UPDATE ${sql.identifier(t.name)} SET user_id = ${CANONICAL_USER_ID} WHERE user_id = ${LEGACY_MOBILE_USER_ID}`
        );
        // node-postgres returns rowCount on the underlying result
        reassignedRowsByTable[t.name] = (result as any).rowCount ?? 0;
      }
    });
  } else {
    // Dry-run: count what WOULD be moved without writing.
    for (const t of USER_OWNED_TABLES) {
      reassignedRowsByTable[t.name] = await countQuery(
        sql`SELECT COUNT(*)::int AS c FROM ${sql.identifier(t.name)} WHERE user_id = ${LEGACY_MOBILE_USER_ID}`
      );
    }
  }
  report.reassignedRowsByTable = reassignedRowsByTable;

  // --- 6) Snapshot after unify ---
  report.step = "snapshot-after-unify";
  report.snapshotAfterUnify = await snapshot();

  // --- 7) Seed (skipped on dry-run) ---
  report.step = "seed";
  const existingSim = await db
    .select()
    .from(animals)
    .where(and(eq(animals.userId, CANONICAL_USER_ID), like(animals.notes, `%${SIM_BATCH_ID}%`)));
  // Also check management_group based marker (the script tags managementGroup)
  const existingByMg = await db
    .select()
    .from(animals)
    .where(and(eq(animals.userId, CANONICAL_USER_ID), eq(animals.managementGroup, SIM_BATCH_ID)));
  const alreadySeeded = existingSim.length > 0 || existingByMg.length > 0;

  let insertedAnimals = 0;
  let insertedMatingGroups = 0;
  let seedApplied = false;
  let seedSkippedReason: string | undefined;

  if (alreadySeeded) {
    seedSkippedReason = `BL-SIM-2025-RC1 already present (${Math.max(existingSim.length, existingByMg.length)} animals). Idempotent no-op.`;
  } else if (opts.dryRun) {
    const ds = buildFieldTestSimulationDataset();
    insertedAnimals = ds.animals.length + ds.lambs.length;
    insertedMatingGroups = ds.groups.length;
    seedSkippedReason = "dry-run";
  } else {
    const ds = buildFieldTestSimulationDataset();
    const tagToId = new Map<string, number>();
    await db.transaction(async (tx) => {
      for (const a of ds.animals.filter((x) => x.role !== "lamb")) {
        const inserted = await tx
          .insert(animals)
          .values({
            userId: CANONICAL_USER_ID,
            tagId: a.tag,
            rawTag: a.tag,
            name: a.tag,
            sex: a.sex,
            classification: a.role === "ram" ? "stud" : "commercial",
            status: "active",
            birthDate: a.birthDate,
            birthStatus: a.birthType?.toLowerCase() ?? "single",
            birthWeight: String(a.birthWeightKg),
            notes: a.notes,
            externalSireInfo: a.tag.startsWith("SIM-E")
              ? Number(a.tag.slice(5)) <= 100
                ? "Bruno"
                : "Bash"
              : null,
            externalDamInfo: a.tag.startsWith("SIM-E")
              ? `Foundation Dam Line ${((Number(a.tag.slice(5)) - 1) % 3) + 1}`
              : null,
            managementGroup: SIM_BATCH_ID,
          })
          .returning({ id: animals.id, tagId: animals.tagId });
        tagToId.set(inserted[0].tagId, inserted[0].id);
        insertedAnimals += 1;
      }
      for (const l of ds.lambs) {
        const inserted = await tx
          .insert(animals)
          .values({
            userId: CANONICAL_USER_ID,
            tagId: l.tag,
            rawTag: l.tag,
            name: l.tag,
            sex: l.sex,
            classification: l.sex === "ram" ? "stud" : "commercial",
            status: "active",
            birthDate: l.birthDate,
            birthStatus: l.birthType?.toLowerCase(),
            birthWeight: String(l.birthWeightKg),
            damId: tagToId.get(l.damTag!),
            sireId: tagToId.get(l.sireTag!),
            notes: l.notes,
            managementGroup: SIM_BATCH_ID,
          })
          .returning({ id: animals.id, tagId: animals.tagId });
        tagToId.set(inserted[0].tagId, inserted[0].id);
        insertedAnimals += 1;
      }
      for (const g of ds.groups) {
        await tx.insert(matingGroups).values({
          userId: CANONICAL_USER_ID,
          name: g.name,
          ramId: tagToId.get(g.ramTag)!,
          eweIds: Array.from({ length: 50 }, (_, i) =>
            tagToId.get(`SIM-E${String(g.eweStart + i).padStart(3, "0")}`)!
          ),
          dateIn: MATING_START,
          dateOut: MATING_END,
          lambingSeason: "25A",
          status: "closed",
          notes: `${SIM_BATCH_ID}`,
        });
        insertedMatingGroups += 1;
      }
    });
    seedApplied = true;
  }

  report.seed = {
    applied: seedApplied,
    skippedReason: seedSkippedReason,
    insertedAnimals,
    insertedMatingGroups,
  };

  // --- 8) Snapshot after seed ---
  report.step = "snapshot-after-seed";
  report.snapshotAfterSeed = await snapshot();

  // --- 9) Compute breakdowns ---
  report.step = "totals";
  const ramCount = await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${CANONICAL_USER_ID} AND sex = 'ram'`);
  const eweCount = await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${CANONICAL_USER_ID} AND sex = 'ewe'`);
  const studCount = await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${CANONICAL_USER_ID} AND classification = 'stud'`);
  const commCount = await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${CANONICAL_USER_ID} AND classification = 'commercial'`);
  // Lambs: sim dataset tags them with SIM-L prefix and managementGroup=SIM_BATCH_ID
  const lambsCount = await countQuery(sql`
    SELECT COUNT(*)::int AS c FROM animals
    WHERE user_id = ${CANONICAL_USER_ID}
      AND management_group = ${SIM_BATCH_ID}
      AND tag_id LIKE 'SIM-L%'
  `);
  const mgCount = await countQuery(sql`SELECT COUNT(*)::int AS c FROM mating_groups WHERE user_id = ${CANONICAL_USER_ID}`);
  const simBatchCount = await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id = ${CANONICAL_USER_ID} AND management_group = ${SIM_BATCH_ID}`);
  const otherCount = await countQuery(sql`SELECT COUNT(*)::int AS c FROM animals WHERE user_id <> ${CANONICAL_USER_ID} AND user_id <> ${LEGACY_MOBILE_USER_ID}`);

  report.totals = {
    bySex: { ram: ramCount, ewe: eweCount },
    byClassification: { stud: studCount, commercial: commCount },
    lambs: lambsCount,
    matingGroups: mgCount,
    simBatchAnimals: simBatchCount,
  };
  report.otherWorkspacesAnimalCount = otherCount;

  // --- 10) Set done flag (skip on dry-run) ---
  if (!opts.dryRun) {
    await db
      .insert(systemSettings)
      .values({
        key: DONE_FLAG_KEY,
        value: new Date().toISOString(),
        description: `One-shot maintenance for ${TARGET_CODE} completed.`,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: new Date().toISOString() },
      });
    report.doneFlagSet = true;
  }

  report.step = "done";
  report.ok = true;
  return report;
}

export function registerU2A2ZAVQMaintenanceRoute(app: Express): void {
  app.post("/api/admin/maintenance/u2a2zavq", requireAdminPin, async (req, res: Response) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });
    try {
      const body = (req.body ?? {}) as { confirm?: string; dryRun?: boolean };
      const dryRun = body.dryRun === true || req.query.dryRun === "1";
      if (!dryRun && body.confirm !== CONFIRM_PHRASE) {
        return res.status(400).json({
          message: `Refusing to apply without confirm phrase. Send {"confirm":"${CONFIRM_PHRASE}"} in body, or {"dryRun":true} for a no-write report.`,
        });
      }
      const report = await runUnifyAndSeed({ dryRun });
      const status = report.ok ? 200 : (report.doneFlagSet ? 410 : 409);
      return res.status(status).json(report);
    } catch (err: any) {
      console.error("[Maintenance U2A2ZAVQ] Failed:", err);
      return res.status(500).json({ message: err?.message ?? "Maintenance action failed", stack: err?.stack });
    }
  });
}
