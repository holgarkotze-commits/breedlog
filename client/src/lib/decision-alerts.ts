export type AlertSeverity = "critical" | "important" | "due-soon" | "info";

export interface DecisionAlert {
  key: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  action?: string;
  actionHref?: string;
}

const STORAGE_KEY = "breedlog_dismissed_alerts";

interface Dismissal {
  key: string;
  dismissedAt: string;
}

function getDismissals(): Dismissal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function dismissAlert(key: string): void {
  try {
    const existing = getDismissals().filter((d) => d.key !== key);
    existing.push({ key, dismissedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
  }
}

export function isAlertDismissed(key: string): boolean {
  const dismissals = getDismissals();
  const entry = dismissals.find((d) => d.key === key);
  if (!entry) return false;
  const dismissedAt = new Date(entry.dismissedAt);
  const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < 7;
}

export function generateLambingSeasonAlert(today: Date): DecisionAlert | null {
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const year = today.getFullYear();

  if (month === 7 || month === 8) {
    return {
      key: `lambing-season-${year}`,
      severity: "important",
      title: "Lambing Season Active",
      message:
        "Lambing season has started. Check expected lambing ewes, record births, monitor lamb survival, and update dam/lamb records.",
      action: "View Breeding",
      actionHref: "/breeding",
    };
  }
  if (month === 6 && day >= 15) {
    return {
      key: `lambing-season-upcoming-${year}`,
      severity: "info",
      title: "Lambing Season Approaching",
      message:
        "Lambing season starts 1 July. Review your mating groups and prepare lambing records.",
      action: "View Breeding",
      actionHref: "/breeding",
    };
  }
  return null;
}

export function generateHealthFollowUpAlerts(
  flockEvents: Array<{ id: number | string; nextFollowUpDate?: string | null; eventName?: string | null }>,
  referenceDate: Date = new Date()
): DecisionAlert[] {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const alerts: DecisionAlert[] = [];

  const overdue = flockEvents.filter((e) => {
    if (!e.nextFollowUpDate) return false;
    return new Date(e.nextFollowUpDate) < today;
  });

  const dueSoon = flockEvents.filter((e) => {
    if (!e.nextFollowUpDate) return false;
    const d = new Date(e.nextFollowUpDate);
    const days = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  });

  if (overdue.length > 0) {
    const plural = overdue.length > 1;
    alerts.push({
      key: `health-followup-overdue`,
      severity: "critical",
      title: `${overdue.length} Overdue Health Follow-up${plural ? "s" : ""}`,
      message: `You have ${overdue.length} health treatment${plural ? "s" : ""} with overdue follow-up dates. Check Health Records and update treatment outcomes.`,
      action: "Health Records",
      actionHref: "/health",
    });
  }

  if (dueSoon.length > 0) {
    const plural = dueSoon.length > 1;
    alerts.push({
      key: `health-followup-soon`,
      severity: "due-soon",
      title: `${dueSoon.length} Health Follow-up${plural ? "s" : ""} Due This Week`,
      message: `${dueSoon.length} treatment${plural ? "s" : ""} need follow-up within 7 days. View Health Records to check and record outcomes.`,
      action: "Health Records",
      actionHref: "/health",
    });
  }

  return alerts;
}

export function generateBreedingWindowAlerts(
  matingGroups: Array<{ id: number | string; name?: string | null; dateOut?: string | null }>,
  referenceDate: Date = new Date()
): DecisionAlert[] {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const alerts: DecisionAlert[] = [];

  for (const g of matingGroups) {
    if (!g.dateOut) continue;
    const dateOut = new Date(g.dateOut);
    const daysLeft = Math.round((dateOut.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft >= 0 && daysLeft <= 14) {
      const label = daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
      alerts.push({
        key: `mating-ending-${g.id}`,
        severity: daysLeft <= 3 ? "important" : "due-soon",
        title: `Mating Period Ending ${daysLeft === 0 ? "Today" : `in ${daysLeft} Day${daysLeft !== 1 ? "s" : ""}`}`,
        message: `${g.name || "A mating group"} mating period ends ${label}. Separate the ram and record the event.`,
        action: "View Breeding",
        actionHref: "/breeding",
      });
    }
  }

  return alerts;
}

type LambAlertAnimal = {
  id: number | string;
  status?: string | null;
  sex?: string | null;
  birthDate?: string | null;
  damId?: number | null;
  sireId?: number | null;
  birthWeight?: string | null;
  weight100Day?: string | null;
};

export function generateLambingFollowUpAlerts(animals: LambAlertAnimal[], referenceDate: Date = new Date()): DecisionAlert[] {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const alerts: DecisionAlert[] = [];

  const lambs = animals.filter((a) => {
    if (a.status !== "active") return false;
    if (!a.birthDate) return false;
    const ageDays = (today.getTime() - new Date(a.birthDate).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= 0 && ageDays <= 240;
  });

  if (lambs.length === 0) return [];

  const missingDam = lambs.filter((l) => !l.damId);
  if (missingDam.length > 0) {
    const plural = missingDam.length > 1;
    alerts.push({
      key: "lambing-followup-no-dam",
      severity: "info",
      title: `${missingDam.length} Lamb${plural ? "s" : ""} Missing Dam Record`,
      message: `${missingDam.length} active lamb${plural ? "s have" : " has"} no dam linked. Recording dam relationships helps track ewe performance and pedigree accuracy.`,
      action: "View Lambs",
      actionHref: "/animals",
    });
  }

  const missingBirthWeight = lambs.filter((l) => !l.birthWeight);
  if (missingBirthWeight.length > 0) {
    const plural = missingBirthWeight.length > 1;
    alerts.push({
      key: "lambing-followup-no-birthweight",
      severity: "info",
      title: `${missingBirthWeight.length} Lamb${plural ? "s" : ""} Missing Birth Weight`,
      message: `${missingBirthWeight.length} active lamb${plural ? "s have" : " has"} no birth weight recorded. Birth weight is key for growth performance tracking.`,
      action: "View Lambs",
      actionHref: "/animals",
    });
  }

  const over90NeedsWeanWeight = lambs.filter((l) => {
    if (l.weight100Day) return false;
    if (!l.birthDate) return false;
    const ageDays = (today.getTime() - new Date(l.birthDate).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= 90;
  });
  if (over90NeedsWeanWeight.length > 0) {
    const plural = over90NeedsWeanWeight.length > 1;
    alerts.push({
      key: "lambing-followup-weaning-check",
      severity: "due-soon",
      title: `${over90NeedsWeanWeight.length} Lamb${plural ? "s" : ""} Due for Weaning Weight`,
      message: `${over90NeedsWeanWeight.length} lamb${plural ? "s are" : " is"} over 90 days old with no 100-day weight recorded. Record weaning weights to track flock growth performance.`,
      action: "View Lambs",
      actionHref: "/animals",
    });
  }

  return alerts;
}

export function generatePedigreeIncompletenessAlert(animals: LambAlertAnimal[]): DecisionAlert | null {
  const active = animals.filter((a) => a.status === "active");
  if (active.length < 5) return null;
  const noSire = active.filter((a) => !a.sireId).length;
  const pct = Math.round((noSire / active.length) * 100);
  if (pct < 50) return null;
  return {
    key: "pedigree-incomplete",
    severity: "info",
    title: "Pedigree Records Incomplete",
    message: `${pct}% of active animals have no sire recorded. Incomplete pedigree data means mating risk calculations may underestimate inbreeding. Link sires in animal profiles to improve accuracy.`,
    action: "View Herd",
    actionHref: "/animals",
  };
}

export function generateAllAlerts(opts: {
  today?: Date;
  flockHealthEvents: Array<{ id: number | string; nextFollowUpDate?: string | null; eventName?: string | null }>;
  matingGroups: Array<{ id: number | string; name?: string | null; dateOut?: string | null }>;
  animals?: LambAlertAnimal[];
}): DecisionAlert[] {
  const today = opts.today ?? new Date();
  const all: DecisionAlert[] = [];

  const lambing = generateLambingSeasonAlert(today);
  if (lambing) all.push(lambing);

  all.push(...generateHealthFollowUpAlerts(opts.flockHealthEvents, today));
  all.push(...generateBreedingWindowAlerts(opts.matingGroups, today));

  if (opts.animals && opts.animals.length > 0) {
    all.push(...generateLambingFollowUpAlerts(opts.animals, today));
    const pedigreeAlert = generatePedigreeIncompletenessAlert(opts.animals);
    if (pedigreeAlert) all.push(pedigreeAlert);
  }

  return all.filter((a) => !isAlertDismissed(a.key));
}
