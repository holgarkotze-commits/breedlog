---
name: Genetics module DB bootstrap
description: How to create/fix the genetics tables when db:push cannot run non-interactively, and runtime pitfalls.
---

# Genetics Module DB Bootstrap

## The problem with db:push
`npm run db:push` prompts interactively when adding a unique constraint to a table with existing rows (e.g. `users_device_id_unique`). It cannot be piped non-interactively — the sandbox terminates it. Use direct SQL instead.

## Manual table creation (safe pattern)
```sql
CREATE TABLE IF NOT EXISTS bloodlines (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'unknown',
  origin_farm_or_breeder TEXT,
  foundation_animal_id INTEGER,   -- MUST include even though optional
  selected_traits TEXT,
  known_weaknesses TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  evidence_status TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Why:** Drizzle ORM generates INSERT statements that can include any column defined in the schema. If the DB table is missing even an optional column, the insert fails with a 500 at runtime (column does not exist). Always compare `information_schema.columns` against the Drizzle schema after manual creation and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for any gaps.

## Invite code expiry
The master simulation code `U2A2ZAVQ` has an expiry date in the DB. As of July 2026 it was set to 2027-12-31. If E2E tests fail with "CODE_EXPIRED", run:
```sql
UPDATE invite_codes SET expires_at = '2027-12-31' WHERE code = 'U2A2ZAVQ';
```

## InMemoryStorage export
`InMemoryStorage` was not exported from `server/storage.ts`. Tests that import it directly need the class exported (`export class InMemoryStorage`). Tests use `node:test` + `node:assert/strict`, NOT vitest.

## setAnimalBloodline signature
The interface is `setAnimalBloodline(userId: string, data: InsertAnimalBloodline)` — data is an object `{animalId, bloodlineId, role}`, NOT positional args.
`removeAnimalBloodline(userId, id)` takes the assignment row ID, not the bloodlineId.
