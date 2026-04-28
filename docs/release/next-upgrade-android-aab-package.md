# Next Upgrade Package: Android APK/AAB Plan (Not Completed in Phase 15)

## Scope statement
This document defines the next upgrade package for Android delivery. Android wrapper implementation and APK/AAB build are **not completed** in Phase 15.

## Wrapper choices to evaluate
1. Capacitor Android wrapper (preferred for native extensibility).
2. TWA/PWA wrapper (preferred for lightweight web-first store packaging).

## Planned artifacts
- APK for direct field install/testing.
- AAB for Google Play submission path.

## Required SDK levels
- `targetSdkVersion`: API 35 or higher.
- `compileSdk`: API 35 or higher.
- `minSdk`: recommend 24–26 depending on final dependency constraints and target devices.

## Android app packaging requirements
- App icon, adaptive icon, splash assets.
- Manifest permission review and least-privilege policy.
- Signing setup (keystore in secrets, never committed).
- VersionCode/versionName strategy.

## CI / cloud build path
- Add Android workflow lane in GitHub Actions (or equivalent):
  - setup JDK + Android SDK
  - wrapper sync/build
  - `assembleRelease` and `bundleRelease`
  - publish artifacts

## Device validation plan
- Real-device install on representative Android versions/devices.
- Upgrade path test (install older build then update).
- Play Protect warning checks.
- Offline/online sync sanity checks on mobile device.

## Store readiness checklist
- [ ] API 35+ targets confirmed.
- [ ] Permissions reviewed and justified.
- [ ] Signed release artifact built.
- [ ] Internal track validation complete.
- [ ] Play submission metadata and policy checks complete.
