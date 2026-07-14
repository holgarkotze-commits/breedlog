# Android Packaging Handoff (Phase 12)

## Phase 12 Status
**PARTIALLY IMPLEMENTED - unsigned release activation still blocked.**

BreedLog now contains a real Capacitor Android wrapper in-repo:

- `capacitor.config.ts`
- `capacitor.config.json`
- `android/` Gradle project
- `android/app/src/main/AndroidManifest.xml`
- `android/gradlew` and `android/gradlew.bat`
- GitHub Actions Android workflow in `.github/workflows/android-build.yml`

This is no longer a "missing wrapper" phase. The remaining blockers are release credentials and final signed package generation.

## Local verification completed on Windows

Repository root:

```text
C:\Users\User\Documents\GitHub\breedlog
```

Commands verified:

```powershell
npm.cmd run build
npm.cmd run android:sync
```

Result:

- Web assets built successfully.
- Capacitor sync copied production assets into `android/app/src/main/assets/public`.
- Android shell metadata regenerated successfully.

## Current wrapper baseline

- App name: `BreedLog`
- Package identifier: `com.stitchworx.breedlog`
- Web assets source: `dist/public`
- `android:allowBackup="false"`
- `android:usesCleartextTraffic="false"`
- Capacitor Android platform is installed from npm dependencies.

## CI workflow now present

`.github/workflows/android-build.yml` performs:

1. checkout
2. `actions/setup-java`
3. `android-actions/setup-android`
4. `actions/setup-node`
5. `npm ci`
6. `npm run build`
7. `npm run android:sync`
8. `./gradlew :app:assembleDebug`
9. gated signed release step for `:app:bundleRelease`

## Remaining blockers

1. **Java runtime not installed locally** for direct release Gradle execution from this workstation.
2. **Android signing credentials unavailable**:
   - `ANDROID_KEYSTORE_BASE64`
   - alias/password secrets
3. **Google Play publisher ownership/policy activation** not available in this session.
4. **Play Billing live configuration** still depends on the external payment-provider decision and publisher setup.

## What is now ready

- Android source is versioned in the repository.
- Debug-build lane is defined in CI.
- Release-build lane is structurally defined in CI.
- Package identity and manifest hardening are in place.
- Capacitor sync is reproducible from the Windows workspace.

## What is not claimed

- No signed AAB has been produced.
- No signed APK has been produced.
- No Play Console upload has been performed.
- No live Play Billing transaction has been performed.

## Next activation steps when credentials exist

1. Install Java 17+ locally or run the CI lane.
2. Provide Android signing secrets in GitHub Actions.
3. Run:

```powershell
npm.cmd run android:sync
cd android
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:bundleRelease
```

4. Record hashes, package version, signing fingerprint, and install evidence into `release-artifacts`.
