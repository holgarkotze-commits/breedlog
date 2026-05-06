# BreedLog by Kwantam

## Overview

BreedLog is an offline-capable Progressive Web App (PWA) designed for Meatmaster sheep farmers. Its core purpose is to provide comprehensive livestock breeding and management, including recording and tracing breeding lineages, managing animal data (performance, reproduction, health, traits), and attaching evaluation documents. The application functions entirely offline, with automatic synchronization upon regaining connectivity, and is installable across various devices. The project aims to offer a robust, user-friendly tool for efficient livestock management.

## User Preferences

Preferred communication style: Simple, everyday language.

### Design Rules
- **No red on dark backgrounds**: Never use red text, red icons, or red lines/borders on dark backgrounds. Use white text and primary (yellow) icons instead for better outdoor visibility and readability.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite for building.
- **Routing**: Wouter.
- **State Management**: TanStack React Query for server state.
- **UI Components**: shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with a custom dark theme (black background, yellow accent).
- **Forms**: React Hook Form with Zod validation.
- **PWA Features**: Service Worker for caching (NetworkFirst for API, CacheFirst for static assets, StaleWhileRevalidate for app shell), Web App Manifest for installability, IndexedDB for offline data storage (animals, breedingEvents, healthRecords, etc.), and a Sync Manager for offline queueing and background synchronization.
- **Offline-First Architecture**: All create/update operations save to IndexedDB first for instant response, then attempt immediate server persistence when online, falling back to sync queue on failure. Sync manager uses exponential backoff (3 retries, 2-30 second delay). React Query caches are automatically invalidated after successful sync to refresh temp IDs.
- **Manual Sync Controls**: 
  - Global Refresh button in header/sidebar triggers `performFullSyncAction()` with lie-fi detection (5s timeout backend ping)
  - Settings → Data & Sync section with "Sync Now (Online Only)" and "Reload Data View" buttons
  - Status indicator badge (green=synced, yellow=pending/failed items, red=backend unreachable)
  - Error classification: 4xx errors = permanent failures (removed from queue), 5xx/network = retryable (kept in queue)
  - Toast feedback shows accurate sync state (SYNC_COMPLETE, SYNC_PARTIAL_ERROR, OFFLINE_MODE)
