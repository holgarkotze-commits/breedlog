import pg from "pg";
import { spawnSync } from "node:child_process";

// Reuse the existing public-repository CI PostgreSQL service. No workflow
// permission expansion or new hosted database is necessary. Local runs skip.
if (process.env.CI !== "true") {
  console.log("[Onboarding SQL] Skipped: requires the disposable CI PostgreSQL service.");
} else {
  if (!process.env.DATABASE_URL) throw new Error("The CI certification database is missing.");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query("SELECT current_database() AS name");
    if (result.rows[0].name !== "breedlog_test") {
      throw new Error("Refusing SQL certification outside the disposable breedlog_test database.");
    }
  } finally {
    await pool.end();
  }
  for (const script of ["db:push", "test:onboarding-db"]) {
    const result = spawnSync("npm", ["run", script], {
      stdio: "inherit", timeout: 120_000,
      env: { ...process.env, BREEDLOG_ISOLATED_SQL_CERT: "1" },
    });
    if (result.status !== 0) {
      console.error(`[Onboarding SQL] ${script} failed; no release pass can be claimed.`);
      process.exit(result.status || 1);
    }
  }
}
