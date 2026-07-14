import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

httpServer.maxHeadersCount = 0;
httpServer.headersTimeout = 120000;
httpServer.requestTimeout = 120000;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Remove fingerprinting header
app.disable("x-powered-by");

const TRUSTED_NATIVE_APP_ORIGINS = new Set([
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
  "capacitor://localhost",
  "http://localhost",
]);

function resolveCorsOrigin(originHeader: string | undefined) {
  if (!originHeader) return null;
  if (TRUSTED_NATIVE_APP_ORIGINS.has(originHeader)) {
    return originHeader;
  }
  const configuredOrigins = (process.env.BREEDLOG_CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configuredOrigins.includes(originHeader) ? originHeader : null;
}

// Trust proxy in production (Replit uses a reverse proxy)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Gzip/brotli compression for all responses
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// Security headers — applied to every response
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=*,microphone=(),geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = resolveCorsOrigin(req.headers.origin);
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Admin-Pin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }
  if (req.method === "OPTIONS" && req.path.startsWith("/api/")) {
    return res.sendStatus(204);
  }
  return next();
});

// Rate limiting — auth/activation endpoints (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

// Rate limiting — admin endpoints (moderate)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

// Rate limiting — general API (generous, just prevents abuse)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
  skip: () => process.env.NODE_ENV === "test",
});

