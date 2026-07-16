# External Activation Blockers

These items remain external to engineering and were not fabricated as complete.

- Payment provider activation: merchant account, production webhook secret, portal/customer-billing credentials, and tax/legal go-live approval for Premium billing.
- Android production release: Google Play publisher ownership, Play Billing production configuration, and the real Android signing-secret set (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`).
- Windows production signing/update channel: Authenticode certificate, timestamp authority configuration, and updater signing keys.
- Production web infrastructure: DNS/hosting/TLS/database/storage access for `breedlog.com` and `app.breedlog.com`.
- Legal approval: professional review and approval of privacy, terms, subscription, refund/cancellation, and deletion-recovery documents.

Seat-specific verification blocker on this Windows workstation:

- A local Android SDK/device environment is not configured, so local physical Android installation proof could not be repeated here even though the GitHub Android workflow passed and the current debug APK was downloaded into the release pack.
