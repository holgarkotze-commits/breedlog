# Mobile Performance Hardening (Phase 14)

## Scope
Phase 14 focused on mobile performance hardening and large-herd rendering safety, without changing business logic.

## What was inspected
- `client/src/pages/Animals.tsx`
- `client/src/components/AnimalCard.tsx`
- `client/src/hooks/use-animals.ts`
- `client/src/pages/Health.tsx`
- `client/src/pages/Analysis.tsx`
- `client/src/App.tsx`
- `shared/breedlog-simulation.ts`
- `tests/import-export-hardening.test.ts`

## What was changed
1. **Animals page export dialog now lazy-loads**
   - `PDFExportDialog` is loaded via `React.lazy` + `Suspense` instead of static top-level import.
   - This prevents export UI code from being pulled into initial Animals route evaluation.

2. **Animals page large-list rendering was windowed**
   - Added client-side visible windowing:
     - initial visible count: 50
     - load-more step: 50
   - Added a “Load more” control and visible/filtered/total count display.
   - Search and filters still run over the full fetched dataset before visible slicing.
   - Visible count resets to first window when search/filter/view state changes.

## What remains lazy-loaded
- Route-level lazy loading remains in `App.tsx` for heavier pages (`Analysis`, `Health`, `Settings`, `Animals`, etc.).
- Health Plan guide remains section-level lazy-loaded in `Health.tsx` via dynamic import when the Health Plan pane opens.

## Animals page rendering strategy
- Fetch/filter full dataset first.
- Render only first N records in DOM (`N=50` initially).
- User can progressively reveal more via “Load more”.
- This reduces initial render cost on mobile for large herds while keeping existing filter/search semantics.

## Export/PDF lazy-load status
- Export dialog component is no longer eagerly imported in `Animals.tsx`.
- Export data behavior and output logic were not changed; only load timing was adjusted.

## Simulation dataset runtime status
- `shared/breedlog-simulation.ts` remains used by tests and is not imported in normal runtime pages.

## Health Plan lazy-load status
- `health-plan-guide` remains dynamically imported inside Health page effect, gated by Health Plan pane activation.

## Analysis load status
- Analysis page continues to be route-lazy; analysis engine loads when Analysis route is opened.

## Known remaining risks
- Current load-more approach is client-side after fetch. Extremely large datasets may still benefit from server-side pagination.
- If herd sizes become very large, virtualization can further reduce memory and reconciliation cost.

## Future recommendation for very large herds
1. Add API-backed pagination for animals list.
2. Add list virtualization for dense modes (especially thumbnail/list table).
3. Consider deferring heavy section-level exports into separate code-split modules per export type.

## Manual mobile test checklist
- Open Animals page with large herd and verify fast first paint.
- Confirm only first window appears initially and “Load more” reveals more.
- Apply search and filters; ensure results are correct and visible count resets.
- Open export actions and verify PDF dialog still appears and export still works.
- Open Health page; verify Health Plan content loads only when Health Plan pane is selected.
- Open Analysis route and confirm it is isolated from home/login initial load path.
