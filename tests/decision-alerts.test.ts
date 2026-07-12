import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateLambingSeasonAlert,
  generateHealthFollowUpAlerts,
  generateBreedingWindowAlerts,
  generateAllAlerts,
  generateLambingFollowUpAlerts,
  generatePedigreeIncompletenessAlert,
} from "../client/src/lib/decision-alerts.js";

describe("generateLambingSeasonAlert", () => {
  it("returns important alert on 1 July", () => {
    const alert = generateLambingSeasonAlert(new Date(2026, 6, 1));
    assert.ok(alert);
    assert.equal(alert!.severity, "important");
    assert.ok(alert!.key.startsWith("lambing-season-"));
    assert.ok(!alert!.key.includes("upcoming"));
  });

  it("returns important alert on 31 August", () => {
    const alert = generateLambingSeasonAlert(new Date(2026, 7, 31));
    assert.ok(alert);
    assert.equal(alert!.severity, "important");
  });

  it("returns info alert on 15 June", () => {
    const alert = generateLambingSeasonAlert(new Date(2026, 5, 15));
    assert.ok(alert);
    assert.equal(alert!.severity, "info");
    assert.ok(alert!.key.includes("upcoming"));
  });

  it("returns null outside lambing window (March)", () => {
    const alert = generateLambingSeasonAlert(new Date(2026, 2, 15));
    assert.equal(alert, null);
  });

  it("returns null on 14 June (before threshold)", () => {
    const alert = generateLambingSeasonAlert(new Date(2026, 5, 14));
    assert.equal(alert, null);
  });

  it("returns null on 1 September (after season)", () => {
    const alert = generateLambingSeasonAlert(new Date(2026, 8, 1));
    assert.equal(alert, null);
  });
});

describe("generateHealthFollowUpAlerts", () => {
  const today = new Date(2026, 6, 2);

  it("returns critical alert for overdue follow-ups", () => {
    const events = [
      { id: 1, nextFollowUpDate: "2026-06-25", eventName: "Dosing" },
      { id: 2, nextFollowUpDate: "2026-07-01", eventName: "Vaccination" },
    ];
    const alerts = generateHealthFollowUpAlerts(events, today);
    const critical = alerts.find((a) => a.severity === "critical");
    assert.ok(critical);
    assert.ok(critical!.title.includes("Overdue"));
  });

  it("returns due-soon alert for follow-ups within 7 days", () => {
    const events = [{ id: 3, nextFollowUpDate: "2026-07-07", eventName: "Checkup" }];
    const alerts = generateHealthFollowUpAlerts(events, today);
    const soon = alerts.find((a) => a.severity === "due-soon");
    assert.ok(soon);
    assert.ok(soon!.title.includes("Due This Week") || soon!.title.includes("Due Soon"));
  });

  it("returns no alerts when no follow-up dates", () => {
    const events = [{ id: 4, eventName: "Treatment" }];
    const alerts = generateHealthFollowUpAlerts(events, today);
    assert.equal(alerts.length, 0);
  });

  it("returns no alerts for far-future follow-ups (30 days out)", () => {
    const events = [{ id: 5, nextFollowUpDate: "2026-08-15", eventName: "Annual Vax" }];
    const alerts = generateHealthFollowUpAlerts(events, today);
    assert.equal(alerts.length, 0);
  });
});

describe("generateBreedingWindowAlerts", () => {
  it("returns due-soon alert for mating group ending within 14 days", () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    const groups = [{ id: 1, name: "Group A", dateOut: endDate.toISOString().slice(0, 10) }];
    const alerts = generateBreedingWindowAlerts(groups);
    assert.ok(alerts.length > 0);
    assert.equal(alerts[0].actionHref, "/breeding");
  });

  it("returns no alert for mating group ending in 20 days", () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 20);
    const groups = [{ id: 2, name: "Group B", dateOut: endDate.toISOString().slice(0, 10) }];
    const alerts = generateBreedingWindowAlerts(groups);
    assert.equal(alerts.length, 0);
  });

  it("returns no alert for groups without dateOut", () => {
    const groups = [{ id: 3, name: "Group C" }];
    const alerts = generateBreedingWindowAlerts(groups);
    assert.equal(alerts.length, 0);
  });
});

