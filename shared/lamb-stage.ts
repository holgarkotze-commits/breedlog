import type { Animal } from "@shared/schema";

export const LAMB_STAGE_ORDER = [
  "newborn",
  "marked_tagged",
  "growing",
  "weaning_due",
  "weaned",
  "replacement_candidate",
  "sale_candidate",
  "cull_watch",
  "ready_for_herd_admission",
  "admitted_to_herd",
] as const;

export type LambStageValue = (typeof LAMB_STAGE_ORDER)[number];
export type LambStagePriority = "low" | "medium" | "high";

export interface LambStageResult {
  value: LambStageValue;
  label: string;
  reason: string;
  nextAction: string;
  needsAttention: boolean;
  priority: LambStagePriority;
  isActiveLambStage: boolean;
}

export const LAMB_STAGE_LABELS: Record<LambStageValue, string> = {
  newborn: "Newborn",
  marked_tagged: "Marked/tagged",
  growing: "Growing",
  weaning_due: "Weaning due",
  weaned: "Weaned",
  replacement_candidate: "Replacement candidate",
  sale_candidate: "Sale candidate",
  cull_watch: "Cull/watch",
  ready_for_herd_admission: "Ready for herd admission",
  admitted_to_herd: "Admitted to herd",
};

const ARCHIVE_STATUSES = new Set(["culled", "sold", "dead", "deceased", "transferred"]);

function getAgeDays(birthDate?: string | Date | null, now = new Date()): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

function hasId(a: Animal) {
  return Boolean(a.tagId || a.electronicId);
}

function hasWeaningData(a: Animal) {
  return Boolean(a.weight100DayDate && a.weight100Day);
}

function isAdmitted(a: Animal) {
  const ls = (a.lambStatus || "").toLowerCase();
  return ls === "moved_to_ewes" || ls === "moved_to_rams";
}

export function isArchivedLambState(a: Animal): boolean {
  const status = (a.status || "").toLowerCase();
  const ls = (a.lambStatus || "").toLowerCase();
  return Boolean(a.cullConfirmed) || ARCHIVE_STATUSES.has(status) || ["culled", "sold", "deceased", "dead"].includes(ls);
}

export function calculateLambStage(animal: Animal, options?: { now?: Date }): LambStageResult {
  const now = options?.now || new Date();
  const ageDays = getAgeDays(animal.birthDate, now);

  if (isArchivedLambState(animal)) {
    return { value: "cull_watch", label: LAMB_STAGE_LABELS.cull_watch, reason: "Animal is archived (culled/sold/deceased/dead).", nextAction: "No lamb-stage action required.", needsAttention: false, priority: "low", isActiveLambStage: false };
  }

  const cls = (animal.ramLambClass || animal.classification || "").toLowerCase();
  const weaningStatus = (animal.weaningStatus || "").toLowerCase();
  if (isAdmitted(animal) && ["stud", "replacement", "breeding", "retain"].some((v) => cls.includes(v))) {
    return { value: "replacement_candidate", label: LAMB_STAGE_LABELS.replacement_candidate, reason: "Retained lamb has been admitted and remains a breeding replacement candidate.", nextAction: "Track breeding readiness and long-term selection outcomes.", needsAttention: false, priority: "low", isActiveLambStage: false };
  }
  if (isAdmitted(animal)) {
    return { value: "admitted_to_herd", label: LAMB_STAGE_LABELS.admitted_to_herd, reason: "Animal has been moved into the ewe/ram herd.", nextAction: "Manage from mature herd workflows.", needsAttention: false, priority: "low", isActiveLambStage: false };
  }

  if (animal.cullConfirmed || cls === "cull" || weaningStatus === "watch") {
    return { value: "cull_watch", label: LAMB_STAGE_LABELS.cull_watch, reason: "Classification or management flags the lamb for cull/watch.", nextAction: "Review condition and confirm cull/sale decision.", needsAttention: true, priority: "high", isActiveLambStage: true };
  }

  if (ageDays !== null && ageDays <= 14 && !hasId(animal)) {
    return { value: "newborn", label: LAMB_STAGE_LABELS.newborn, reason: "Very young lamb with incomplete identification details.", nextAction: "Record tag/electronic ID and parent links.", needsAttention: true, priority: "medium", isActiveLambStage: true };
  }

  if ((ageDays === null || ageDays <= 45) && hasId(animal)) {
    return { value: "marked_tagged", label: LAMB_STAGE_LABELS.marked_tagged, reason: "Identification is recorded and lamb is in early management period.", nextAction: "Continue growth monitoring and schedule 100-day weighing.", needsAttention: false, priority: "low", isActiveLambStage: true };
  }

  if (hasWeaningData(animal)) {
    if (["stud", "replacement", "breeding", "retain"].some((v) => cls.includes(v)) || (animal.sex === "ewe" && cls !== "commercial" && cls !== "cull")) {
      if (!isAdmitted(animal)) {
        return { value: "ready_for_herd_admission", label: LAMB_STAGE_LABELS.ready_for_herd_admission, reason: "Weaning data and retention decision are recorded, but lamb is not moved yet.", nextAction: "Move to ewes/rams when group admission is approved.", needsAttention: true, priority: "medium", isActiveLambStage: true };
      }
      return { value: "replacement_candidate", label: LAMB_STAGE_LABELS.replacement_candidate, reason: "Retention indicators suggest this lamb should join breeding herd.", nextAction: "Finalize breeding plan and admission timing.", needsAttention: false, priority: "low", isActiveLambStage: true };
    }
    if (cls.includes("commercial") || cls.includes("sale")) {
      return { value: "sale_candidate", label: LAMB_STAGE_LABELS.sale_candidate, reason: "Classification indicates commercial/sale pathway.", nextAction: "Prepare marketing or transfer records.", needsAttention: false, priority: "low", isActiveLambStage: true };
    }
    return { value: "weaned", label: LAMB_STAGE_LABELS.weaned, reason: "100-day/weaning data is captured.", nextAction: "Record post-weaning decision (replacement, sale, or cull/watch).", needsAttention: false, priority: "low", isActiveLambStage: true };
  }

  if (ageDays !== null && ageDays >= 90) {
    return { value: "weaning_due", label: LAMB_STAGE_LABELS.weaning_due, reason: "Age is in/above weaning review window, but 100-day/weaning data is missing.", nextAction: "Record 100-day weight and weaning date/status.", needsAttention: true, priority: "high", isActiveLambStage: true };
  }

  return { value: "growing", label: LAMB_STAGE_LABELS.growing, reason: ageDays === null ? "Birth date missing, so age-based checkpoints cannot be verified." : "Lamb is pre-weaning and in growth phase.", nextAction: "Continue routine weights and health checks.", needsAttention: ageDays === null, priority: ageDays === null ? "medium" : "low", isActiveLambStage: true };
}
