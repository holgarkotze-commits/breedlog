# BreedLog Engineering Governance

## Branch discipline

- Use one branch per authorised phase, branched from verified `main` when the remote is reachable.
- Do not commit direct production-feature work to `main`.
- Do not combine unrelated refactors with a phase branch.
- Do not force-push after review begins unless the PR explains the reason.
- Do not hide generated files; generated artifacts must be intentional and reviewable.

## Pull request discipline

Every phase PR must include issue reference, scope, non-goals, changed files, commands run, PASS/FAIL/BLOCKED results, runtime evidence, risks, blockers, rollback considerations, and explicit confirmation that later phases were not started.

## Verification discipline

Use clean-environment commands. Required Phase 1 sequence is `npm ci`, `npm run check`, `npm run test:cert`, `npm run build`, plus relevant added tests, schema validation, `git diff --check`, and `git status --short`. Use only PASS, FAIL, or BLOCKED. If it was not run, it cannot be claimed.

## No-placeholder doctrine

Placeholders must not masquerade as implemented functionality. Schema/template fields may be `null`, `pending`, `not_applicable`, or `not_generated`; they may not use invented hashes, fake signing certificates, fake URLs, fake payment-provider IDs, or pretend production evidence.

## Secret handling

No secrets, `.env` values, tokens, signing keys, private farm data, or unredacted screenshots belong in the repository or evidence pack. Future phases must use managed secret stores.

## Permanent data-isolation rule

`U2A2ZAVQ` is Haka’s controlled test/master simulation code. Its Kwantam simulation data must remain isolated from ordinary accounts. New normal users must receive clean workspaces unless an explicit verified migration/import is performed.
