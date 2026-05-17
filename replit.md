# BreedLog

BreedLog is an offline-capable PWA for Meatmaster sheep farmers, providing comprehensive livestock breeding and management with offline functionality and automatic synchronization.

## Run & Operate

```bash
# Install dependencies
npm install

# Run the development server
npm run dev

# Build the client and server
npm run build

# Run typecheck
npm run typecheck

# Run the unit/integration test suite
npm test

# Generate Drizzle migrations
npm run generate-migrations

# Push DB schema changes
npm run db-push
```

**Required Environment Variables**:
- `ADMIN_PIN`: PIN for admin panel access.

## Stack

- **Frontend**: React, TypeScript, Vite, Wouter, TanStack React Query, shadcn/ui, Radix UI, Tailwind CSS, React Hook Form, Zod
- **Backend**: Node.js, Express, TypeScript, ESM
- **ORM**: Drizzle ORM (PostgreSQL dialect)
- **Database**: PostgreSQL
- **Validation**: Zod
- **Build Tool**: Vite (client), esbuild (server)

## Where things live

- `client/`: React frontend source code.
- `server/`: Express backend source code and API definitions.
- `shared/`: Shared types, Zod schemas (`shared/schema.ts`), and API route definitions.
- `client/src/lib/pdf-utils.ts`: PDF generation utilities.
- `client/src/components/ThemeProvider.tsx`: Theme context and logic.
- `client/src/pages/Analysis.tsx`: Data analysis and charting component.
- `client/src/lib/data-engine.ts`: Core data analysis logic.

## Architecture decisions

- **Offline-First with IndexedDB & Sync Manager**: Prioritizes responsiveness by saving all create/update operations to IndexedDB first, then synchronizing with the server. Includes robust error handling, retry mechanisms, and conflict resolution using `clientId` and `vectorClock`.
- **Device-Based Authentication**: Leverages unique device UUIDs stored locally for authentication instead of traditional user accounts, simplifying access for farmers.
- **Shared Zod Schemas**: Uses Zod for end-to-end type safety, defining API and database schemas once in `shared/` to ensure consistency between frontend and backend.
- **PWA for Installability & Offline Access**: Implements a Service Worker for intelligent caching strategies and a Web App Manifest for a native-like installable experience.
- **Themed UI with Outdoor Optimization**: Provides a flexible theme system (Light/Dark/System) with a default Light Mode optimized for outdoor visibility (high contrast, specific color palette).

## Product

- **Comprehensive Animal Management**: Record and trace breeding lineages, manage animal performance, reproduction, health, and traits, including photo and document uploads.
- **Offline Capability & Synchronization**: Full offline functionality with automatic data synchronization when connectivity is restored, featuring a manual sync option and status indicators.
- **Advanced Data Analytics**: Dashboard and data tab provide insights into herd distribution, sire/ewe performance, lamb growth, and flock trends, with adaptive charts.
- **Professional PDF Exports**: Generate detailed, branded PDF reports for individual animals, entire herds, and breeding statistics.
- **CSV Import for Bulk Data**: Facilitates easy bulk import of animal data with flexible column mapping.
- **Data Tab (formerly "Analysis")**: Premium, mobile-first, chart-led analytics page at `/data` (and legacy `/analysis`). Eight numbered, collapsible sections — each shows a one-line preview when collapsed and rich KPI tiles, ranked progress-bar lists, donut-with-center charts, gauges, and trend lines when expanded. Sections: 01 Herd Distribution, 02 Ram/Sire Performance, 03 Ewe Maternal Performance, 04 Lamb Growth Performance, 05 Flock Improvement, 06 Reproductive Efficiency, 07 Health Overview, 08 Data Quality. Filter row: season (from `animals.lambingSeason`), classification, sex. Built on `client/src/lib/data-engine.ts` (pure computation layer wrapping `analysis-engine.ts`). Reproductive metrics derive from `breedingEvents` (joined/lambed, lambing rate, lambs per ewe joined/lambed, per-mating-group breakdown, lambing spread). Health overview derives from `healthRecords` plus mortality count + survival% from `animals.status === "dead"`. Honest empty states — no fake numbers, no third-party brand references. Legacy testids `analysis-selector-panel`, `analysis-summary-cards`, `analysis-sections` retained in `client/src/pages/Analysis.tsx` for backward-compat tests.
- **Bottom Navigation Redesign**: Mobile uses a floating rounded ribbon with 5 tabs (Home, Herd, Data, Breeding, More). Active tab uses a filled primary pill. The "More" tab opens a bottom Sheet with Health, Records, Settings, Admin, and Logout. Desktop sidebar keeps all destinations and renames "Analysis" → "Data".
- **Beta Access Control**: Manages user access through invite codes, supporting multiple devices per code and offering an admin panel for code management.
- **First-Time User Onboarding**: Guides new users through initial setup and app features.

## User preferences

Preferred communication style: Simple, everyday language.

### Design Rules
- **No red on dark backgrounds**: Never use red text, red icons, or red lines/borders on dark backgrounds. Use white text and primary (yellow) icons instead for better outdoor visibility and readability.

## Gotchas

- **Offline Storage Limitations**: `checkStorageAvailability()` is crucial for detecting incognito/restricted storage modes that can prevent data persistence.
- **Cache Invalidation for API**: Service Worker explicitly bypasses all `/api/*` routes to ensure API calls always fetch fresh data.
- **Workspace Switching**: Switching between invite codes will wipe IndexedDB and reload data for the new workspace, ensuring data isolation.
- **Invite-code activation must use the shared service**: All invite-code "can this device activate?" decisions live in `server/invite-activation.ts` (`getCodeStatus`, `evaluateActivation`, `summarizeSlot`). Both the admin diagnostic lookup (`/api/admin/invite-codes/lookup/:code`) and the real activation endpoint (`/api/beta/validate`) read from this single source so they cannot disagree. The `user_activations` table has `UNIQUE(userId)` at the DB level — therefore `/api/beta/validate` does an upsert (UPDATE existing row, otherwise INSERT) when claiming a slot. Never call `createUserActivation` unconditionally; doing so re-introduces the production-only "Activation failed. Please refresh and try again." 500 after admin revoke→reactivate or reset-slot. The in-memory storage now mirrors this UNIQUE constraint, and `tests/invite-activation-universal.test.ts` is the regression suite for this whole class of bugs. All refusal paths return a structured `reasonCode` (`CODE_NOT_FOUND`, `CODE_REVOKED`, `CODE_EXPIRED`, `DEVICE_SLOT_ALREADY_USED`, `INVALID_DEVICE_TYPE`, `ACTIVATION_STATE_MISMATCH`, `UNKNOWN_ACTIVATION_ERROR`) alongside the human message.

## Pointers

- **Replit AI Integrations**: Refer to Replit's documentation for integrating OpenAI API for AI features.
- **Drizzle ORM Docs**: For advanced database schema definitions and migrations.
- **React Query Docs**: For understanding server state management and cache invalidation.
- **Zod Docs**: For robust schema validation.
- **Tailwind CSS Docs**: For UI styling and customization.
- **PWA Standards**: For detailed information on Service Workers, Web App Manifests, and offline-first strategies.
