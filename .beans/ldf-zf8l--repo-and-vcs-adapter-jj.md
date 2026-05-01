---
# ldf-zf8l
title: Repo and VCS adapter (jj)
status: completed
type: epic
priority: high
created_at: 2026-05-01T04:21:47Z
updated_at: 2026-05-01T15:58:04Z
parent: ldf-euyx
blocked_by:
    - ldf-j9pe
    - ldf-hia6
---

Adapter layer over `jj` so every higher feature reads/writes the dotfiles repo through a single typed surface.

## Scope

### Domain

- `domain/repo.ts` — `Repo`, `Operation`, `OperationKind` (`init|track|untrack|edit|sync`), `SyncState` schemas (PRD §6).
- `domain/tracked-file.ts` — `TrackedFile`, `Status`, `DotfileKind`. `id = sha256(target)` invariant lives in a factory function.

### Repository

- `repositories/jj.repository.ts` — wraps `Bun.spawn(["jj", ...])` with structured argument arrays (no shell strings). Methods: `init(root)`, `describe(opts)`, `snapshot()`, `opLog()`, `log()`, `gitFetch()`, `gitPush()`, `opRestore(opId)`, `status()`. Each parses `jj`'s output into domain `Operation[]` / `SyncState` via a schema.
- `repositories/tracked-file.repository.ts` — persists the `TrackedFile` index (one JSON per id under `<dotfiles>/.ldf/tracked/`). Schema-validated reads.
- Integration tests against a real `jj` binary in a tmp colocated repo.

### Service

- `services/repo.service.ts` — `head()`, `operations()`, `restoreOp(id)`, `dirty()`. Translates `RepoError` to `ServiceError`.
- Reducer-friendly: returns plain data, no `jj` types leak.

### Actor

- `actors/repo.actor.ts` — owns tracked-file list + cached `Operation[]` + dirty flag. Emits `operationsLoaded`, `repoDirtyChanged`.

## Acceptance

- Round-trip integration test: `init → describe → snapshot → opLog` returns parsed `Operation[]` matching the change.
- Service exposes head, ops, dirty without leaking `jj` strings.
- Process-spawn error path returns a typed `RepoError`, not a thrown string.

## Maps to PRD

- F5 read path, F6 underpinning, F7 backup path independent of jj. Aggregate root for ADR-001 §4.2.

## Blocked-by

- Foundation, Config & Bootstrap (needs `paths.dotfiles`).



## Summary of Changes

Repo and VCS adapter landed end-to-end:

- Specs: `docs/specs/repo-and-vcs-adapter-jj_*.md` (7 files).
- Domain: `src/domain/repo.ts` (Operation, OperationKind, SyncState, Repo, parseOperationKind), `src/domain/tracked-file.ts` (TrackedFile + sha256(target) factory).
- Repositories: `src/repositories/jj.repository.ts` (renamed from `vcs.repository.ts`; added describe/snapshot/opLog/log/opRestore/status/gitFetch/gitPush, all argument-array, with US-separated jj templates and a typed `Spawn` RepoError variant); `src/repositories/tracked-file.repository.ts` (per-id JSON index under `<dotfiles>/.ldf/tracked/`, schema-validated reads).
- Service: `src/services/repo.service.ts` (head/operations/syncState/dirty/restoreOp/trackedFiles; lifts RepoError into ServiceError).
- Actor: `src/actors/repo.actor.ts` (refresh reducer with operationsLoaded + repoDirtyChanged events; wired through composition root).
- Tests: 133 pass / 0 fail across 22 files; integration suite against real `jj` covers init→describe→snapshot→opLog/log round-trip and the typed Spawn error path.
- Tooling: `bun lint` clean, `bun fmt` clean, `tsc --noEmit` clean.
