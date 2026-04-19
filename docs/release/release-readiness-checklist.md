# Release Readiness Checklist

## Mandatory gates
- [ ] Typecheck passes (`npm run check`)
- [ ] Production build passes (`npm run build`)
- [ ] Runtime/API certification suite passes (`npm run test:cert`)
- [ ] Browser Offline+Sync certification suite passes (see `docs/release/offline-sync-certification.md`)
- [ ] Security sanity checks pass (debug endpoints protected, no exposed secrets)

## Hard rule
Release is **not complete** until browser offline/sync certification is executed and evidence artifacts are captured.
