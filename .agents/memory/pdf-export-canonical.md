---
name: PDF export canonical standard
description: Durable rules for consistent, safe, and accurate BreedLog document exports.
---

## One formatted-document standard

All formatted exports are PDF-only. CSV remains available only as a raw-data interchange format, not as an alternative formatted report.

**Why:** Multiple report types and bespoke templates created inconsistent, low-quality documents and made correctness drift difficult to detect.

**How to apply:** Route HTML reports through the canonical export module. React-PDF reports must reproduce the same visual contract: A4 page, 60×60 logo zone, centered farm/stud heading, page/date metadata, yellow divider, reserved footer space, and dark branded footer on every page.

## Pagination and orientation

Group/register reports use A4 landscape and 20 rows per page. Individual/detail reports use A4 portrait. Every generated page owns its header and footer; footers are never fixed across browser-created pages.

**Why:** Fixed-position footers and browser-flow pagination caused overlaps, missing footers, and inconsistent physical pages.

**How to apply:** Explicitly chunk table rows and reserve bottom space for the footer. Keep shared pagination constants synchronized if legacy utilities still reference them.

## Safe HTML generation

All persisted or user-controlled values must be encoded with the shared HTML text/attribute helpers before interpolation. Status CSS classes must come from a whitelist, never raw record values. Note sanitization removes internal markers but does not replace HTML encoding.

**Why:** Export documents open as HTML blob pages; unescaped workspace data can become executable markup.

**How to apply:** Escape titles, branding, logo attributes, table cells, notes, event/group fields, and status labels at the point they enter report markup.

## Data-scope invariants

- Active herd reports exclude sold, culled, dead, transferred, and inactive records.
- Full-herd adult ram/ewe sections exclude animals already classified into the lamb section.
- Lamb workflow may retain animals through 365 days for 270-day actions, while lamb register PDF eligibility remains active animals at or below 240 days.
- Sold and culled reports remain strictly status-specific.
- Mating-group reports preserve every stored member ID. Missing records appear as unavailable placeholders rather than disappearing, and animal status is labeled as current status.
- Analysis reports print the active filter scope used to calculate their metrics.
- Quality selection may change logo compression, never report structure or data.

**Why:** A visually consistent document is still defective if labels, filters, counts, or historical membership do not match the underlying records.

**How to apply:** Keep selectors explicit, make report headings describe the exact included data, and add regression contracts whenever a scope boundary or derived field changes.