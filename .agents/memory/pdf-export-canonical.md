---
name: PDF export canonical standard
description: Canonical template system for all BreedLog PDF exports — what it defines, what was fixed, and the rules to maintain.
---

## Canonical module
`client/src/lib/export-template.ts` — the single source of truth.
- `GROUP_ROWS_PER_PAGE = 20`
- `getCanonicalGroupCSS()` → `@page { size: A4 landscape; }`, `.page { width: 277mm; min-height: 190mm; padding-bottom: 28mm; position: relative; }`
- `getCanonicalPortraitCSS()` → `@page { size: A4 portrait; }`, `.page { width: 190mm; min-height: 277mm; ... }`
- `renderExportHeader(fb, page, total, date, title, subtitle)` → canonical header HTML
- `renderExportFooter(fb)` → dark gradient ribbon, `#FFC300` title, white BREEDLOG
- `wrapExportDocument(title, css, pagesHtml)` → full `<!DOCTYPE html>` wrapper
- `openExportPrintDialog(html)` → window.open + setTimeout(print, 500)

## Logo size (canonical)
60px × 60px in all exports. AnimalDetail.tsx was updated from 50px to 60px to match.

## Footer design rule (canonical)
```css
.footer { display: flex; align-items: center; justify-content: space-between;
  border-top: 2px solid #FFC300;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  color: white; padding: 4mm 5mm; border-radius: 2mm;
  position: absolute; bottom: 6mm; left: 6mm; right: 6mm; }
.footer-title { color: #FFC300; }
.footer-branding .breedlog-text { color: white; }
```
Pages use `padding-bottom: 28mm` to ensure content never overlaps the footer.
Footer is `position: absolute` (never `position: fixed`) — renders on every `.page` div.

## What was fixed across both sessions

### Animals.tsx
| Function | Was | Now |
|---|---|---|
| `exportRamsPDF` | Portrait, 8/page, photos | Landscape, 20/page, no photos |
| `exportEwesPDF` | Portrait, light footer, 10/page | Landscape, dark footer, 20/page |
| `exportCulledPDF` | Black bg, wrong footer | Landscape, white bg, canonical footer, 20/page |
| `exportHerdPDF` (rams/lambs) | Portrait, 25/page | Landscape, 20/page |
| `exportHerdPDF` (ewes) | Landscape ✓, 25/page | Landscape ✓, 20/page |
| `exportFullHerdPDF` | Landscape ✓, 25/page each | Landscape ✓, 20/page each |

### Lambs.tsx
Fully migrated from `getPDFStyles()`/`getPDFFooter()` old template to canonical.
Now uses: `getCanonicalGroupCSS`, `renderExportHeader`, `renderExportFooter`, `wrapExportDocument`, `openExportPrintDialog`, `GROUP_ROWS_PER_PAGE`.
Each page div gets its own header + footer. No more single fixed-position footer.

### AnimalDetail.tsx
- Logo: 50px → 60px (canonical)
- Portrait page 1: canonical dark ribbon footer, absolute bottom:6mm ✓
- Family tree page 2 (landscape): canonical dark ribbon footer ✓
- Family tree uses real `animal.sire`, `animal.dam` data. "Unknown" for missing ancestors. No fake data.

## What was NOT changed
- `pdf-utils.ts getPDFStyles/getPDFFooter` — kept because they are referenced by nothing after migration (Lambs.tsx migrated away). Functions remain for backward compat but are no longer used in active exports.
- `pdf-utils.ts chunkGroupExportRows` — still used by Lambs.tsx as a utility function.

## Key invariant
`pdf-utils.ts GROUP_EXPORT_PAGE_SIZE = 20` and `export-template.ts GROUP_ROWS_PER_PAGE = 20` must stay in sync.

## Test file
`tests/export-phase2.test.ts` — 42 export-specific tests covering all acceptance criteria.
Run with: `NODE_ENV=test USE_IN_MEMORY_STORAGE=1 tsx --test tests/export-phase2.test.ts`

## Full suite timeout (pre-existing)
`npm test` runs all 37 test files in one `tsx --test tests/*.test.ts` invocation.
Server-dependent files (invite-activation, access-code, AI assistant) each start a real Express server and run HTTP requests — combined runtime is 60–90s, which can exceed tool timeout limits.
This is 100% pre-existing. Export tests run in < 2 seconds and contain zero server overhead.
Proof: all 37 files pass when run individually or in compatible groups.
