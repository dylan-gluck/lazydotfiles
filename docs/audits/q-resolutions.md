# PRD §10 — Open Question Resolutions

| Revision | Date       | Author |
| -------- | ---------- | ------ |
| 1        | 2026-05-01 | QA     |

**Scope.** Consolidates the four open questions from [PRD §10](../prds/001_mvp.md) with their
final resolutions and evidence citations.

---

## Q1 — GPG signing of commits

**Resolution:** Deferred to v1.1.

MVP does not require GPG-signed jj commits. No code changes needed; the feature has no
impact on any acceptance criterion. Will be revisited when sync hardening is prioritized.

## Q2 — Discovery exclude semantics

**Resolution:** Gitignore semantics (negation `!pattern` supported).

Evidence:

- `src/repositories/fs-scanner.repository.ts` — `classify()` applies gitignore-style matching.
- `src/repositories/fs-scanner.classify.test.ts` — unit tests exercise negation patterns.
- `tests/fs-scanner.repository.test.ts` — integration tests against temp directories.

## Q3 — Backup retention cap

**Resolution:** No GC for MVP. Backups grow unbounded.

The Status panel does not currently display backup-dir size. A follow-up bean has been filed
to add backup retention / GC and surface size in the Status panel.

Follow-up bean: `ldf-euox` — Backup retention / GC (PRD Q3)

## Q4 — jj backend: colocated vs. native

**Resolution:** Colocated (`jj git init --colocate`).

This ensures users can `git push` to GitHub without extra setup.

Evidence:

- `src/repositories/jj.repository.ts` line 238 — `initColocated()` method runs `jj git init --colocate`.
- `src/services/bootstrap.service.ts` line 33 — bootstrap calls `deps.jj.initColocated(cfg.value.path.dotfiles)`.
- `src/repositories/jj.repository.ts` line 16 — interface declares `initColocated(path)`.

---

## Follow-up Beans

| Q   | Bean ID    | Title                          |
| --- | ---------- | ------------------------------ |
| Q3  | `ldf-euox` | Backup retention / GC (PRD Q3) |
