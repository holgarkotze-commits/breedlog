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
- **Beta Access Control**: Controlled access via invite codes with expiry (default 30 days), max 10 testers, single-device-per-code restriction, 7-day offline grace period, and admin panel for code management. Beta access query always attempts server contact (not gated by `navigator.onLine` since it's unreliable on mobile). "Retry Connection" button is always enabled and performs a real server ping.
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