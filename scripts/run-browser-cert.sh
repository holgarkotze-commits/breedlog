#!/usr/bin/env bash
set -euo pipefail

RESULT_DIR="artifacts/browser-certification"
RESULT_FILE="$RESULT_DIR/RESULT.json"
mkdir -p "$RESULT_DIR"

if ! npm ls @playwright/test --depth=0 >/dev/null 2>&1; then
  cat > "$RESULT_FILE" <<'JSON'
{
  "status": "blocked",
  "passed": false,
  "reason": "Browser certification dependencies are not installed. Install @playwright/test and browser binaries, then re-run.",
  "blockerType": "external_dependency",
  "missing": "@playwright/test",
  "runbook": "docs/release/offline-sync-certification.md"
}
JSON
  echo "[Browser Cert] Missing @playwright/test. Wrote failing RESULT.json"
  exit 1
fi

if ! npx playwright test --config tests/browser-cert/playwright.config.ts; then
  cat > "$RESULT_FILE" <<'JSON'
{
  "status": "failed",
  "passed": false,
  "reason": "Playwright browser certification suite failed. Inspect artifacts/browser-certification/report.",
  "runbook": "docs/release/offline-sync-certification.md"
}
JSON
  echo "[Browser Cert] Playwright suite failed. Wrote failing RESULT.json"
  exit 1
fi

cat > "$RESULT_FILE" <<JSON
{
  "status": "passed",
  "passed": true,
  "suites": [
    "tests/browser-cert/specs/offline-sync.spec.ts",
    "tests/browser-cert/specs/decision-alerts.spec.ts"
  ],
  "executedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "runbook": "docs/release/offline-sync-certification.md"
}
JSON

echo "[Browser Cert] Passed. Updated $RESULT_FILE"
