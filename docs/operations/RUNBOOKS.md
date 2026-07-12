# BreedLog Operations Runbooks

Version: operations-runbooks-2026-07-13

## Health Checks

- Verify `/api/version`.
- Verify authenticated workspace access.
- Verify entitlement lookup through `/api/entitlements/me`.
- Verify backup preview on a non-production workspace.
- Verify billing webhook signature rejection without a valid signature.

## Incident Severity

- SEV1: data leakage, backup cross-account restore, payment self-upgrade, production outage or destructive data loss.
- SEV2: failed backup/restore, failed billing reconciliation, degraded login, export corruption or AI provider outage without fallback.
- SEV3: individual UI defects, delayed background jobs or non-critical reporting defects.

## Rollback

1. Stop promotion.
2. Identify last passing source commit and release manifest.
3. Redeploy the previous immutable artifact.
4. Verify database migration compatibility before rollback.
5. Run smoke checks.
6. Record incident notes and customer impact.

## Monitoring

Monitor application errors, redacted structured logs, uptime, billing events, backup jobs, restore failures, AI provider failures, quota exhaustion, rate limits and support requests. Logs must not include secrets, tokens, payment details or private animal data.

## Support Workflow

Support requests should capture account identifier, platform, app version, route, broad issue category and user-provided description. Support tooling must avoid exposing private farm records unless the user explicitly shares relevant data.

## External Blockers

Production launch remains blocked until payment-provider activation, legal review, domain/TLS access, Android signing/Play credentials and Windows signing/updater credentials are supplied.
