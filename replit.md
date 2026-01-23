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