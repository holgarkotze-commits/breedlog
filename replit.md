# BreedLog on Replit

This file contains only Replit-specific operating notes. General repository guidance is in `README.md`; product and programme records are in the mapped Project Assets repository.

## Run

```bash
npm install
npm run dev
```

Replit exposes the application from local port `5000`. Deployment runs the production build with `node ./dist/index.cjs` as configured in `.replit`.

## Verify

```bash
npm run check
npm test
npm run build
```

Use `npm run db:push` only when an intentional schema change must be applied to the configured PostgreSQL database.

## Required configuration

- `DATABASE_URL` — PostgreSQL connection string for database-backed modes.
- `SESSION_SECRET` — required in production.
- `ADMIN_PIN` — protects administrator functions.
- AI, email, billing, backup and signing secrets are optional by feature and must remain in Replit Secrets or another managed secret store.

For local certification without PostgreSQL, set `USE_IN_MEMORY_STORAGE=1` with `NODE_ENV=test`.

## Replit notes

- The app is offline-capable, but `/api/*` requests bypass the service-worker cache.
- A failed Vite HMR WebSocket inside the Replit preview iframe does not by itself mean the deployed app is unavailable.
- Workspace switching intentionally clears local IndexedDB data before loading the selected workspace.
- Invite-code activation decisions are centralized in `server/invite-activation.ts`; both diagnostics and real activation must use that service.

---

**Developed by STITCH WORX — Software, systems & digital builds.**
