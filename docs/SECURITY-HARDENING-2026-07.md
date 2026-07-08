# BreedLog Security & Stability Hardening — July 2026

This document records the security and stability fixes applied following the
July 2026 repository review.

## Security fixes

1. **Unauthenticated AI template routes removed.**
   The Replit-template integration routes (`/api/conversations*`,
   `/api/generate-image`, and the audio `voice-stream` variants) were
   registered without authentication and stored conversations in a single
   global list with no per-user scoping. Any anonymous visitor could read,
   create, and delete every user's AI conversations and consume the OpenAI
   API key. These routes are no longer registered. The supported AI surface
   is the authenticated BreedLog assistant under `/api/ai/*`.

2. **Production fails fast without `SESSION_SECRET`.**
   Device tokens are HMAC-signed with `SESSION_SECRET`. Previously a
   hardcoded fallback secret was used when the variable was missing, which
   would have made 365-day device tokens forgeable in a misconfigured
   production deployment. The server now refuses to start in production
   without `SESSION_SECRET`. Development and test environments keep a local
   fallback for convenience.

3. **Constant-time credential comparisons.**
   Device-token signatures, the admin PIN header, and the admin login PIN
   are now compared with `crypto.timingSafeEqual` (via a shared
   `safeCompare` helper) instead of `===`, removing timing side channels.
   Admin middleware no longer logs session IDs.

## Stability fixes

4. **Startup migration race eliminated.**
   Concurrent server startups (e.g. parallel CI test files sharing one
   Postgres) raced inside `CREATE TABLE IF NOT EXISTS` and failed with
   `23505` on `pg_type_typname_nsp_index`. Startup migrations now run under
   a Postgres advisory lock so concurrent boots serialize safely.

5. **Public npm registry lockfile.**
   `package-lock.json` no longer references the Replit-internal
   `package-firewall.replit.local` mirror, so `npm ci` works in any
   environment. The CI lockfile-patching workaround was removed.

6. **Telemetry device identity corrected.**
   A local helper in the route layer shadowed the real `getDeviceId`,
   causing activity telemetry to record a browser-fingerprint hash instead
   of the actual device ID.

7. **CSV import row fault-tolerance.**
   The simple import endpoint (`/api/settings/import`) now handles bad rows
   (duplicate tags, missing tag IDs) per row and reports them in the
   response instead of aborting mid-import with a 500 after partial writes.

8. **Date-dependent test rot fixed.**
   The decision-alert generators accept an injectable reference date, and
   their tests pin it, so the suite no longer starts failing as the
   calendar advances past hardcoded fixture dates.

## Verification

- `npm run check` — clean.
- `npm run test:cert` — 490 passing, 0 failing (4 skipped), including new
  `tests/security-hardening.test.ts` covering route removal, fail-fast
  secret handling, constant-time comparison helpers, concurrent-boot
  migration safety, and import fault-tolerance.
- `npm run build` — client and server bundles build successfully.

---

Developed by STITCH WORX — Software, systems & digital builds.