- **Storage Resilience**: `checkStorageAvailability()` detects incognito/restricted storage mode with dismissible warning banner
- **UI/UX**: Responsive design, custom branding with farm settings, and a consistent layout for PDF exports including specific font, spacing, and header styling. Pedigree/Family Tree view uses responsive CSS-based connectors.
- **Theme System**: Light/Dark/System switcher with persistent localStorage preference (`breedlog_theme`). `ThemeProvider` (`client/src/components/ThemeProvider.tsx`) applies `.light` or `.dark` class to `<html>`. Default is Light Mode (outdoor-optimised: #F6F8FA background, #1E4ED8 blue primary, high contrast). Dark mode retains original yellow (#FFC300) branding. Toggle available in Settings → Appearance section. Dashboard charts also adapt colors per theme.

### Backend
- **Runtime**: Node.js with Express.
- **Language**: TypeScript with ESM modules.
- **API Design**: RESTful endpoints defined with Zod schemas for type-safe validation.
- **Build Process**: Custom esbuild script for server, Vite for client.

### Data Layer
- **ORM**: Drizzle ORM (PostgreSQL dialect).
- **Database**: PostgreSQL.
- **Schema**: Defined in `shared/schema.ts`.
- **Sync Hardening**: `animals`, `breedingEvents`, and `documents` tables include `clientId` (unique varchar for dedup), `vectorClock` (jsonb for conflict resolution), and `lastSyncedAt` (timestamp for sync tracking).
- **Migrations**: Managed via drizzle-kit.

### Authentication
- **Device-Based Authentication**: No user accounts required. Each device gets a unique UUID on first launch.
  - Device ID is generated client-side using `crypto.randomUUID()` and stored in localStorage.
  - Device is auto-registered on first launch, creating a user record in the database.
  - **Token-Based Auth**: All API calls use `Authorization: Bearer <deviceToken>` header (stored in localStorage as `breedlog_device_token`).
  - PostgreSQL-backed sessions via connect-pg-simple (fallback).
- **Beta Access Control**: Devices must enter an invite code to access the app.
  - Admin panel at `/admin` is protected by ADMIN_PIN environment variable (bypasses beta access gate).
  - Invite codes are single-use and bind to specific device IDs.
  - Invite code fields: code, status, expiresAt, maxUses, usesCount, maxDevices, notes.
  - 7-day offline grace period for continued access without internet.
- **Cache Busting**: 
  - Service Worker bypasses ALL `/api/*` routes (no SW caching for API calls).
  - `/api/version` endpoint returns app version; client auto-reloads on version mismatch.
  - Admin panel shows PRODUCTION MODE or DEVELOPMENT MODE badge based on server environment.

### AI Integration
- OpenAI API via Replit AI Integrations for image generation and text-to-speech/speech-to-text.
- AI features are gated, requiring an authenticated user session.

### Project Structure
- `client/`: React frontend.
- `server/`: Express backend, including Replit integrations for AI, auth, chat, image, audio.
- `shared/`: Shared types, schemas, and API route definitions.

### Key Design Patterns
- **Shared Schema**: Database schemas are defined once and used by both client and server for consistency.
- **Type-Safe APIs**: Zod schemas ensure robust input validation and response typing for API routes.
- **Storage Interface**: Database operations are abstracted for maintainability.
- **Offline-First**: All data hooks are designed to support offline CRUD operations with automatic synchronization.
- **Component Library**: Consistent UI through shadcn/ui.

### Core Features
- **Animal Records**: Comprehensive animal data management, including Dam/Sire custom entry, photo capture, evaluation document uploads, and a full-featured edit dialog.
- **Ewe Breeding Statistics**: Detailed breeding statistics for ewes (e.g., Fertility Rate, Lambs Reared, Inter-Lamb Days).
- **Farm Branding & Settings**: Customizable farm details (name, stud, owner) stored and integrated into exports and UI.
- **Documents Management**: Upload, view, and delete various document types with optional animal linking.
- **CSV Import**: Bulk animal import with flexible column mapping and validation.
- **My Herd View**: Multiple view modes (Detailed, List, Thumbnail) and advanced filtering. Collapsible section ribbons with lazy rendering (Total Herd wrapper with Rams/Ewes/Lambs/Culled Archive subsections). Supports `?section=total/rams/ewes/lambs/culled` URL param to auto-expand a section on load (used by Dashboard deep-links).
- **Culled Archive Section**: Dedicated "Culled Archive" collapsible section in My Herd (alongside Rams/Ewes/Lambs) showing animals with status='culled' or cullConfirmed=true. Includes searchable table with cull date/reason, and PDF export.
- **PDF Exports**: Professional PDF generation for individual animal profiles, full herd, rams, ewes, lambs, mating groups, and ewe breeding statistics. Features include:
  - Row numbering for list exports
  - Quality selector (low/medium/high) for file size optimization
  - Image compression utilities in `client/src/lib/pdf-utils.ts`
  - Consistent footer with farm branding and "BREEDLOG" tagline
  - Fixed positioning footers on each page
- **Image Viewer**: Mobile pinch-to-zoom support for animal photos with zoom controls, rotation, and double-tap to reset.
- **Animal Images**: Store and manage multiple photos per animal.
- **Automatic Animal Categorization**: Animals automatically transition from "Lambs" to "Rams/Ewes" at 240 days (8 months) based on birth date. Sex can only be Ram or Ewe (no Lamb/wether option).
- **First-Time User Onboarding**: 4-step wizard guides new users through farm setup, first animal entry, and app tips. Detects first-time users via IndexedDB metadata.
- **Production Reset**: Settings → Advanced → Reset All Data allows complete database wipe with confirmation phrase ("RESET BREEDLOG"). Clears both server database and IndexedDB offline stores.
- **Empty State UX**: Dashboard and My Herd show friendly empty states with action buttons when no animals exist.
- **Beta Access Control**: Controlled access via invite codes with expiry (default 30 days), 7-day offline grace period, and admin panel for code management. Beta access query always attempts server contact (not gated by `navigator.onLine` since it's unreliable on mobile). "Retry Connection" button is always enabled and performs a real server ping.
  - Each code allows **1 desktop + 1 mobile device** (2 total, tracked separately via `device_type` column in `user_activations` table)
  - Device type detected from User-Agent header (mobile = Android/iPhone/iPad/Mobile keywords)
  - Slot enforcement uses actual active-slot count (not usesCount), so old codes with maxUses=1 no longer block the mobile slot
  - **Logout**: `Layout.tsx` has logout button in desktop sidebar (data-testid=button-logout-desktop) and mobile header (button-logout-mobile). Logout calls POST `/api/beta/logout` (destroys server session), clears `breedlog_device_token` and `breedlog_beta_access` from localStorage, then uses `queryClient.setQueryData` to immediately show the code entry screen without a page reload. `breedlog_device_id` is kept so the same device can re-login with the same code.
  - **Same-device re-login**: After logout, the device's activation remains `active` on the server. Re-entering the same code returns "Already activated" + a fresh token — no new slot consumed.
  - **Cross-code workspace switching**: `/api/beta/validate` distinguishes same-code re-login from a switch to a *different* code. On a switch, the existing `user_activations` row (UNIQUE on userId) is updated in place to point at the new code, the device's `sharedUserId` is recomputed for the new workspace, and the new `userId` is returned to the client so `ensureUserIsolation` can wipe IndexedDB and load the new workspace. Per-code workspace identity is persisted in `system_settings` under key `workspace:invite_code:<id>`, so a device that switches codes and later switches back lands on the same workspace data. Switching to a code with no available slot / expired / non-existent fails cleanly without falling back to the old workspace.
  - Admin can reset individual device slots (desktop or mobile) without deleting farm data
  - **Code Diagnostic Lookup** tool in admin panel — type any code to instantly verify if it exists in DB and see which slots are taken/free
  - Non-existent codes display clearly as "not found in database" with actionable hints
  - **License model**: 1 invite code = 1 workspace allowing 1 desktop + 1 mobile slot. Code-level status (Active / Revoked / Expired) is independent of slot occupancy — a code with both slots taken is still "Active" (just no free slots). The legacy `usesCount >= maxUses` "max uses reached" check has been removed from the diagnostic; slot availability per device type is the only source of truth (`server/routes.ts` `getCodeStatus()` + `/api/admin/invite-codes/lookup/:code`).
  - **Data-safe admin actions**: `POST /api/admin/invite-codes/:id/reactivate` (unrevoke / unexpire, optionally extends expiry) and `POST /api/admin/invite-codes/:id/extend-expiry` (`{days}` or `{expiresAt}`). Neither touches `user_activations`, `animals`, `users`, or `system_settings`. The persisted `workspace:invite_code:<id>` mapping ensures devices that re-enter a reactivated code land back on the original workspace data.
  - **Diagnostic returns**: `codeStatus`, `blockReason`, `licenseActivatedAt` (earliest active activation), per-slot `{taken, canActivate, reason, deviceId, activatedAt}`, and `workspace.{userId, animalCount}` — no contradictory "Not Valid: max uses" labels.
- **User Data Isolation**: All data tables have userId columns ensuring complete separation between users' farm data.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **Drizzle ORM**: ORM for database interaction.
- **connect-pg-simple**: For PostgreSQL-backed session storage.

### AI Services
- **OpenAI API**: Used for image generation and audio functionalities, integrated via Replit AI Integrations.

### Authentication
- **Device-Based Auth**: UUID-based device identification with ADMIN_PIN for admin access.

### Third-Party Libraries
- **@tanstack/react-query**: Data fetching and caching.
- **Radix UI**: Accessible UI primitives.
- **date-fns**: Date manipulation.
- **recharts**: Charting for data visualization.
- **csv-parse/csv-stringify**: CSV import/export.
- **react-markdown**: Rendering markdown content.
- **@react-pdf/renderer**: PDF document generation.