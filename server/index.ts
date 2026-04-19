import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

// Increase payload size limits for image uploads
httpServer.maxHeadersCount = 0;
httpServer.headersTimeout = 120000;
httpServer.requestTimeout = 120000;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Configure body parsers with large limits for base64 image data
app.use(
  express.json({
    limit: '100mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: true, limit: '100mb', parameterLimit: 50000 }));
app.use(express.text({ limit: '100mb' }));
app.use(express.raw({ limit: '100mb' }));

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

  const client = await pool.connect();
  try {
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
        expires_at timestamp NOT NULL,
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

    // Add shared_user_id to users table (added for shared workspace feature)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS shared_user_id varchar;
    `);
    // Add device_type to user_activations table (added for 1-desktop+1-mobile slot model)
    await client.query(`
      ALTER TABLE user_activations ADD COLUMN IF NOT EXISTS device_type varchar DEFAULT 'unknown';
    `);
    console.log("[Startup] Schema migrations applied successfully");
  } catch (err) {
    console.error("[Startup] Migration error:", err);
    throw err;
  } finally {
    client.release();
  }
}

(async () => {
  await runStartupMigrations();
  await registerRoutes(httpServer, app);

  // Global error handler - always returns JSON
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`[Error] ${status}: ${message}`, err.stack || '');
    
    // Always return JSON for API errors
    if (!res.headersSent) {
      res.status(status).json({ message, error: true });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
