export const MASTER_SIMULATION_ACCESS_CODE = "U2A2ZAVQ";
export const MASTER_SIMULATION_MAX_DEVICES = 50;
export const MASTER_SIMULATION_BATCH_MARKER = "KWANTAM_SIMULATION_2022_TO_2026_V1";

export function isMasterSimulationCode(code: string | null | undefined): boolean {
  return (code || "").toUpperCase() === MASTER_SIMULATION_ACCESS_CODE;
}
