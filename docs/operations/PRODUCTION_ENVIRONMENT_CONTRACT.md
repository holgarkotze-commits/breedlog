# BreedLog Production Environment Contract

Version: production-completion-env-contract-2026-07-13

## Environments

- development: local Windows workspace and developer machines.
- test: automated tests using isolated in-memory or CI Postgres resources.
- staging: production-like deployment with non-production database, storage, payment test mode and test domains.
- production: public BreedLog service after external approvals and credentials are supplied.

## Required Secrets

Secrets must be stored in deployment/CI secret stores, never source code or release artifacts.

- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_PIN`
- `BACKUP_MASTER_KEY`
- `BILLING_WEBHOOK_SECRET`
- payment-provider API credentials
- Android signing credentials
- Windows signing/updater credentials
- object-storage credentials for documents/images/backups
- AI provider credentials

## Deployment Health

Every deployment must prove:

- `/api/version` returns the expected source version.
- database migrations have completed.
- entitlement lookup is available.
- billing webhooks reject invalid signatures.
- backup encryption refuses production mode without `BACKUP_MASTER_KEY`.
- restore preview rejects wrong-account backups.
- logs redact secrets and payment identifiers.

## Domain And TLS

Required production hostnames:

- `breedlog.com` for the landing site.
- `app.breedlog.com` for the authenticated app.

DNS ownership/access and TLS automation remain external activation blockers until supplied.

## Rollback And Disaster Recovery

Rollback requires an immutable previous artifact, compatible database migration path and verified restore procedure. Database backups, object storage backups and release manifests must be retained according to the production retention policy.
