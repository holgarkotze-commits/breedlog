import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
const { Pool } = pg;

// This test proves the seed script's --access-code resolver maps a code
// (e.g. "U2A2ZAVQ") to the real shared workspace owner userId, not the
// literal code string. Without this, seeded animals would be orphaned under
// userId="U2A2ZAVQ" and invisible to every real user/device.
//
// Strategy: create a throwaway invite code + user + activation in the dev DB,
// run the seed script in dry-run mode with --access-code, parse the JSON
// report, and assert the resolved targetUserId equals the activation's userId.
// Then clean up.

const DATABASE_URL = process.env.DATABASE_URL;
const REQUIRES_DB = !!DATABASE_URL;

const skipIfNoDb = REQUIRES_DB ? test : test.skip;

skipIfNoDb("seed --access-code resolves to real shared workspace userId, not the literal code string", async () => {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const codeText = `RES${randomUUID().slice(0, 5).toUpperCase()}`;
  const userId = randomUUID();
  const deviceId = randomUUID();
  let inviteCodeId: number | null = null;

  try {
    // Insert throwaway user
    await pool.query(
      `INSERT INTO users (id, device_id, device_name, created_at, last_seen_at) VALUES ($1, $2, 'seed-test-device', NOW(), NOW())`,
      [userId, deviceId],
    );

    // Insert throwaway invite code (expires in 30 days, max_devices=2)
    const codeRes = await pool.query(
      `INSERT INTO invite_codes (code, status, expires_at, max_uses, uses_count, max_devices, notes, created_at)
       VALUES ($1, 'active', NOW() + INTERVAL '30 days', 2, 1, 2, 'seed-resolver-test', NOW())
       RETURNING id`,
      [codeText],
    );
    inviteCodeId = codeRes.rows[0].id as number;

    // Insert active activation linking user → code
    await pool.query(
      `INSERT INTO user_activations (user_id, invite_code_id, device_id, device_type, status, activated_at, last_online_check)
       VALUES ($1, $2, $3, 'desktop', 'active', NOW(), NOW())`,
      [userId, inviteCodeId, deviceId],
    );

    // Run the seed script in dry-run mode with --access-code
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx/esm", "scripts/seed-field-test-simulation.ts", "--access-code", codeText],
      { encoding: "utf8", cwd: process.cwd() },
    );

    assert.equal(result.status, 0, `seed script failed: ${result.stderr}`);

    // The script writes a JSON report at the end of stdout. Parse the last JSON object.
    const stdout = result.stdout.trim();
    const jsonStart = stdout.indexOf("{");
    assert.ok(jsonStart >= 0, `no JSON in stdout: ${stdout}`);
    const report = JSON.parse(stdout.slice(jsonStart));

    // CRITICAL ASSERTIONS — the bug this test guards against
    assert.notEqual(report.targetUserId, codeText, "BUG: targetUserId equals literal code string — animals would be orphaned");
    assert.notEqual(report.targetUserId, codeText.toUpperCase(), "BUG: targetUserId equals literal code string (upper) — animals would be orphaned");
    assert.equal(report.targetUserId, userId, "targetUserId must equal the active activation's userId");
    assert.equal(report.resolvedFrom, "access-code");
    assert.equal(report.accessCode, codeText.toUpperCase());
    assert.equal(report.mode, "dry-run");
  } finally {
    // Cleanup throwaway test data (only the rows this test created)
    try {
      if (inviteCodeId !== null) {
        await pool.query(`DELETE FROM user_activations WHERE invite_code_id = $1`, [inviteCodeId]);
        await pool.query(`DELETE FROM invite_codes WHERE id = $1`, [inviteCodeId]);
      }
      await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    } catch (cleanupErr) {
      console.error("[seed-resolver-test] cleanup error (non-fatal):", cleanupErr);
    }
    await pool.end();
  }
});

