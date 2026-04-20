import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const allowInMemoryStorage = process.env.USE_IN_MEMORY_STORAGE === "1";

if (!databaseUrl && !allowInMemoryStorage) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// When using in-memory storage, DB access is bypassed by storage.ts and these exports
// exist only to satisfy module initialization.
export const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : ({} as unknown as pg.Pool);
export const db = databaseUrl
  ? drizzle(pool, { schema })
  : ({} as unknown as ReturnType<typeof drizzle>);