describe("generateLambingFollowUpAlerts", () => {
  const todayStr = new Date().toISOString().slice(0, 10);

  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  it("returns no alerts when there are no active lambs", () => {
    const alerts = generateLambingFollowUpAlerts([
      { id: 1, status: "culled", birthDate: todayStr },
    ]);
    assert.equal(alerts.length, 0);
  });

  it("returns no alerts when all lambs have full records", () => {
    const alerts = generateLambingFollowUpAlerts([
      { id: 1, status: "active", birthDate: daysAgo(30), damId: 10, sireId: 5, birthWeight: "4.2", weight100Day: null },
    ]);
    const keys = alerts.map((a) => a.key);
    assert.ok(!keys.includes("lambing-followup-no-dam"));
    assert.ok(!keys.includes("lambing-followup-no-birthweight"));
  });

  it("alerts when active lamb has no dam", () => {
    const alerts = generateLambingFollowUpAlerts([
      { id: 1, status: "active", birthDate: daysAgo(10), damId: null, birthWeight: "4.0" },
    ]);
    assert.ok(alerts.some((a) => a.key === "lambing-followup-no-dam"));
  });

  it("alerts when active lamb has no birth weight", () => {
    const alerts = generateLambingFollowUpAlerts([
      { id: 1, status: "active", birthDate: daysAgo(5), damId: 2, birthWeight: null },
    ]);
    assert.ok(alerts.some((a) => a.key === "lambing-followup-no-birthweight"));
  });

  it("alerts when lamb over 90 days has no 100-day weight", () => {
    const alerts = generateLambingFollowUpAlerts([
      { id: 1, status: "active", birthDate: daysAgo(100), damId: 2, birthWeight: "3.8", weight100Day: null },
    ]);
    assert.ok(alerts.some((a) => a.key === "lambing-followup-weaning-check"));
  });

  it("does not alert for weaning when lamb is under 90 days", () => {
    const alerts = generateLambingFollowUpAlerts([
      { id: 1, status: "active", birthDate: daysAgo(50), damId: 2, birthWeight: "4.0", weight100Day: null },
    ]);
    assert.ok(!alerts.some((a) => a.key === "lambing-followup-weaning-check"));
  });

  it("ignores animals over 240 days old (no longer lambs)", () => {
    const alerts = generateLambingFollowUpAlerts([
      { id: 1, status: "active", birthDate: daysAgo(250), damId: null, birthWeight: null },
    ]);
    assert.equal(alerts.length, 0);
  });
});

describe("generatePedigreeIncompletenessAlert", () => {
  it("returns null when fewer than 5 active animals", () => {
    const alert = generatePedigreeIncompletenessAlert([
      { id: 1, status: "active", sireId: null },
      { id: 2, status: "active", sireId: null },
    ]);
    assert.equal(alert, null);
  });

  it("returns null when fewer than 50% missing sire", () => {
    const animals = [
      { id: 1, status: "active", sireId: 10 },
      { id: 2, status: "active", sireId: 10 },
      { id: 3, status: "active", sireId: 10 },
      { id: 4, status: "active", sireId: null },
      { id: 5, status: "active", sireId: null },
    ];
    const alert = generatePedigreeIncompletenessAlert(animals);
    assert.equal(alert, null);
  });

  it("returns alert when 50%+ of active animals have no sire", () => {
    const animals = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      status: "active" as const,
      sireId: i < 3 ? 5 : null,
    }));
    const alert = generatePedigreeIncompletenessAlert(animals);
    assert.ok(alert !== null);
    assert.equal(alert!.key, "pedigree-incomplete");
  });

  it("ignores culled animals in percentage calculation", () => {
    const animals = [
      { id: 1, status: "culled", sireId: null },
      { id: 2, status: "culled", sireId: null },
      { id: 3, status: "culled", sireId: null },
      { id: 4, status: "culled", sireId: null },
      { id: 5, status: "culled", sireId: null },
      { id: 6, status: "active", sireId: 3 },
      { id: 7, status: "active", sireId: 3 },
      { id: 8, status: "active", sireId: 3 },
      { id: 9, status: "active", sireId: 3 },
      { id: 10, status: "active", sireId: 3 },
    ];
    const alert = generatePedigreeIncompletenessAlert(animals);
    assert.equal(alert, null);
  });
});

describe("generateAllAlerts", () => {
  it("combines lambing + health + breeding alerts", () => {
    const today = new Date(2026, 6, 5);
    const alerts = generateAllAlerts({
      today,
      flockHealthEvents: [{ id: 1, nextFollowUpDate: "2026-06-20", eventName: "Dosing" }],
      matingGroups: [{ id: 1, name: "Ram Group", dateOut: "2026-07-10" }],
    });
    const keys = alerts.map((a) => a.key);
    assert.ok(keys.some((k) => k.startsWith("lambing-season-")));
    assert.ok(keys.some((k) => k.includes("followup")));
    assert.ok(keys.some((k) => k.includes("mating-ending")));
  });

  it("includes no alert outside lambing window with no health/breeding events", () => {
    const today = new Date(2026, 2, 10);
    const alerts = generateAllAlerts({ today, flockHealthEvents: [], matingGroups: [], animals: [] });
    assert.equal(alerts.length, 0);
  });
});
