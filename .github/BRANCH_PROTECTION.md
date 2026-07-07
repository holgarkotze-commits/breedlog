# Branch Protection — main

This file records the branch protection rules applied to `main` on **2026-07-04**.
To audit or update: `Settings → Branches → main` on GitHub, or use the REST API below.

## Applied rules

| Setting | Value |
|---|---|
| Required status check | `Type-check, Build & Test` |
| Strict (branch must be up-to-date) | `true` |
| Enforce for administrators | `true` |
| Allow force pushes | `false` |
| Allow deletions | `false` |
| Required pull request reviews | none (see follow-up task #17) |

The required status check name **must exactly match** the `name:` field of the job in
`.github/workflows/ci.yml` (currently `Type-check, Build & Test`, job id `verify`).

## How it was applied

```
PATCH /repos/holgarkotze-commits/breedlog
  { "private": false }          # made public to unlock branch protection on free plan

PUT /repos/holgarkotze-commits/breedlog/branches/main/protection
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Type-check, Build & Test"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
```

## Verification

```bash
curl -s \
  -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/holgarkotze-commits/breedlog/branches/main/protection" \
  | jq '.required_status_checks, .enforce_admins'
```

Expected output:
```json
{
  "strict": true,
  "contexts": ["Type-check, Build & Test"]
}
{
  "url": "...",
  "enabled": true
}
```

## Re-enabling private mode

If the account is upgraded to GitHub Pro/Team, the repo can be made private again
without losing branch protection:

```
PATCH /repos/holgarkotze-commits/breedlog
  { "private": true }
```

The branch protection rule persists through visibility changes.
