# Spec — Release notes v0.1

- **Source bean:** `ldf-gd64`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD](../prds/001_mvp.md), [CONSTITUTION](../CONSTITUTION.md).

## Goal

Create `docs/RELEASE_NOTES_v0.1.md` summarizing MVP completeness: goals, acceptance criteria, open-question resolutions, deferred non-goals, and known limitations.

## Public surface

Deliverable: `docs/RELEASE_NOTES_v0.1.md` with the following sections.

### §1 Goals achieved

| Goal                                                     | Evidence                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| G1 — TUI launches, bootstraps on first run               | `src/services/bootstrap.service.ts`; `bin/ldf.ts` entry                                                       |
| G2 — Discovery surfaces candidates + siblings            | `src/services/discovery.service.ts`; `tests/discovery.a2.test.ts`                                             |
| G3 — Track: move + symlink + jj describe + backup        | `src/services/track.service.ts`; `src/services/track.service.test.ts`                                         |
| G4 — Untrack: restore file, retain jj history            | `src/services/track.service.ts` remove path; `src/services/track.service.untrack-history.integration.test.ts` |
| G5 — CLI subcommands: status, log, add, rm, config, sync | `src/cli/cli.test.ts`; `src/cli/cli.smoke.integration.test.ts`                                                |
| G6 — Sync fetch+push, conflict surfacing                 | `src/services/sync.service.ts`; `src/services/sync.service.a6.integration.test.ts`                            |
| G7 — Recoverable backups, one-keystroke restore          | `src/services/restore.service.ts`; `src/services/restore.service.a7.integration.test.ts`                      |

### §2 Non-goals deferred

| ID  | Item                       | Tracking                             |
| --- | -------------------------- | ------------------------------------ |
| N1  | Multi-profile selection    | follow-up bean                       |
| N2  | API-key sanitization       | follow-up bean                       |
| N3  | Templated dotfiles         | follow-up bean                       |
| N4  | Three-way merge UI         | follow-up bean                       |
| N5  | Git VCS backend            | follow-up bean                       |
| N6  | Network-discovered remotes | out of scope; user configures remote |
| N7  | Background daemon          | follow-up bean                       |

### §3 Acceptance criteria coverage

| Criterion                                        | Test path                                                                                                             | Status                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1 — first-run <500ms                            | `tests/e2e/a1-first-run-timing.test.ts`                                                                               | **new** (spec `verify-a1`)            |
| A2 — discovery surfaces dotfiles                 | `tests/discovery.a2.test.ts`                                                                                          | ✓ existing                            |
| A3 — track produces backup + symlink + jj change | `tests/e2e/a3-track-backup-symlink.test.ts`                                                                           | **new** (spec `verify-a3`)            |
| A4 — untrack restores file, retains history      | `src/services/track.service.untrack-history.integration.test.ts`                                                      | ✓ existing                            |
| A5 — SIGTERM mid-add recoverable                 | `src/services/track.service.sigterm.integration.test.ts`                                                              | ✓ existing                            |
| A6 — sync fetch+push, ahead/behind, conflicts    | `src/services/sync.service.a6.integration.test.ts`                                                                    | ✓ existing                            |
| A7 — restore from op log rewinds working copy    | `src/services/restore.service.a7.integration.test.ts`                                                                 | ✓ existing                            |
| A8 — test coverage audit                         | `docs/audits/a8-test-coverage.md`                                                                                     | audit artifact                        |
| A9 — no process.exit, no fixed sizes, no hex     | `src/views/no-process-exit.test.ts`, `src/views/layout-discipline.test.ts`, `src/views/theme/no-hex-literals.test.ts` | ✓ existing (process.exit scan exists) |

### §4 Open questions resolutions

| Q                      | Resolution                                                                |
| ---------------------- | ------------------------------------------------------------------------- |
| Q1 — GPG signing       | Deferred to v1.1                                                          |
| Q2 — Exclude semantics | Gitignore semantics; verified in `fs-scanner.classify.test.ts`            |
| Q3 — Backup retention  | No GC; backup dir size in Status deferred to follow-up                    |
| Q4 — jj backend        | Colocated (`jj git init --colocate`); confirmed in `jj.repository.ts:245` |

### §5 Follow-up beans

(Enumerated in the follow-up beans spec `ldf-w9v5`.)

### §6 Known limitations

- No backup GC — disk usage grows unbounded until follow-up ships.
- No backup dir size displayed in Status panel — follow-up bean filed.
- Sync conflict resolution is pick-ours/pick-theirs only; no three-way merge.
- Single profile per machine; no multi-machine selection.
- `jj` is the only supported VCS backend.

## Internal design

The implementer creates `docs/RELEASE_NOTES_v0.1.md` by copying the tables above, filling in any bean IDs from `beans list`, and verifying each test path exists. No code changes.

## Dependencies

- All acceptance-phase specs (A1–A9 verification specs produce the test paths cited).
- Follow-up beans spec (`ldf-w9v5`) for §5 links.
- Open questions spec (`ldf-3590`) for §4 content.

## Tests

No test deliverable. The release notes are a documentation artifact.

## Acceptance

- `docs/RELEASE_NOTES_v0.1.md` exists with all six sections populated.
- Every test path cited in §3 resolves to an actual file.
- No `TODO` or `tbd` markers in the document.

## Review

Approved. Constitution §6 compliance: the document references only `process.exitCode` usage (not `process.exit()`); all cited test paths enforce the relevant constitutional constraints. The release notes are a snapshot — they do not introduce code or weaken any constraint.
