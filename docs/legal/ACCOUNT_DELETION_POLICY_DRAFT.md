# BreedLog Account Deletion Policy Draft

Version: account-deletion-policy-draft-2026-07-13
Status: implementation draft requiring professional legal review before production use.

## Required Flow

1. Authenticate the account owner.
2. Offer export-before-deletion and encrypted backup creation.
3. Show explicit destructive warnings.
4. Require typed confirmation.
5. Mark the account for deletion with a 30-day recovery deadline.
6. Revoke active sessions and device registrations according to policy.
7. Retain deletion audit records without private farm content.
8. Permanently delete workspace data after the recovery window unless legal retention applies.

## Recovery Window

The recovery window is 30 days from deletion request confirmation. Reactivation during the window must restore the account/workspace without duplicating data.

## Permanent Deletion

Permanent deletion must remove animals, records, documents, images, exports, backups under BreedLog control, sessions and support-linked account identifiers where legally permissible.
