---
# ldf-hia6
title: Config and first-run bootstrap (F1)
status: todo
type: epic
priority: high
created_at: 2026-05-01T04:21:41Z
updated_at: 2026-05-01T04:22:04Z
parent: ldf-euyx
blocked_by:
  - ldf-j9pe
---

Deliver PRD §F1 first-run bootstrap and the `Config` aggregate that every other feature reads.

## Scope

### Domain

- `domain/config.ts` — `Config`, `Paths`, `Discovery`, `Options`, `Experimental`, `VcsKind`, `Interval` schemas (PRD §6 class diagram). Output type is `StandardSchemaV1.InferOutput`.
- Path expansion helper (`$HOME`) lives in `lib/path.ts`, not in the schema.

### Repository

- `repositories/types.ts` — `ConfigRepository` interface (`load(): Promise<Result<Config, RepoError>>`, `save(Config): Promise<Result<void, RepoError>>`).
- `repositories/config.repository.ts` — TOML read/write via `Bun.file` + a small TOML parser (or `@iarna/toml` if listed as dep — confirm before adding).
- Integration tests against `fs.mkdtemp` covering: missing file, malformed TOML, schema mismatch, round-trip.

### Service

- `services/config.service.ts` — `loadOrInit()`, `get(option)`, `set(option, value)`. `loadOrInit()` writes the README default config when absent and resolves `$HOME` placeholders.
- `services/bootstrap.service.ts` — orchestrates F1: load/init config → ensure `$HOME/dotfiles` is a colocated `jj git init` repo → ensure `$HOME/.dotfiles.bak` exists. Idempotent. Result-typed.
- Unit tests with fake repositories.

### Composition

- `composition/services.ts` wires `config` and `bootstrap`.
- `src/index.tsx` calls `bootstrap.run()` **before** `createCliRenderer` so the user never sees a half-bootstrapped UI (PRD §7.1).

### Actor

- `actors/config.actor.ts` — owns loaded `Config`, `set` message routes through service, emits `configChanged` event.

## Acceptance

- A clean account: `ldf` writes the default `config.toml`, initializes `$HOME/dotfiles` via `jj git init`, creates `$HOME/.dotfiles.bak`, opens TUI on `/`. (PRD A1.)
- Second launch on a healthy install touches no files (idempotent).
- Bootstrap failure surfaces a typed error in the TUI; `process.exit` is **not** called.

## Maps to PRD

- F1 (first-run bootstrap), domain entity `Config`, A1.

## Blocked-by

- Foundation epic.
