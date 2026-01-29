# BreedLog by Kwantam

## Overview

BreedLog is a livestock breeding and management application designed for sheep farmers. The primary purpose is to record, manage, and trace breeding lineages (family trees, bloodlines, sire/dam connections), store complete animal data (performance, reproduction, health, traits), and assist with evaluation through manual classing and optional AI valuation.

The application follows an offline-first design philosophy where core features work without internet connectivity. Only the AI valuation feature requires authentication and internet access.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with a custom dark theme (black #0B0B0B background, yellow #FFC300 accent)
- **Forms**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints defined in shared/routes.ts with Zod schemas for type-safe request/response validation
- **Build Process**: Custom build script using esbuild for server bundling and Vite for client

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (requires DATABASE_URL environment variable)
- **Schema Location**: shared/schema.ts contains all table definitions
- **Migrations**: Managed via drizzle-kit with migrations output to ./migrations folder

### Authentication
- **Method**: Replit Auth integration using OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **User Management**: Users table with automatic upsert on login

### AI Integration
- **Provider**: OpenAI API via Replit AI Integrations
- **Features**: AI valuation for livestock assessment, image generation, text-to-speech/speech-to-text
- **Gating**: AI features require authenticated user session

### Project Structure
```
client/           # React frontend application
  src/
    components/   # Reusable UI components
    hooks/        # Custom React hooks for data fetching
    pages/        # Route page components
    lib/          # Utility functions
server/           # Express backend
  replit_integrations/  # AI, auth, chat, image, audio modules
shared/           # Shared types, schemas, and route definitions
  models/         # Database model definitions
  schema.ts       # Drizzle table schemas
  routes.ts       # API route definitions with Zod schemas
```

### Key Design Patterns
- **Shared Schema**: Database schemas defined once in shared/ and used by both client and server
- **Type-Safe APIs**: Route definitions include Zod schemas for input validation and response typing
- **Storage Interface**: Database operations abstracted through storage.ts interface pattern
- **Component Library**: shadcn/ui components in client/src/components/ui/ for consistent styling

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via DATABASE_URL environment variable
- **Drizzle ORM**: Database queries and schema management
- **connect-pg-simple**: Session storage in PostgreSQL

### AI Services (via Replit AI Integrations)
- **OpenAI API**: Powers AI valuation, image generation, and audio features
- **Environment Variables**: AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL

### Authentication
- **Replit Auth**: OpenID Connect authentication
- **Environment Variables**: ISSUER_URL, REPL_ID, SESSION_SECRET

### Third-Party Libraries
- **@tanstack/react-query**: Data fetching and caching
- **Radix UI**: Accessible UI primitives (dialog, dropdown, tabs, etc.)
- **date-fns**: Date formatting and manipulation
- **recharts**: Dashboard charts and weight tracking visualization
- **csv-parse/csv-stringify**: Import/export functionality for livestock data
- **react-markdown**: Rendering AI-generated markdown content
- **@react-pdf/renderer**: PDF generation for reports

## Recent Changes (January 2026)

### Animal Record Features
- **Dam/Sire Custom Entry**: Toggle between selecting parents from dropdown or entering external parent info as text for animals not in the system
- **Photo Capture**: Separate "Camera" and "Gallery" buttons for mobile photo selection
- **Evaluation Document Upload**: Attach PDF/image evaluation documents to animal records
- **Edit Animal Dialog**: Full-featured edit dialog with all fields including photos, parentage, ownership, notes

### Ewe Breeding Statistics
- **Breeding Tab**: Comprehensive breeding stats for ewes with 12 metrics:
  - Total Matings, Lambings, Total Lambs Born, Avg Lambs/Lambing
  - Fertility Rate (%), Lambs Reared, Lambs Weaned, Lambs Lost
  - Active in Flock, Sold, Inter-Lamb Days, Total Offspring
- **Fertility Rate**: Calculated as (lambings/matings) × 100
- **Lambs Reared**: Active + Sold offspring count
- **Lambs Weaned**: Uses weaningStatus field to track weaning outcomes

### Export Profile
- **SA Stamboek-Compatible JSON**: Export animal profiles with complete data including:
  - Identification (tagId, name, tattoo, electronic ID, stud prefix)
  - Parentage (dam/sire with external parent info support)
  - Weights (birth, current, 100-day, 270-day)
  - Ownership details
  - Full breeding statistics for ewes
  - Breeding history with all events

### Farm Branding & Settings
- **Farm Settings Table**: Stores farm name, stud name, stud prefix, owner details, address, membership numbers
- **First-Time Setup**: FarmSetupDialog modal appears when no farm settings exist, collecting farm name, stud name, and stud prefix
- **Layout Branding**: Sidebar displays larger standalone logo (w-32 h-32 desktop, w-12 h-12 mobile) without text
- **Page Titles**: All pages display farm/stud name in title (e.g., "Golden Fleece - Farm Overview")
- **Settings Page**: Full editable form for all farm details including owner information and membership numbers
- **Export Integration**: Farm branding section included in SA Stamboek-compatible JSON exports

### Documents Management
- **Documents Table**: Stores uploaded documents with base64 file data, categorization, and optional animal linking
- **Document Upload**: Upload PDF, images, Word docs through Settings page with automatic base64 encoding
- **Document List**: View and manage uploaded documents with download and delete functionality
- **API Routes**: `/api/documents` GET/POST/DELETE endpoints for document management

### CSV Import
- **Bulk Animal Import**: Import animals from CSV files with flexible column mapping
- **Column Flexibility**: Accepts various column name formats (tagId, tag_id, TagID, "Tag ID")
- **Validation**: Validates required fields (tagId, sex) and provides row-by-row error reporting
- **Import Results**: Shows success count and error details after import completes
- **API Route**: `/api/import/csv` POST endpoint for CSV data processing

### My Herd & PDF Exports (January 2026)
- **My Herd Branding**: Animals tab renamed to "My Herd" throughout navigation and page titles
- **View Options**: Three view modes with toggle buttons in filter bar:
  - Detailed View: Card-based layout with photos (default)
  - List View: Table without photos showing Tag ID, Name, Sex, Breed, DOB, Status
  - Thumbnail View: Small photo grid with tag IDs below
- **Herd Export Dropdown**: Single "Export" button with dropdown options:
  - Export Full Herd (PDF) - all animals
  - Export Rams Only (PDF) - male animals only
  - Export Ewes Only (PDF) - female animals only
  - Export Lambs Only (PDF) - animals under 1 year old
- **Export PDF Format**: Tables only, no animal images, clean spacing, portrait A4 orientation
- **Professional PDF Export**: All exports follow consistent body layout rules:
  - A4 portrait format with 10mm margins
  - Left-aligned text throughout tables (no center alignment in table bodies)
  - Table-based layouts with 8-10px uniform cell padding
  - Compact 30pt row height - rows do not stretch to fill page
  - Fixed table height - table stops where data stops, leaving clean white space
  - Bold column headers with golden (#FFC300) background
  - Table headers repeat on new pages for multi-page tables
  - Footer positioned absolutely at bottom with reserved space (25-30mm padding)
  - Footer ribbon with "BREEDLOG" text and "Professional Livestock Management" tagline
- **Ewe Breeding Statistics**: When ewes present in export:
  - Tag ID, Sex, DOB, # Lambs, First Lamb Date, ILP, Lambs Weaned, Avg Wean Weight
- **Animal Profile PDF**: Individual animal certificates with table-based layout for all sections
- **Mating Groups PDF**: Report uses table-based layout for RAM identification and mating dates
- **Ewe Stats Calculation**: Uses breedingEvents with lambingDate, weaningStatus for weaned count, weight100Day for average wean weight

### Animal Images Feature (January 2026)
- **Images Tab**: Dedicated "Images" tab in individual animal profiles for photo management
- **Multiple Image Storage**: Store multiple photos per animal in dedicated `animalImages` database table
- **Image Operations**: Upload, view, and delete photos within animal profiles
- **API Endpoints**: `/api/animals/:id/images` GET/POST/DELETE for image management

### Individual Animal PDF Export
- **Professional Layout**: Large centered animal photo at top, followed by comprehensive detail table
- **Detail Table Sections**: 
  - IDENTIFICATION: Animal ID, Name, Electronic ID, Tattoo ID, Stud Prefix
  - BASIC INFORMATION: Sex, Breed, DOB, Birth Status, Current Status
  - PARENTAGE: Sire (Father), Dam (Mother)
  - GROWTH DATA: Birth/Current/100-Day/270-Day weights, Weaning Status
  - OWNERSHIP: Breeder, Owner, Farm, Location
- **Section Headers**: Golden (#FFC300) background styling matching brand
- **Family Tree Export**: Optional second page in landscape A4 format with pedigree diagram
- **Export Dropdown Options**: Export Individual (PDF), Export + Family Tree (PDF), Word Document, CSV, JSON (SA Stamboek)

### Schema Additions
- `animalImages` table: id, animalId, imageUrl (base64), caption, createdAt
- `documents` table: id, name, category, animalId (optional), fileData (base64), fileType, uploadedAt
- `farmSettings` table: Farm name, stud name, stud prefix, owner details, address, membership numbers
- `animals.createdAt`: Timestamp field tracking when animal profiles were created (displayed as "Profile Entry" in detail view)
- `externalDamInfo`: Text field for external dam information
- `externalSireInfo`: Text field for external sire information  
- `evaluationDocument`: Text field for evaluation document URLs

### Progressive Web App (PWA) - Offline-First Architecture (January 2026)

#### Core PWA Infrastructure
- **Service Worker**: `client/public/sw.js` with multi-strategy caching:
  - NetworkFirst for API routes with fallback to cache
  - CacheFirst for static assets (JS, CSS, fonts, icons)
  - StaleWhileRevalidate for app shell navigation
- **Web App Manifest**: `client/public/manifest.json` for installability with app icons
- **Service Worker Registration**: Manual registration in `client/src/main.tsx`

#### IndexedDB Offline Storage
- **Database**: `client/src/lib/indexeddb.ts` (version 2) with object stores:
  - animals, breedingEvents, healthRecords, performanceRecords
  - documents, matingGroups, tasks, animalImages, farmSettings
  - syncQueue (pending sync operations), syncMeta (sync state), offlineFlags
- **Helper Functions**: `getFromStore`, `putInStore`, `getAllFromStore`, `putManyInStore`, `addToSyncQueue`

#### Sync Manager
- **Location**: `client/src/lib/sync-manager.ts`
- **Features**:
  - Offline queue system for create/update/delete actions on all entity types
  - Automatic background sync on reconnect
  - Online/offline state detection with event listeners
  - Retry logic for failed sync operations
  - Persisted tempId-to-serverId mapping for ID reconciliation
- **Temp ID Strategy**: Offline-created records use negative timestamp IDs (e.g., -1769678301443) to avoid conflicts
- **Supported Entities**: animals, breedingEvents, matingGroups, performanceRecords, healthRecords, evaluations, farmSettings, documents

#### React Hooks with Full Offline Support
All data hooks follow consistent offline-first pattern:
- **use-animals.ts**: Animals with IndexedDB fallback and offline mutations
- **use-breeding.ts**: Breeding events with offline CRUD operations
- **use-mating-groups.ts**: Mating groups with offline storage and sync
- **use-records.ts**: Performance and health records with offline support
- **use-evaluations.ts**: Animal evaluations with offline capabilities
- **use-farm-settings.ts**: Farm settings persisted offline with sync
- **use-network-status.ts**: Hook for online/offline state and sync status
- **use-pwa-install.ts**: Hook for PWA install prompt handling

#### UI Components
- **OfflineBanner**: Yellow banner displayed when network is offline
- **NetworkStatusIndicator**: Badge showing sync status and pending count in Layout sidebar
- **PWAInstallPrompt**: Install prompt with Android (beforeinstallprompt) and iOS (Add to Home Screen) support

#### Feature Flags
- **Location**: `client/src/lib/feature-flags.ts`
- **License Modes**: free, paid, trial, offline_licensed
- **Interceptors**: Export gating for future monetization