app.use("/api/beta/validate", authLimiter);
app.use("/api/device/register", authLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api", apiLimiter);

// Body parsers — 10 MB covers compressed base64 images with room to spare
app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb", parameterLimit: 10000 }));
app.use(express.text({ limit: "10mb" }));
app.use(express.raw({ limit: "10mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function runStartupMigrations() {
  if (process.env.USE_IN_MEMORY_STORAGE === "1" && !process.env.DATABASE_URL) {
    console.log("[Startup] Using in-memory storage mode; skipping SQL migrations");
    return;
  }

  // Serialize concurrent startups. The CI test suite boots several server
  // processes against the same database in parallel; concurrent
  // CREATE TABLE IF NOT EXISTS statements race inside Postgres and one of
  // them fails with 23505 on pg_type_typname_nsp_index. A session-level
  // advisory lock makes whichever process gets there first run the
  // migrations while the others wait, then run the same (now no-op) DDL.
  const MIGRATION_LOCK_KEY = 812739041; // arbitrary app-wide constant

  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    // Ensure baseline schema exists (supports clean dev/test boot with in-memory DB)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id varchar UNIQUE,
        device_name varchar,
        shared_user_id varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        last_seen_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar PRIMARY KEY,
        sess jsonb NOT NULL,
        expire timestamp NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL UNIQUE,
        password_hash text,
        auth_provider varchar(32) NOT NULL DEFAULT 'local',
        email_verified boolean NOT NULL DEFAULT false,
        email_verified_at timestamp,
        recovery_required boolean NOT NULL DEFAULT false,
        google_subject varchar(255) UNIQUE,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        last_login_at timestamp
      );

      CREATE TABLE IF NOT EXISTS account_workspaces (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id varchar NOT NULL UNIQUE REFERENCES accounts(id),
        workspace_user_id varchar NOT NULL UNIQUE REFERENCES users(id),
        legacy_device_user_id varchar REFERENCES users(id),
        migration_source varchar(32) NOT NULL DEFAULT 'managed_account',
        migration_state varchar(32) NOT NULL DEFAULT 'completed',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS account_devices (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id varchar NOT NULL REFERENCES accounts(id),
        workspace_user_id varchar NOT NULL REFERENCES users(id),
        device_user_id varchar NOT NULL REFERENCES users(id),
        device_id varchar(128) NOT NULL UNIQUE,
        device_name text,
        platform varchar(32),
        auth_provider varchar(32) NOT NULL DEFAULT 'local',
        status varchar(32) NOT NULL DEFAULT 'active',
        last_seen_at timestamp DEFAULT now(),
        revoked_at timestamp,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS account_tokens (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id varchar NOT NULL REFERENCES accounts(id),
        token_type varchar(32) NOT NULL,
        token_hash varchar(128) NOT NULL,
        expires_at timestamp NOT NULL,
        consumed_at timestamp,
        metadata jsonb,
        created_at timestamp DEFAULT now(),
        UNIQUE(token_type, token_hash)
      );

      CREATE TABLE IF NOT EXISTS account_audit_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id varchar REFERENCES accounts(id),
        workspace_user_id varchar REFERENCES users(id),
        device_id varchar(128),
        event_type varchar(64) NOT NULL,
        result varchar(32) NOT NULL DEFAULT 'success',
        detail text,
        metadata jsonb,
        occurred_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS invite_codes (
        id serial PRIMARY KEY,
        code varchar NOT NULL UNIQUE,
        expires_at timestamp NOT NULL,
        max_uses integer NOT NULL DEFAULT 1,
        uses_count integer NOT NULL DEFAULT 0,
        max_devices integer NOT NULL DEFAULT 2,
        status varchar DEFAULT 'active',
        notes text,
        created_at timestamp DEFAULT now(),
        last_validated_at timestamp
      );

      CREATE TABLE IF NOT EXISTS user_activations (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        device_id varchar NOT NULL UNIQUE,
        invite_code_id integer NOT NULL REFERENCES invite_codes(id),
        activated_at timestamp DEFAULT now(),
        expires_at timestamp,
        last_seen_at timestamp DEFAULT now(),
        status varchar DEFAULT 'active',
        device_type varchar DEFAULT 'unknown'
      );

      CREATE TABLE IF NOT EXISTS animals (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        tag_id text NOT NULL,
        tattoo_id text,
        electronic_id text,
        sex text NOT NULL,
        status text DEFAULT 'active',
        name text,
        breed text DEFAULT 'Meatmaster',
        lamb_status text DEFAULT 'active',
        ram_lamb_class text,
        ram_type text,
        cull_confirmed boolean DEFAULT false,
        cull_date date,
        cull_reason text,
        removal_reason text,
        birth_date date,
        dam_id integer,
        sire_id integer,
        notes text,
        created_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS breeding_events (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        ewe_id integer NOT NULL,
        ram_id integer NOT NULL,
        mating_group_id integer,
        mating_date date NOT NULL,
        mating_type text NOT NULL,
        lambing_date date,
        lamb_count integer,
        notes text
      );

      CREATE TABLE IF NOT EXISTS mating_groups (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        ram_id integer NOT NULL,
        ewe_ids integer[],
        date_in date NOT NULL,
        date_out date,
        lambing_season text,
        environment_group text,
        management_group text,
        status text DEFAULT 'active',
        notes text
      );

      CREATE TABLE IF NOT EXISTS performance_records (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        animal_id integer NOT NULL,
        date date NOT NULL,
        weight decimal,
        age_days integer,
        type text,
        trait_notes text,
        notes text
      );

      CREATE TABLE IF NOT EXISTS health_records (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        animal_id integer NOT NULL,
        date date NOT NULL,
        type text NOT NULL,
        treatment text,
        notes text
      );

      CREATE TABLE IF NOT EXISTS farm_settings (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL UNIQUE REFERENCES users(id),
        farm_name text,
        stud_name text,
        owner_name text,
        location text
      );

      CREATE TABLE IF NOT EXISTS documents (
        id serial PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        animal_id integer,
        category text NOT NULL,
        title text NOT NULL,
        description text,
        file_data text NOT NULL,
        file_type text NOT NULL,
        uploaded_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id serial PRIMARY KEY,
        key varchar UNIQUE,
        value text NOT NULL,
        description text,
        updated_at timestamp DEFAULT now()
      );
    `);

    // Incremental schema migrations
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS shared_user_id varchar;
    `);
    await client.query(`
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_hash text;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auth_provider varchar(32) NOT NULL DEFAULT 'local';
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamp;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS recovery_required boolean NOT NULL DEFAULT false;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS google_subject varchar(255);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'active';
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login_at timestamp;
    `);
    await client.query(`
      ALTER TABLE account_workspaces ADD COLUMN IF NOT EXISTS legacy_device_user_id varchar;
      ALTER TABLE account_workspaces ADD COLUMN IF NOT EXISTS migration_source varchar(32) NOT NULL DEFAULT 'managed_account';
      ALTER TABLE account_workspaces ADD COLUMN IF NOT EXISTS migration_state varchar(32) NOT NULL DEFAULT 'completed';
      ALTER TABLE account_workspaces ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
      ALTER TABLE account_workspaces ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
    `);
    await client.query(`
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS workspace_user_id varchar REFERENCES users(id);
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS device_user_id varchar REFERENCES users(id);
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS device_name text;
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS platform varchar(32);
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS auth_provider varchar(32) NOT NULL DEFAULT 'local';
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS status varchar(32) NOT NULL DEFAULT 'active';
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS last_seen_at timestamp DEFAULT now();
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS revoked_at timestamp;
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
      ALTER TABLE account_devices ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();
    `);
    await client.query(`
      ALTER TABLE account_tokens ADD COLUMN IF NOT EXISTS metadata jsonb;
      ALTER TABLE account_tokens ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
    `);
    await client.query(`
      ALTER TABLE account_audit_events ADD COLUMN IF NOT EXISTS workspace_user_id varchar REFERENCES users(id);
      ALTER TABLE account_audit_events ADD COLUMN IF NOT EXISTS device_id varchar(128);
      ALTER TABLE account_audit_events ADD COLUMN IF NOT EXISTS result varchar(32) NOT NULL DEFAULT 'success';
      ALTER TABLE account_audit_events ADD COLUMN IF NOT EXISTS detail text;
      ALTER TABLE account_audit_events ADD COLUMN IF NOT EXISTS metadata jsonb;
      ALTER TABLE account_audit_events ADD COLUMN IF NOT EXISTS occurred_at timestamp DEFAULT now();
    `);
    await client.query(`
      ALTER TABLE user_activations ADD COLUMN IF NOT EXISTS device_type varchar DEFAULT 'unknown';
      ALTER TABLE user_activations ADD COLUMN IF NOT EXISTS last_online_check timestamp DEFAULT now();
      ALTER TABLE user_activations ADD COLUMN IF NOT EXISTS offline_grace_start timestamp;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_activations' AND column_name = 'expires_at'
        ) THEN
          ALTER TABLE user_activations ALTER COLUMN expires_at DROP NOT NULL;
        END IF;
      END $$;
    `);
    await client.query(`
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS raw_tag text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS stud_prefix text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS classification text DEFAULT 'unclassified';
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS animal_source text DEFAULT 'unknown_not_recorded';
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS photo text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS ram_breeding_status text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS birth_status text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS external_dam_info text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS external_sire_info text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS evaluation_document text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS lambing_season text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS environment_group text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS management_group text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS birth_weight decimal;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS birth_weight_estimated boolean DEFAULT false;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS current_weight decimal;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight_100_day decimal;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight_100_day_date date;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight_100_day_estimated boolean DEFAULT false;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight_270_day decimal;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS weight_270_day_date date;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS weaning_status text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS breeder_name text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS owner_name text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS farm_name text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS location text;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS client_id varchar(64);
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS vector_clock jsonb;
      ALTER TABLE animals ADD COLUMN IF NOT EXISTS last_synced_at timestamp;
    `);

    // Performance indexes — dramatically speed up per-user queries at scale
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_animals_user_id        ON animals(user_id);
      CREATE INDEX IF NOT EXISTS idx_animals_user_tag        ON animals(user_id, tag_id);
      CREATE INDEX IF NOT EXISTS idx_breeding_events_user_id ON breeding_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_breeding_events_ewe     ON breeding_events(user_id, ewe_id);
      CREATE INDEX IF NOT EXISTS idx_health_records_user_id  ON health_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_health_records_animal   ON health_records(user_id, animal_id);
      CREATE INDEX IF NOT EXISTS idx_perf_records_user_id    ON performance_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_perf_records_animal     ON performance_records(user_id, animal_id);
      CREATE INDEX IF NOT EXISTS idx_mating_groups_user_id   ON mating_groups(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expire         ON sessions(expire);
      CREATE INDEX IF NOT EXISTS idx_user_activations_user   ON user_activations(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activations_device ON user_activations(device_id);
      CREATE INDEX IF NOT EXISTS idx_account_devices_account ON account_devices(account_id);
      CREATE INDEX IF NOT EXISTS idx_account_tokens_account ON account_tokens(account_id);
      CREATE INDEX IF NOT EXISTS idx_account_audit_account ON account_audit_events(account_id, occurred_at);
    `);

    console.log("[Startup] Schema migrations and indexes applied successfully");
  } catch (err) {
    console.error("[Startup] Migration error:", err);
    throw err;
  } finally {
    // Release the advisory lock before returning the connection to the pool.
    // If the connection is already broken the unlock is a no-op (session
    // locks die with the session), so a failure here is safe to swallow.
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

(async () => {
  await runStartupMigrations();
  await registerRoutes(httpServer, app);

  // Global error handler — always returns JSON, never leaks stack traces in production
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message =
      process.env.NODE_ENV === "production" && status >= 500
        ? "Internal Server Error"
        : err.message || "Internal Server Error";

    if (process.env.NODE_ENV !== "production") {
      console.error(`[Error] ${status}: ${err.message}`, err.stack || "");
    } else {
      console.error(`[Error] ${status}: ${err.message}`);
    }

    if (!res.headersSent) {
      res.status(status).json({ message, error: true });
    }
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else if (process.env.NODE_ENV !== "test") {
    // Certification tests exercise API behavior only. Skipping Vite in test mode
    // keeps server startup deterministic and avoids parallel dev-server pressure.
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || (process.env.NODE_ENV === "test" ? "127.0.0.1" : "0.0.0.0");
  httpServer.listen(
    {
      port,
      host,
      reusePort: process.platform !== "win32",
    },
    () => {
      log(`serving on ${host}:${port}`);
    },
  );
})();
