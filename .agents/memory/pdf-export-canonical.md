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

## What was fixed in Animals.tsx
| Function | Was | Now |
|---|---|---|
| `exportRamsPDF` | Portrait, 8/page, photos | Landscape, 20/page, no photos |
| `exportEwesPDF` | Portrait, light footer, 10/page | Landscape, dark footer, 20/page |
| `exportCulledPDF` | Black bg, wrong footer | Landscape, white bg, canonical footer, 20/page |
| `exportHerdPDF` (rams/lambs) | Portrait, 25/page | Landscape, 20/page |
| `exportHerdPDF` (ewes) | Landscape ✓, 25/page | Landscape ✓, 20/page |
| `exportFullHerdPDF` | Landscape ✓, 25/page each | Landscape ✓, 20/page each |

## What was NOT changed
- `AnimalDetail.tsx handleExportPDF` — already portrait with canonical dark footer ✓
- `Lambs.tsx handlePDFExport` — uses `getPDFStyles()` + `getPDFFooter()` from pdf-utils.ts; kept as-is to avoid breaking the getPDFFooter test assertion
- `pdf-utils.ts getPDFStyles/getPDFFooter` — kept for Lambs.tsx backward compat

## Key invariant
`pdf-utils.ts GROUP_EXPORT_PAGE_SIZE = 20` and `export-template.ts GROUP_ROWS_PER_PAGE = 20` must stay in sync.

**Why:** Tests check both values, and Lambs.tsx uses GROUP_EXPORT_PAGE_SIZE while new exports use GROUP_ROWS_PER_PAGE.
