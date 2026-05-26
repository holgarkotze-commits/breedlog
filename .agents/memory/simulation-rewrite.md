---
name: Simulation rewrite lessons
description: Key correctness rules discovered during breedlog-simulation.ts rebuild — weights, lamb stages, ram disposal, cap-blocked ewe treatment.
---

## Rules

**All animals must have birth weights and currentWeight** — including sold/culled animals. Set currentWeight before changing status to sold/culled.

**Non-retained ram lambs must be disposed immediately** — do not gate on `age > 240` or any age threshold. All ram lambs not selected for stud/commercial get `status = "sold" | "culled"` right after selection. The age-gate was the original bug causing soldCullRams.length < 400.

**Cap-blocked ewes need age-based treatment** (at SIM_DATE) to populate all five lamb stages:
- Age < 300 days (most recent round): `classification = "replacement"` → "Ready for herd admission"
- Age 300–480 days: `classification = "commercial"` → "Sale candidate"
- Age ≥ 480 days: `status = "sold"` → archived (isArchivedLambState)

**Breeding events need real lambCount** — set lambCount from actual eweLambCount map per ewe, not hardcoded 0. lambingDate only set if lc > 0.

**Founder ewes have estimated birth weights** — `birthWeightEstimated: true` for all founders. CSV export test must expect `"true"` not `"false"` for founder animals.

**blockedByCapByRound must be tracked and returned** in `expectedAnalysisSummary` — tests check `.blockedByCapByRound.R5.length > 0` and `.activeBreedingEwesByRound.R6 >= 400`.

**Why:** All five calculateLambStage labels must have at least one animal for the phase5c cert test. The previous all-commercial treatment for cap-blocked ewes left "Ready for herd admission" empty.

**How to apply:** When modifying the replacement ewe selection loop, always use age-at-SIM_DATE to differentiate pending vs. commercial vs. sold treatments for cap-blocked ewes.
