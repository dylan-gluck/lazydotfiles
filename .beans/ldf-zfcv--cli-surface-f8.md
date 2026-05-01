---
# ldf-zfcv
title: CLI surface (F8)
status: completed
type: epic
priority: normal
created_at: 2026-05-01T04:21:53Z
updated_at: 2026-05-01T18:04:21Z
parent: ldf-euyx
blocked_by:
    - ldf-j9pe
    - ldf-hia6
    - ldf-zf8l
    - ldf-auiv
    - ldf-vcv0
    - ldf-egel
---

Deliver PRD §F8 CLI surface as a thin shell over the same services backing the TUI (ADR-001 §4.5: no business logic in CLI entry).

## Scope

### Subcommands

- `ldf` — bootstrap if needed, open TUI on Status.
- `ldf status` — print tracked count, queue size, last sync, dirty repo flag.
- `ldf log` — paged operation log.
- `ldf add <path>` — invoke `track.service.add`. Non-zero on failure.
- `ldf rm <path>` — invoke `track.service.remove`.
- `ldf config [option]` — print or set a config option (e.g. `ldf config discovery.auto_track false`).
- `ldf sync` — invoke `sync.service.sync()`. Non-zero on conflict or push failure.

### Implementation

- `bin/ldf.ts` (or `src/cli.ts`) — argv parser (Bun's built-in `parseArgs`, no extra dep). Dispatches to the `services` map wired by `composition/services.ts`.
- Output formatting helpers in `lib/format.ts` — relative timestamps, ahead/behind, table-shaped output for terminals without TUI.
- Exit codes: `0` success, `1` user error (bad path, unknown option), `2` operational failure (rollback engaged, conflict).

### Tests

- Each subcommand has a smoke test that wires real services against a tmp `$HOME` and asserts stdout + exit code (`Bun.spawn` the binary).
- TUI launch path covered by the bootstrap epic; this epic covers only the non-TUI subcommands.

## Acceptance

- Every subcommand listed in PRD §F8 works as documented.
- No subcommand contains domain logic (review checklist).
- CLI failures produce typed, actionable messages (no `console.warn` swallowing — CONSTITUTION §2.1).

## Maps to PRD

- F8, A1 (TUI launch path also exercised here).

## Blocked-by

- Config & Bootstrap, Repo & VCS adapter, Discovery, Track / Untrack, Sync.



## Summary of Changes

- Specs: `docs/specs/cli-surface-f8_*.md` (7 files).
- `src/lib/format.ts` — `relativeAge`, `padRight`, `truncate`, `formatServiceError`. `src/views/lib/relative-age.ts` re-exports for view callers.
- `src/cli/index.ts` — `runCli` dispatcher with typed `CliDeps`/`CliIO`. Exit codes 0/1/2 per PRD §F8.
- `src/cli/handlers/{status,log,add,remove,config,sync}.ts` — thin wrappers over services.
- `bin/ldf.ts` — composition-root binary; only file in the repo touching `process.exitCode`.
- `KNOWN_OPTIONS` exported from `services/config.service.ts` for the config handler.
- Tests: `src/cli/cli.test.ts` (9 cases), `src/cli/cli.smoke.integration.test.ts` (4 spawn cases), `src/lib/format.test.ts` (3 cases). Suite: 339 pass / 0 fail.

PRD acceptance touched: F8 (all rows), A1 (TUI launch path wired through bin entry; full A1 covered in QA epic).
