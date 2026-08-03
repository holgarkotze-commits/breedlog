/**
 * One-shot, idempotent cleanup of simulation/test datasets from the database.
 *
 * Runs ONLY in production (NODE_ENV === "production"), after startup migrations.
 * Deletes exclusively records stamped with known simulation batch markers, plus
 * child records that reference those simulation animals. Real farmer data never
 * carries these markers, so it cannot be touched.
 */
import { pool } from "./db";

const SIM_MARKERS = [
  "KWANTAM_SIMULATION_2022_TO_2026_V1", // master simulation batch
  "BL-SIM-2025-RC1", // field-test simulation batch
];

const CLEANUP_LOCK_KEY = 727272_002;

export async function cleanupSimulationData(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return; // dev keeps simulation data for testing/certification
  }

  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [CLEANUP_LOCK_KEY]);

    const markerCond = SIM_MARKERS.map(
      (_, i) => `notes LIKE '%' || $${i + 1} || '%' OR management_group = $${i + 1}`,
    ).join(" OR ");

    const { rows } = await client.query(
      `SELECT id FROM animals WHERE ${markerCond}`,
      SIM_MARKERS,
    );
    const simIds: number[] = rows.map((r) => r.id);
    if (simIds.length === 0) return;

    console.log(`[sim-cleanup] Removing ${simIds.length} simulation-marked animals and related records...`);

    await client.query("BEGIN");
    try {
      const idParam = [simIds];
      const del = async (label: string, sql: string, params: any[] = idParam) => {
        const res = await client.query(sql, params);
        if (res.rowCount) console.log(`[sim-cleanup] ${label}: ${res.rowCount} deleted`);
      };

      // Children referencing simulation animals
      await del("flock_health_treatments", `DELETE FROM flock_health_treatments WHERE animal_id = ANY($1::int[]) OR event_id IN (SELECT id FROM flock_health_events WHERE ${SIM_MARKERS.map((_, i) => `notes LIKE '%' || $${i + 2} || '%' OR event_name LIKE '%' || $${i + 2} || '%'`).join(" OR ")})`, [simIds, ...SIM_MARKERS]);
      await del("offspring", `DELETE FROM offspring WHERE lamb_id = ANY($1::int[]) OR breeding_event_id IN (SELECT id FROM breeding_events WHERE ewe_id = ANY($1::int[]) OR ram_id = ANY($1::int[]))`);
      await del("breeding_events", `DELETE FROM breeding_events WHERE ewe_id = ANY($1::int[]) OR ram_id = ANY($1::int[])`);
      await del("health_records", `DELETE FROM health_records WHERE animal_id = ANY($1::int[])`);
      await del("performance_records", `DELETE FROM performance_records WHERE animal_id = ANY($1::int[])`);
      await del("evaluations", `DELETE FROM evaluations WHERE animal_id = ANY($1::int[])`);
      await del("ai_valuations", `DELETE FROM ai_valuations WHERE animal_id = ANY($1::int[])`);
      await del("animal_images", `DELETE FROM animal_images WHERE animal_id = ANY($1::int[])`);
      await del("eid_scan_events", `DELETE FROM eid_scan_events WHERE animal_id = ANY($1::int[])`);
      await del("animal_bloodlines", `DELETE FROM animal_bloodlines WHERE animal_id = ANY($1::int[])`);
      await del("documents", `DELETE FROM documents WHERE animal_id = ANY($1::int[])`);
      await del("exported_documents", `DELETE FROM exported_documents WHERE animal_id = ANY($1::int[])`);
      await del("mating_groups", `DELETE FROM mating_groups WHERE ram_id = ANY($1::int[]) OR ${SIM_MARKERS.map((_, i) => `notes LIKE '%' || $${i + 2} || '%'`).join(" OR ")}`, [simIds, ...SIM_MARKERS]);
      await del("flock_health_events (marked)", `DELETE FROM flock_health_events WHERE ${SIM_MARKERS.map((_, i) => `notes LIKE '%' || $${i + 1} || '%' OR event_name LIKE '%' || $${i + 1} || '%'`).join(" OR ")}`, [...SIM_MARKERS]);

      // Unlink any surviving animal that references a simulation parent
      await del("sire/dam unlinks", `UPDATE animals SET sire_id = NULL WHERE sire_id = ANY($1::int[]) AND NOT (id = ANY($1::int[]))`);
      await del("dam unlinks", `UPDATE animals SET dam_id = NULL WHERE dam_id = ANY($1::int[]) AND NOT (id = ANY($1::int[]))`);

      // Finally the simulation animals themselves
      await del("animals", `DELETE FROM animals WHERE id = ANY($1::int[])`);

      await client.query("COMMIT");
      console.log(`[sim-cleanup] Done. Simulation dataset removed.`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("[sim-cleanup] Failed (app continues):", err);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [CLEANUP_LOCK_KEY]).catch(() => {});
    client.release();
  }
}
