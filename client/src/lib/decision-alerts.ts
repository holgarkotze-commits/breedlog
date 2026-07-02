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
  flockEvents: Array<{ id: number | string; nextFollowUpDate?: string | null; eventName?: string | null }>
): DecisionAlert[] {
  const today = new Date();
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
  matingGroups: Array<{ id: number | string; name?: string | null; dateOut?: string | null }>
): DecisionAlert[] {
  const today = new Date();
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

export function generateAllAlerts(opts: {
  today?: Date;
  flockHealthEvents: Array<{ id: number | string; nextFollowUpDate?: string | null; eventName?: string | null }>;
  matingGroups: Array<{ id: number | string; name?: string | null; dateOut?: string | null }>;
}): DecisionAlert[] {
  const today = opts.today ?? new Date();
  const all: DecisionAlert[] = [];

  const lambing = generateLambingSeasonAlert(today);
  if (lambing) all.push(lambing);

  all.push(...generateHealthFollowUpAlerts(opts.flockHealthEvents));
  all.push(...generateBreedingWindowAlerts(opts.matingGroups));

  return all.filter((a) => !isAlertDismissed(a.key));
}
