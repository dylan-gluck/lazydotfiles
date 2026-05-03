# Spec — Resolve open questions Q1–Q4

- **Source bean:** `ldf-3590`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §10](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md).

## Goal

Record final resolutions for PRD §10 open questions Q1–Q4 and embed them in `docs/RELEASE_NOTES_v0.1.md`.

## Public surface

No production code changes. Outputs:

- Resolutions recorded in this spec (below) and in `docs/RELEASE_NOTES_v0.1.md` §Open Questions.

## Resolutions

### Q1 — GPG signing of commits

**Resolution: deferred to v1.1.** No MVP impact. The `jj` repository operates without signing; users who want signed commits can configure `jj` directly post-MVP.

### Q2 — Discovery exclude: gitignore semantics vs. globs

**Resolution: gitignore semantics (confirmed).** Negation patterns (`!pattern`) are supported. Verified by:

- `src/repositories/fs-scanner.classify.test.ts` — tests `classifyPath` with negation (`!.env.example` re-includes after `.env*` exclude).
- `src/services/discovery.service.test.ts` — exercises the full discovery pipeline including exclude patterns.

No further work required.

### Q3 — Backup retention cap

**Resolution: no GC for MVP; surface backup dir size in Status panel; add GC in follow-up.**

Current state: `src/views/panels/status-panel.tsx` and `src/controllers/status.controller.ts` do **not** expose a backup directory size metric. The `UseStatusPanel` interface has no field for it.

**Action:** file a follow-up bean for "Add backup directory size to Status panel" (parent: this epic). This is a v0.2 enhancement, not a QA blocker. The follow-up beans spec (`ldf-w9v5`) includes this item plus the Backup GC bean.

### Q4 — jj backend: colocated vs. native init

**Resolution: colocated (confirmed).** The codebase uses `jj git init --colocate`:

- `src/repositories/jj.repository.ts` line 245: `runJj(["git", "init", "--colocate", path])`.
- `src/services/bootstrap.service.ts` line 33: calls `deps.jj.initColocated(cfg.value.path.dotfiles)`.

Users can `git push` to GitHub without extra setup. No further work required.

## Internal design

The implementer copies the resolutions above into `docs/RELEASE_NOTES_v0.1.md` under the §Open Questions section. No code changes.

## Dependencies

- `docs/RELEASE_NOTES_v0.1.md` (created by the release-notes spec `ldf-gd64`).

## Tests

No test deliverable. Resolutions are documentation-only.

## Acceptance

- Each Q1–Q4 resolution is recorded in this spec with evidence (file paths, line numbers).
- Each resolution is present in `docs/RELEASE_NOTES_v0.1.md`.
- Q3's missing Status-panel metric is tracked as a follow-up bean, not expanded into QA scope.

## Review

Approved. No constitution violations. Q2 and Q4 resolutions are grounded in existing code with line-level citations. Q1 and Q3 are explicit deferrals with follow-up tracking.
