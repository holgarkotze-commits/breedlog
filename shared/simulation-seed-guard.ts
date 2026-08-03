/**
 * Guard for simulation/test seeding scripts.
 *
 * Ensures fake datasets can never be written into a real farmer's workspace:
 * 1. Seeding hard-fails in production (NODE_ENV=production or a Replit
 *    deployment environment).
 * 2. When targeting by access code, only dedicated simulation access codes
 *    are accepted — real farmer invite codes are refused.
 * 3. Targeting a raw user id requires an explicit override flag, so a
 *    copy-pasted farmer workspace id cannot be seeded by accident.
 */
import { MASTER_SIMULATION_ACCESS_CODE } from "./master-simulation";

/** Access codes that resolve to dedicated simulation workspaces only. */
export const SIMULATION_ACCESS_CODES: readonly string[] = [
  MASTER_SIMULATION_ACCESS_CODE,
];

export const RAW_TARGET_OVERRIDE_FLAG = "--force-non-simulation-target";

export interface SeedGuardEnv {
  NODE_ENV?: string;
  REPLIT_DEPLOYMENT?: string;
  DATABASE_URL?: string;
}

export interface SeedGuardTarget {
  accessCode?: string;
  userId?: string;
  /** true when the operator passed RAW_TARGET_OVERRIDE_FLAG */
  rawTargetOverride?: boolean;
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
      "Refusing to seed simulation data: this is a production environment. " +
        "Simulation seeding is only allowed in development.",
    );
  }

  const code = target.accessCode?.toUpperCase().trim();
  if (code) {
    if (!SIMULATION_ACCESS_CODES.includes(code)) {
      throw new SeedGuardError(
        `Refusing to seed simulation data: access code ${code} is not a dedicated ` +
          `simulation access code. Real farmer workspaces must never receive test data.`,
      );
    }
    return;
  }

  if (target.userId) {
    if (!target.rawTargetOverride) {
      throw new SeedGuardError(
        `Refusing to seed simulation data into raw user id ${target.userId}: a raw id ` +
          `cannot be verified as a simulation workspace. Re-run with ${RAW_TARGET_OVERRIDE_FLAG} ` +
          `only if you are certain this is a disposable test workspace.`,
      );
    }
    return;
  }

  throw new SeedGuardError("Refusing to seed simulation data without a target.");
}
