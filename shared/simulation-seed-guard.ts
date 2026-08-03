/**
 * Guard for simulation/test seeding scripts.
 *
 * Ensures fake datasets can never be written into a real farmer's workspace:
 * 1. Seeding hard-fails in production (NODE_ENV=production or a Replit
 *    deployment environment) — even for dry-runs.
 * 2. Dry-runs (no --apply) are read-only and remain allowed for any target in
 *    development, preserving the existing resolver-test contract.
 * 3. Writes (--apply) are only permitted when the target was resolved from a
 *    dedicated simulation access code. Raw user ids and real farmer invite
 *    codes are always refused for writes — there is no override flag.
 */
import { MASTER_SIMULATION_ACCESS_CODE } from "./master-simulation";

/** Access codes that resolve to dedicated simulation workspaces only. */
export const SIMULATION_ACCESS_CODES: readonly string[] = [
  MASTER_SIMULATION_ACCESS_CODE,
];

export interface SeedGuardEnv {
  NODE_ENV?: string;
  REPLIT_DEPLOYMENT?: string;
}

export interface SeedGuardTarget {
  accessCode?: string;
  userId?: string;
  /** true when the script would write data (--apply); dry-runs are read-only */
  apply: boolean;
}

export class SeedGuardError extends Error {}

/**
 * Throws SeedGuardError when seeding must not proceed.
 * Pure function of its inputs so it is directly testable.
 */
export function assertSeedingAllowed(
  target: SeedGuardTarget,
  env: SeedGuardEnv = process.env as SeedGuardEnv,
): void {
  if (env.NODE_ENV === "production" || env.REPLIT_DEPLOYMENT) {
    throw new SeedGuardError(
      "Refusing to run simulation seeding: this is a production environment. " +
        "Simulation seeding is only allowed in development.",
    );
  }

  if (!target.apply) return; // dry-run: read-only, nothing is written

  const code = target.accessCode?.toUpperCase().trim();
  if (code && SIMULATION_ACCESS_CODES.includes(code)) return;

  if (code) {
    throw new SeedGuardError(
      `Refusing to write simulation data: access code ${code} is not a dedicated ` +
        `simulation access code. Real farmer workspaces must never receive test data.`,
    );
  }
  throw new SeedGuardError(
    "Refusing to write simulation data to a raw user id: raw ids cannot be verified " +
      "as simulation workspaces. Target a dedicated simulation access code instead.",
  );
}
