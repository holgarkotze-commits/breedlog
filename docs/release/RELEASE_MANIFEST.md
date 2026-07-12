# Release Manifest Template

Future phases must populate `docs/release/RELEASE_MANIFEST.schema.json` with real release evidence. During Phase 1, ungenerated values stay `null`, `pending`, `not_applicable`, or `not_generated`; fake hashes, signatures, package IDs, payment IDs, URLs, certificates, and CI references are forbidden.

Validate the schema itself with:

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('docs/release/RELEASE_MANIFEST.schema.json','utf8')); console.log('schema json ok')"
```
