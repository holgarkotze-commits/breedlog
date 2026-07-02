import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateLambingSeasonAlert,
  generateHealthFollowUpAlerts,
  generateBreedingWindowAlerts,
  generateAllAlerts,
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
    const alerts = generateHealthFollowUpAlerts(events);
    const critical = alerts.find((a) => a.severity === "critical");
    assert.ok(critical);
    assert.ok(critical!.title.includes("Overdue"));
  });

  it("returns due-soon alert for follow-ups within 7 days", () => {
    const events = [{ id: 3, nextFollowUpDate: "2026-07-07", eventName: "Checkup" }];
    const alerts = generateHealthFollowUpAlerts(events);
    const soon = alerts.find((a) => a.severity === "due-soon");
    assert.ok(soon);
    assert.ok(soon!.title.includes("Due This Week") || soon!.title.includes("Due Soon"));
  });

  it("returns no alerts when no follow-up dates", () => {
    const events = [{ id: 4, eventName: "Treatment" }];
    const alerts = generateHealthFollowUpAlerts(events);
    assert.equal(alerts.length, 0);
  });

  it("returns no alerts for far-future follow-ups (30 days out)", () => {
    const events = [{ id: 5, nextFollowUpDate: "2026-08-15", eventName: "Annual Vax" }];
    const alerts = generateHealthFollowUpAlerts(events);
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
    const alerts = generateAllAlerts({ today, flockHealthEvents: [], matingGroups: [] });
    assert.equal(alerts.length, 0);
  });
});
