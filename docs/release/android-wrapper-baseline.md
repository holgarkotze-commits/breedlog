# Android Wrapper Baseline (BreedLog)

BreedLog is primarily a PWA in this repository. If you package it as an Android APK/AAB (TWA/Capacitor/WebView wrapper), the wrapper **must** use modern SDK levels and secure defaults.

## Required Build Targets

- `compileSdkVersion = 35`
- `targetSdkVersion = 35`
- `minSdkVersion >= 24` (recommended)

## Manifest Security Baseline

- `android:usesCleartextTraffic="false"` on the `<application>` tag.
- Exported components explicitly declared (`android:exported="true|false"` as required).
- No broad permissions unless needed.
- Restrictive `queries` package visibility (only what is required).

## Idempotent Network Expectations

The client now sends `X-Idempotency-Key` for offline replay-safe creates. Android wrappers should not strip this header.

## Verification Checklist

1. Confirm wrapper Gradle config targets API 35.
2. Confirm release signing path and release build type are configured.
3. Confirm HTTPS origin only, no cleartext fallback.
4. Confirm `AndroidManifest.xml` follows the security baseline above.
