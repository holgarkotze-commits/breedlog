---
name: Responsive hardening decisions
description: Key layout and touch-optimization decisions made during the mobile/tablet/desktop hardening pass.
---

## Sidebar breakpoint
- Sidebar is shown at `lg:` (1024px), NOT `md:` (768px).
- Tablets (768–1023px) use the mobile bottom-nav layout — wider content area, same bottom ribbon.
- All sidebar-related classes: `lg:fixed`, `lg:flex`, `lg:ml-72`, `lg:min-h-screen`, `lg:hidden` for the header/bottom-nav.

**Why:** A 768px sidebar consumed too much horizontal real estate on iPad portrait (768px). Keeping bottom-nav up to 1024px gives tablets full content width with thumb-friendly navigation.

## Custom Tailwind breakpoints (tailwind.config.ts)
- `xs: "480px"` — small phones (iPhone SE, Galaxy mini). Use for form grids: `xs:grid-cols-2`.
- `tablet: "768px"` — tablets, used for main content padding: `tablet:px-5`.
- `laptop: "1024px"` — alias for `lg`, use when semantics matter.

## Touch targets
- Global CSS (`index.css`) sets `min-height: 44px` for all buttons/inputs/selects on `< 640px`.
- `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` applied to `*` to eliminate 300ms tap delay and flash.
- Input/Select `h-9` upgraded to `h-10` in shadcn component files (input.tsx, select.tsx).
- Bottom-nav items use `min-h-[3rem]` (48px) and `touch-manipulation`.

## Input font-size on mobile
- `font-size: 16px` set on inputs for `< 640px` to prevent iOS Safari auto-zoom on focus.

## Form grid pattern
- All 2-column side-by-side form fields use `grid grid-cols-1 xs:grid-cols-2 gap-4`.
- This ensures full-width fields on iPhone SE (320–479px), side-by-side on 480px+.
- Files fixed: Animals.tsx (5 grids), Breeding.tsx (3), MatingGroupDetail.tsx (1), Settings.tsx (1), Genetics.tsx (BloodlineDialog, MatingRiskTab).

## Main content padding
- Mobile: `px-4 py-4` (16px — up from 10px / p-2.5).
- Tablet: `tablet:px-5 tablet:py-5` (20px).
- Desktop: `lg:px-8 lg:py-8` (32px).

## HMR WebSocket warning in Replit preview
- "WebSocket connection failed: Unexpected response code: 400" is a known Replit preview iframe limitation. Does NOT affect app functionality. App loads and API calls work correctly.
