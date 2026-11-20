#!/usr/bin/env bash
set -euo pipefail
apk="$1"
package="com.stitchworx.breedlog"
adb install "$apk"
adb shell am start -W -n "$package/.MainActivity"
adb shell pidof "$package"
# This lane uses the debug fixture only. Keep an app-private marker across -r
# to verify replacement without claiming a production key or signed release.
adb shell run-as "$package" sh -c "'mkdir -p files; echo preserved > files/install-acceptance'"
adb install -r "$apk"
adb shell am start -W -n "$package/.MainActivity"
adb shell pidof "$package"
test "$(adb shell run-as "$package" cat files/install-acceptance | tr -d '\r')" = "preserved"
echo 'Debug emulator install, launch and same-version replacement preserved app data. Release signing and physical-device acceptance remain separate gates.'
