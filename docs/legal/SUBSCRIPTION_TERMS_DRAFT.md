# BreedLog Subscription Terms Draft

Version: subscription-terms-draft-2026-07-13
Status: implementation draft requiring professional legal/tax/payment review before production use.

## Plans And Pricing

- Free: no charge.
- Premium monthly: N$149 per month.
- Premium annual: N$1,520 per year.

## Entitlements

Premium unlocks higher limits for animals, devices, AI actions, PDF exports, backups and optional quota add-ons. Backend entitlement state is authoritative.

## Cancellations And Failed Payments

Cancellation, grace-period, failed-payment, refund, dispute and reversal handling must be driven by signed provider webhooks and idempotent billing events. No client may self-upgrade without backend reconciliation.

## Downgrade

Downgrade preserves all data. The first 30 originally added active animals remain visible on Free; later active animals are hidden without deletion and are restored after verified Premium reactivation.

## External Activation

Live checkout remains blocked until the approved payment provider, merchant credentials, webhook secrets and legal/tax review are available.
