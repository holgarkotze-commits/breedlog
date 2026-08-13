# STITCH WORX Repository Agent Bootstrap

This repository is a STITCH WORX governed build. Any Codex or repository-aware AI agent working here must bootstrap from the STITCH WORX Software Engineering System before substantial implementation work.

This file is a pointer and execution contract. It does not duplicate the full engineering doctrine.

## Mandatory startup

Before modifying files:

1. Read this `AGENTS.md` and any repository-local instruction files such as `CLAUDE.md`, README files, ADRs, plans, or scoped work orders.
2. Read `.stitchworx/project.yaml` when present.
3. Resolve the central Engineering System at `holgarkotze-commits/stitch-worx-software-engineering-system`.
4. Read its `AGENTS.md`, `00_MASTER_INDEX.md`, `STITCH_WORX_MASTER_SOFTWARE_ENGINEERING_HANDBOOK.md`, `SKILL.md`, `doctrine/05_ARTIFACT_AND_INFORMATION_GOVERNANCE.md`, `skills/handoff/SKILL.md`, and `vnext/02_AUTONOMOUS_BUILD_INSTRUCTION.md` as applicable.
5. Use `main` when those governance files are present there. Until methodology v1.3.0 is merged, use branch `agent/artifact-governance-handoff-system` / PR #3 as the transition source.
6. Resolve this product's Project Assets control plane from `.stitchworx/project.yaml` and read the Project Assets repository governance before using or creating durable programme artifacts.
7. Establish live repository identity: remote, branch, HEAD, working tree, current version/release state, and any uncommitted work.
8. Reconcile handoffs and documentation against live Git/runtime evidence before making build-state claims.
9. Identify the exact work boundary, proof gates, artifact destinations, and rollback path before mutation.

## Permanent operating rules

- **If it was not run, it cannot be claimed.**
- Live repository/runtime evidence outranks memory, chat history, handoffs, summaries, and stale documents for build-state claims.
- Diagnose before fixing. Fix the proven class of defect, not only the visible instance.
- Protect scope. Do not silently broaden the work order or alter unrelated product behaviour.
- More autonomy means more evidence, not less.
- Do not weaken tests, assertions, security controls, gates, or verification merely to make work pass.
- Build → Run → View → Test → Package → Release → Prove, applying the gates relevant to the product and task.
- Preserve existing uncommitted user work and repository state.
- Apply all current applicable STITCH WORX doctrine; this file does not replace it.

## Artifact and information routing

- Product code, tests, CI/CD, migrations, scripts, and code-adjacent instructions remain in the product repository.
- Durable product/programme truth belongs in the mapped `PROJECT-ASSETS` root according to STITCH WORX artifact governance.
- Generated installers, binaries, APK/AAB files, build ZIPs, caches, compiled output, and CI artifacts are not general Project Assets documentation. Store them in approved build/release/CI storage and retain evidence/hash/reference where required.
- Arbitrary Desktop, Downloads, user-profile root, OS temp, or tool scratch locations are not canonical persistent project-documentation destinations.
- Use one designated current build status, one active work order, and one active handoff. Historical state belongs in Git history or an explicit archive.
- When governance resolves an artifact location unambiguously, route it automatically. Stop only when the destination is genuinely ambiguous, conflicting, inaccessible, destructive, or outside authority.

## Handoff rule

Use the canonical STITCH WORX handoff skill from `skills/handoff/SKILL.md`. A handoff is a verified dispatch contract, not proof by itself. Re-probe live state when resuming.

## Completion reporting

Report the exact scope completed, changed files/modules, commands actually run, PASS/FAIL/BLOCKED/PARTIAL/NOT RUN evidence, artifact locations, limitations, rollback point, and unresolved decisions. Never promote partial evidence into a completion claim.

---

**Developed by STITCH WORX — Software, systems & digital builds.**