skipIfNoDb("seed --access-code with chained sharedUserId resolves to primary workspace owner", async () => {
  // Two devices share the same code: device A is the primary, device B has sharedUserId=A.
  // The resolver must return A's id (the workspace owner), not B's.
  const pool = new Pool({ connectionString: DATABASE_URL });
  const codeText = `CHN${randomUUID().slice(0, 5).toUpperCase()}`;
  const userA = randomUUID();
  const userB = randomUUID();
  const deviceA = randomUUID();
  const deviceB = randomUUID();
  let inviteCodeId: number | null = null;

  try {
    await pool.query(
      `INSERT INTO users (id, device_id, device_name, created_at, last_seen_at) VALUES ($1, $2, 'A', NOW(), NOW()), ($3, $4, 'B', NOW(), NOW())`,
      [userA, deviceA, userB, deviceB],
    );
    // B is linked to A's workspace
    await pool.query(`UPDATE users SET shared_user_id = $1 WHERE id = $2`, [userA, userB]);

    const codeRes = await pool.query(
      `INSERT INTO invite_codes (code, status, expires_at, max_uses, uses_count, max_devices, notes, created_at)
       VALUES ($1, 'active', NOW() + INTERVAL '30 days', 2, 2, 2, 'chain-test', NOW()) RETURNING id`,
      [codeText],
    );
    inviteCodeId = codeRes.rows[0].id as number;

    // Insert B's activation FIRST in the table (so the resolver picks B first by table order).
    // Even though B is first, the resolver should walk the sharedUserId chain to A.
    await pool.query(
      `INSERT INTO user_activations (user_id, invite_code_id, device_id, device_type, status, activated_at, last_online_check)
       VALUES ($1, $2, $3, 'mobile', 'active', NOW(), NOW())`,
      [userB, inviteCodeId, deviceB],
    );
    await pool.query(
      `INSERT INTO user_activations (user_id, invite_code_id, device_id, device_type, status, activated_at, last_online_check)
       VALUES ($1, $2, $3, 'desktop', 'active', NOW() + INTERVAL '1 second', NOW())`,
      [userA, inviteCodeId, deviceA],
    );

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx/esm", "scripts/seed-field-test-simulation.ts", "--access-code", codeText],
      { encoding: "utf8", cwd: process.cwd() },
    );
    assert.equal(result.status, 0, `seed failed: ${result.stderr}`);
    const stdout = result.stdout.trim();
    const report = JSON.parse(stdout.slice(stdout.indexOf("{")));

    // The resolver returns the PRIMARY workspace owner (A), not the secondary (B)
    assert.equal(report.targetUserId, userA, "must resolve to primary workspace owner via sharedUserId chain");
    assert.notEqual(report.targetUserId, userB);
    assert.notEqual(report.targetUserId, codeText);
  } finally {
    try {
      if (inviteCodeId !== null) {
        await pool.query(`DELETE FROM user_activations WHERE invite_code_id = $1`, [inviteCodeId]);
        await pool.query(`DELETE FROM invite_codes WHERE id = $1`, [inviteCodeId]);
      }
      await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [userA, userB]);
    } catch (cleanupErr) {
      console.error("[seed-resolver-test] cleanup error (non-fatal):", cleanupErr);
    }
    await pool.end();
  }
});

skipIfNoDb("seed --access-code with non-existent code fails clearly (no orphaned data)", async () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx/esm", "scripts/seed-field-test-simulation.ts", "--access-code", "DOESNOTEXIST9999"],
    { encoding: "utf8", cwd: process.cwd() },
  );
  assert.notEqual(result.status, 0, "must exit non-zero on unknown code");
  assert.match(result.stderr, /not found in database/i);
});

skipIfNoDb("seed --user-id back-compat: explicit UUID is used verbatim", async () => {
  const someUuid = randomUUID();
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx/esm", "scripts/seed-field-test-simulation.ts", "--user-id", someUuid],
    { encoding: "utf8", cwd: process.cwd() },
  );
  assert.equal(result.status, 0, `seed failed: ${result.stderr}`);
  const stdout = result.stdout.trim();
  const report = JSON.parse(stdout.slice(stdout.indexOf("{")));
  assert.equal(report.targetUserId, someUuid);
  assert.equal(report.resolvedFrom, "user-id");
  assert.equal(report.accessCode, null);
});
