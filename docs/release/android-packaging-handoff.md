# Android Packaging Handoff (Phase 12)

## Phase 12 Status
**BLOCKED — missing Android wrapper/build system.**

BreedLog currently contains a web app codebase but no Android wrapper project (`android/` Gradle project, Capacitor Android platform, Cordova Android platform, or TWA/Bubblewrap project files). Therefore, this phase cannot produce a real APK/AAB in the current repository state.

## Exact search commands run (repository root: `/workspace/breedlog`)

### Command A
```bash
find . -maxdepth 4 -type d -name android -print
```
**Result:** no output (no `android/` directory found).

### Command B
```bash
find . -maxdepth 5 \( -name 'build.gradle' -o -name 'build.gradle.kts' -o -name 'settings.gradle' -o -name 'settings.gradle.kts' -o -name 'gradlew' -o -name 'gradlew.bat' -o -name 'AndroidManifest.xml' -o -name 'capacitor.config' -o -name 'capacitor.config.ts' -o -name 'capacitor.config.json' -o -name 'config.xml' \) -print
```
**Result:** no output (none of the Android wrapper build files found).

### Command C
```bash
rg -n --hidden -S "cordova|capacitor|bubblewrap|twa|targetSdkVersion|compileSdk|minSdk|applicationId|versionCode|versionName|keystore|\.aab|\.apk|bundleRelease|assembleRelease|AndroidManifest" .
```
**Result:** only documentation/test text matches (for example in `docs/release/android-wrapper-baseline.md`, `docs/release/android-packaging-handoff.md`, and non-build text files); no actual Android wrapper/build project files detected.

## Missing required project pieces
At least the following are missing for Android packaging:

- `android/` Gradle project root
- `settings.gradle(.kts)` and app/module `build.gradle(.kts)`
- `gradlew` / `gradlew.bat`
- `app/src/main/AndroidManifest.xml`
- signing config placeholders (keystore path/aliases via env vars)
- release build wiring for `assembleRelease` / `bundleRelease`

## Recommended packaging route
Given current architecture (web-first app), use one of these wrapper strategies:

1. **Capacitor Android (recommended)** for richer native control and future plugins.
2. **TWA/Bubblewrap** if product stays primarily PWA and Play Store packaging is the main goal.
3. **Cordova** only if existing team expertise/tooling requires it.

## Required Android SDK policy targets (when wrapper exists)
- `targetSdkVersion`: **35 or higher** (Android 15 / API 35 requirement).
- `compileSdk`: **35 or higher** (match target policy; preferably latest stable).
- `minSdk`: **24–26 recommended** for broad device coverage in Namibia while avoiding very old unsupported Android behavior. Suggested default: **24** unless field-device constraints or libraries require 26.

## 16 KB page-size compatibility note (Android 15+ 64-bit)
- If the wrapper contains **no bundled native `.so` libraries**, risk is lower and compatibility is mostly controlled by app bundle/toolchain.
- If native libs are present (directly or transitively through dependencies), verify each ABI build supports Android 15+ 16 KB page-size expectations and update NDK/toolchain/dependencies accordingly.
- Add this check to CI release validation before Play submission.

## Permission rules for Play Protect/privacy posture
- Start from minimum permissions only.
- Remove any unused/sensitive permission by default.
- Request sensitive permissions only when a user-visible feature requires them and document purpose in release notes.
- Re-review merged manifest permissions (`uses-permission`) before each release.

## Required build commands once wrapper exists
From Android project root:

```bash
./gradlew clean
./gradlew assembleRelease
./gradlew bundleRelease
```

Expected outputs:
- APK: `app/build/outputs/apk/release/*.apk`
- AAB: `app/build/outputs/bundle/release/*.aab`

## APK/AAB acceptance checklist
- [ ] Build succeeds for `assembleRelease` and/or `bundleRelease`.
- [ ] Artifact exists at expected output path.
- [ ] `targetSdkVersion >= 35` and `compileSdk >= 35` confirmed in Gradle files.
- [ ] `minSdk` is set intentionally and documented.
- [ ] Release signing config is valid (no debug signing).

## Play Protect warning acceptance checklist
- [ ] App targets API 35+.
- [ ] Privacy-sensitive permissions are justified/minimized.
- [ ] Build uses current Android Gradle Plugin/toolchain compatible with API 35.
- [ ] 16 KB page-size compatibility reviewed for all native dependencies.
- [ ] Internal test track install/update passes without legacy-target warning.

## Signing and release notes
- Keep keystore out of repository.
- Use CI/environment secrets for keystore file, alias, and passwords.
- Record `versionCode`/`versionName` and signing fingerprint in release evidence.

## Manual device test checklist (post-wrapper)
- [ ] Fresh install on Android 14 and Android 15 device.
- [ ] Update install from previous Play/internal build.
- [ ] Offline launch + sync-critical flows sanity check.
- [ ] Permission prompts appear only when required by feature usage.
- [ ] App start/perf baseline remains acceptable.

## CI / cloud build note
Once wrapper is added, include Android release lane in GitHub Actions (or equivalent cloud CI):
- set up JDK + Android SDK,
- run Gradle release build,
- publish APK/AAB artifact,
- attach policy metadata checks (SDK levels, permissions, signing mode).
