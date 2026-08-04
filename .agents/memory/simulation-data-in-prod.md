---
name: Simulation data leaked into production workspace
description: Why the AI assistant reported "wrong" herd numbers and how simulation data is cleaned from production.
---

## Lesson
The in-app AI assistant reads server data; the dashboard reads the device's local store. When they disagree, suspect the server workspace contains data the user doesn't see — not model hallucination. In Aug 2026 the "hallucinated" 1430/919/50/552 counts were real: the master simulation dataset had been seeded into the user's live production workspace.

## Markers
All simulation records are stamped in `notes` (and `management_group`) with:
- `KWANTAM_SIMULATION_2022_TO_2026_V1` (master simulation)
- `BL-SIM-2025-RC1` (field-test simulation)

## Cleanup mechanism
`server/simulation-cleanup.ts` runs on boot in production only (NODE_ENV check), under an advisory lock, in one transaction; deletes only marker-stamped records plus children keyed by sim animal IDs. Dev keeps simulation data for cert tests. Idempotent — no-op once clean.

**Why:** production DB is read-only from the workspace, so cleanup must execute inside the deployed app.
**How to apply:** if simulation data ever reappears in prod, verify the marker matches SIM_MARKERS in that file; re-publish triggers cleanup. FK gotcha: flock_health_treatments must be deleted for marked event IDs too, not just sim animal IDs.
