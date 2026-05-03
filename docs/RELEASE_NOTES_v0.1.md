# Lazy Dotfiles v0.1 — MVP Release

| Date       | Milestone |
| ---------- | --------- |
| 2026-05-01 | MVP       |

Lazy Dotfiles (`ldf`) is a TUI that discovers, tracks, and versions dotfiles in a single `jj`
repository at `$HOME/dotfiles`, with symlinks back to original locations. This release delivers
the full round-trip: **discover → track → version → sync → restore**, end-to-end, with no data loss.

---

## Goals (G1–G7)

| Goal | Description                                                   | Evidence                                                                                                        |
| ---- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| G1   | TUI launches; first-run bootstraps config + repo              | `src/services/bootstrap.service.ts`; `bin/ldf.ts` entry                                                         |
| G2   | Discovery surfaces candidates + sibling detection             | `src/services/discovery.service.ts`; `tests/discovery.a2.test.ts`                                               |
| G3   | Track: move + symlink + jj describe + backup (atomic)         | `src/services/track.service.ts`; `src/services/track.service.test.ts`                                           |
| G4   | Untrack: restore file to original location, retain jj history | `src/services/track.service.ts` (remove path); `src/services/track.service.untrack-history.integration.test.ts` |
| G5   | CLI subcommands: status, log, add, rm, config, sync           | `src/cli/cli.test.ts`; `src/cli/cli.smoke.integration.test.ts`                                                  |
| G6   | Sync fetch+push, conflict surfacing                           | `src/services/sync.service.ts`; `src/services/sync.service.a6.integration.test.ts`                              |
| G7   | Recoverable backups; one-keystroke restore from log           | `src/services/restore.service.ts`; `src/services/restore.service.a7.integration.test.ts`                        |

## Non-goals (N1–N7)

| ID  | Item                                    | Status                                           |
| --- | --------------------------------------- | ------------------------------------------------ |
| N1  | Multi-profile / multi-machine selection | Deferred — follow-up bean filed                  |
| N2  | API-key sanitization                    | Deferred — follow-up bean filed                  |
| N3  | Templated dotfiles                      | Deferred — follow-up bean filed                  |
| N4  | Three-way merge UI                      | Deferred — follow-up bean filed                  |
| N5  | Git VCS backend                         | Deferred — follow-up bean filed                  |
| N6  | Network-discovered remotes / OAuth      | Permanent design choice — user configures remote |
| N7  | Background daemon                       | Deferred — follow-up bean filed                  |

## Acceptance Criteria (A1–A9)

| Criterion                                                  | Canonical test path                                                                                                                                             | Status |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A1 — first-run < 500 ms                                    | `tests/e2e/a1-boot-speed.test.ts`                                                                                                                               | pass   |
| A2 — discovery surfaces dotfiles + siblings                | `tests/discovery.a2.test.ts`                                                                                                                                    | pass   |
| A3 — track produces backup + symlink + jj change           | `tests/e2e/a3-add-round-trip.test.ts`                                                                                                                           | pass   |
| A4 — untrack restores file, retains history                | `src/services/track.service.untrack-history.integration.test.ts`                                                                                                | pass   |
| A5 — SIGTERM mid-add is recoverable                        | `src/services/track.service.sigterm.integration.test.ts`                                                                                                        | pass   |
| A6 — sync fetch+push, ahead/behind, conflicts              | `src/services/sync.service.a6.integration.test.ts`                                                                                                              | pass   |
| A7 — restore from op log rewinds working copy              | `src/services/restore.service.a7.integration.test.ts`                                                                                                           | pass   |
| A8 — test coverage audit (no §3.1 violations)              | `docs/audits/a8-test-coverage.md`                                                                                                                               | pass   |
| A9 — no process.exit, no fixed sizes, no hex outside theme | `tests/e2e/a9-static-invariants.test.ts`, `src/views/no-process-exit.test.ts`, `src/views/layout-discipline.test.ts`, `src/views/theme/no-hex-literals.test.ts` | pass   |

## Open Questions Resolved (Q1–Q4)

| Q                      | Resolution                           | Detail                                                                                          |
| ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Q1 — GPG signing       | Deferred to v1.1                     | No MVP impact                                                                                   |
| Q2 — Exclude semantics | Gitignore semantics                  | Verified by `src/repositories/fs-scanner.classify.test.ts`                                      |
| Q3 — Backup retention  | No GC for MVP                        | Backup-dir size in Status deferred to follow-up bean                                            |
| Q4 — jj backend        | Colocated (`jj git init --colocate`) | Confirmed at `src/repositories/jj.repository.ts:238` and `src/services/bootstrap.service.ts:33` |

Full resolutions with citations: [`docs/audits/q-resolutions.md`](audits/q-resolutions.md).

## Follow-up Work

| Bean ID    | Title                            |
| ---------- | -------------------------------- |
| `ldf-zm82` | API-key sanitization (PRD N2)    |
| `ldf-4lmw` | Three-way merge UI (PRD N4)      |
| `ldf-nsgo` | Git VCS backend (PRD N5)         |
| `ldf-p1b7` | Background daemon (PRD N7)       |
| `ldf-euox` | Backup retention / GC (PRD Q3)   |
| `ldf-fy8o` | Multi-profile selection (PRD N1) |
| `ldf-2lcb` | Templated dotfiles (PRD N3)      |

## Known Limitations

- **No backup GC.** Disk usage grows unbounded until the retention/GC follow-up ships.
- **No backup-dir size in Status panel.** Filed as part of the Q3 follow-up bean.
- **Sync conflict resolution is ours/theirs only.** No three-way merge editor; conflicts route to `$EDITOR`.
- **Single profile per machine.** No multi-machine profile selection.
- **jj is the only supported VCS backend.** Git-only repos are not supported.
- **No background daemon.** Auto-sync runs only while the TUI is open or via user-configured cron/launchd.
- **No API-key detection.** Secrets may be committed if the user does not exclude them manually.
- **No templated dotfiles.** Host-specific substitution is not available; files are tracked verbatim.
- **No network-discovered remotes.** The remote URL must be configured manually.
