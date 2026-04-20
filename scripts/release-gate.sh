#!/usr/bin/env bash
set -euo pipefail

printf "[Gate] Running runtime/API checks...\n"
npm run check >/dev/null
npm run build >/dev/null
npm run test:cert >/dev/null

STATUS_FILE="artifacts/browser-certification/RESULT.json"
if [[ ! -f "$STATUS_FILE" ]]; then
  printf "[Gate] Browser offline/sync certification artifact missing: %s\n" "$STATUS_FILE"
  printf "[Gate] See docs/release/offline-sync-certification.md\n"
  exit 1
fi

if ! grep -q '"passed"[[:space:]]*:[[:space:]]*true' "$STATUS_FILE"; then
  printf "[Gate] Browser certification artifact exists but does not indicate pass.\n"
  exit 1
fi

printf "[Gate] Release gate passed.\n"
