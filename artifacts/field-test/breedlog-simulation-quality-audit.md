# BreedLog Simulation Quality Audit
**Workspace**: U2A2ZAVQ (Kwantam Meatmasters demo)
**Audit date**: 2026-05-26
**Sim fixed date**: 2026-05-11
**File**: `shared/breedlog-simulation.ts`

---

## Pre-rewrite defects (Phase 1 audit)

| Defect | Count | Impact |
|--------|-------|--------|
| Founders missing birth weights | 102 | Weight analytics broken |
| Animals missing currentWeight (sold/culled rams) | 471 | Weight analytics broken |
| Breeding events with lambCount = 0 | 998 / 998 (100%) | Lambing rate = 0% |
| Animals with `unknown_not_recorded` source | 44 | Source distribution misleading |
| Health records total | 14 | Health overview empty |

---

## Post-rewrite results (Phase 2 — final)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total animals | 1 430 | — | ✓ |
| Founders (bought-in) | 102 | 102 | ✓ |
| Born-on-farm | 1 328 | — | ✓ |
| `unknown_not_recorded` source | 0 | 0 | ✓ |
| Missing birth weights | 0 | 0 | ✓ |
| Missing currentWeight | 0 | 0 | ✓ |
| Breeding events with lambs (lambCount > 0) | 998 / 1 398 | 998 | ✓ |
| Health records | 217 | ≥ 14 | ✓ |
| Mating groups | 12 | 12 (2 per round) | ✓ |
| KW22 tags without KW26 leakage | 0 KW26 | 0 | ✓ |
| Duplicate tags | 0 | 0 | ✓ |
| Bad parent dates (child born before parent) | 0 | 0 | ✓ |

---

## Genetic differentiation (sire-line signal)

| Metric | KW22001 line | KW22002 line |
|--------|-------------|-------------|
| Offspring count | 632 | 629 |
| Avg weaning weight | 34.0 kg | 32.2 kg |

Elite ewe offspring avg WW: **34.6 kg** vs weak ewe offspring: **31.4 kg** — demonstrable dam-merit signal.

Retained rams avg WW: **35.2 kg** vs culled/marketed: **33.9 kg** — selection gradient confirmed.

---

## Lamb-stage distribution (at 2026-05-21)

All five active lamb stages populated in the generated dataset:

| Stage | Expected | Status |
|-------|----------|--------|
| Replacement candidate | > 0 | ✓ |
| Sale candidate | > 0 | ✓ |
| Cull/watch | > 0 | ✓ |
| Ready for herd admission | > 0 | ✓ |
| Admitted to herd | > 0 | ✓ |

**Cap-blocked ewe treatment by age** (at SIM_DATE):
- Age < 300 days (R5 lambs): classification = `replacement` → "Ready for herd admission"
- Age 300–480 days (R4 lambs): classification = `commercial` → "Sale candidate"
- Age ≥ 480 days (R1–R3 lambs): status = `sold` → archived

---

## Breeding herd growth (ewes joined per round)

| Round | Mating start | Ewes joined |
|-------|-------------|-------------|
| R1 | 2022-10-01 | 100 |
| R2 | 2023-06-01 | 100 |
| R3 | 2024-02-01 | 168 |
| R4 | 2024-10-01 | 248 |
| R5 | 2025-06-01 | 382 |
| R6 | 2026-02-01 | 400 |

Breeding cap of 400 reached at R6. R5 blocked ewes tracked in `expectedAnalysisSummary.blockedByCapByRound.R5`.

---

## Non-retained ram disposal

All non-retained ram lambs (not selected for stud/commercial breeding) receive status `sold` or `culled` immediately after selection — no age threshold exclusion. Total sold/culled rams > 400.

---

## Test coverage

| Test file | Tests | Result |
|-----------|-------|--------|
| `tests/breedlog-simulation-dataset.test.ts` | 20 | ✓ all pass |
| `tests/demo-data-phase24.test.ts` | 1 | ✓ pass |
| `tests/import-export-hardening.test.ts` | 8 | ✓ all pass |
| **Full cert suite (37 files)** | **296** | **✓ 296/296** |

---

## Workspace reseed

U2A2ZAVQ workspace reseeded via `scripts/reset-master-simulation-workspace.ts --apply`.

Final DB state: 1 430 animals · 12 mating groups · 1 398 breeding events · 217 health records.
