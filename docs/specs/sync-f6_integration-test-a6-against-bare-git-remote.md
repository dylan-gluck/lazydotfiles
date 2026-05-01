# Spec: A6 integration test against a bare git remote

| Field         | Value                           |
| ------------- | ------------------------------- |
| Bean          | `ldf-g7e7`                      |
| Parent epic   | `ldf-egel` (Sync F6)            |
| PRD reference | §A6                             |
| ADR reference | Constitution §3.1, ADR-001 §4.7 |

## Goal

Prove the round-trip end-to-end: a bare git remote, a colocated jj clone, sync.fetch + sync.push, ahead/behind reporting before and after.

## Public surface

`src/services/sync.service.a6.integration.test.ts` (file path; no exports beyond `describe` blocks).

## Internal design

Single test, single `withTmpDir`:

1. Create a bare remote with `Bun.spawn(["git", "init", "--bare", remoteDir])`.
2. Bootstrap a `home` via `wireServices({home})` and `services.bootstrap.run()`. Repo is at `${home}/dotfiles`, jj-git-init colocated.
3. Add the bare remote: `Bun.spawn(["git", "-C", `${home}/dotfiles`, "remote", "add", "origin", remoteDir])`. Push an initial commit so the remote has a default branch:
   - Track a small file (`.zshrc`) via `services.track.add` to produce a real change.
   - Create or set a tracked bookmark on `@-` via `Bun.spawn(["jj","-R",dotfiles,"bookmark","set","main","-r","@-"])`.
4. `services.sync.push()` → ok. `services.sync.state()` reports `ahead: 0, behind: 0, remote === remoteDir` (or matching URL).
5. Create a divergent commit on the remote:
   - In a separate clone (`git clone <remote> outside`), commit a file, push.
6. `services.sync.fetch()` → ok. `state()` reports `behind > 0`.
7. `services.sync.sync()` (fetch + push) → ok; ahead/behind both zero.
8. Conflict path: simulate a conflicting edit on remote and locally, push, then `sync()`; assert returned `SyncOutcome.conflicts.length > 0` and `state.conflicts[0].path` matches the file path.

`tmpdir` cleanup is automatic via `withTmpDir`.

The test **MUST** skip with a clear message when `git` or `jj` are not on `$PATH` (using `Bun.which`); CI is expected to provide both.

## Dependencies

- Specs: sync.service, sync-state-conflict-descriptor.
- Code: `composition/services.ts`, `repositories/jj.repository.ts`, `test-utils/tmp.ts`.

## Tests

This file IS the test. No further test scaffolding.

## Acceptance

- `bun test src/services/sync.service.a6.integration.test.ts` passes against the local toolchain.
- The test exercises fetch, push, sync, and conflict surface — all paths required by PRD §A6.
- No real `$HOME` is touched (uses `withTmpDir`).

## Review

- Cross-spec interfaces verified: `ConflictDescriptor` (domain) → `SyncState.conflicts` → `SyncOutcome` → `SyncActorState.conflicts` → `SyncPanel`. `ResolveChoice` exported from sync.service consumed by actor and panel.
- PRD coverage: F6 (fetch/push/sync/resolve/auto-sync) + A6 (round-trip integration) covered.
- Constitution checks: no `process.exit`, no width/height for layout flow, no hex literals in components, every boundary returns `Result<T, ServiceError>`.
- Approved.
