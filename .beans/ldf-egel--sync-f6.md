---
# ldf-egel
title: Sync (F6)
status: todo
type: epic
priority: normal
created_at: 2026-05-01T04:21:47Z
updated_at: 2026-05-01T04:22:04Z
parent: ldf-euyx
blocked_by:
  - ldf-j9pe
  - ldf-hia6
  - ldf-zf8l
---

Deliver PRD §F6 sync: `jj git fetch` + `jj git push`, conflict surface, and in-TUI scheduled auto-sync.

## Scope

### Domain

- `SyncState` already in repo domain — extend with conflict descriptor (`{ path, kind: "ours/theirs/edit-pending" }`).

### Service

- `services/sync.service.ts` — `fetch()`, `push()`, `sync()` (fetch+push), `resolve(path, choice)`. Conflict detection parses jj output. `$EDITOR` route for `edit` choice via `Bun.spawn` with stdio inheritance.
- Schedules: `auto_sync_interval` of `hourly|daily|weekly`. Scheduler is a service-owned `setInterval` started on TUI mount, stopped on unmount (no daemon — PRD N7).

### Actor

- `actors/sync.actor.ts` — owns schedule + last sync + ahead/behind + conflict list. Messages: `runSync`, `cancel`, `resolveConflict`. Emits `syncStarted`, `syncProgress`, `syncCompleted`, `syncConflict`, `syncFailed`.

### Controller / View

- `controllers/sync.controller.ts` — `useSyncPanel()`.
- `views/panels/sync-panel.tsx` — header (remote · branch · ahead/behind), action row `[Fetch] [Push] [Sync]`, body switches by state (clean / in-flight / conflict). Conflict list with per-file `[Ours] [Theirs] [Edit]` actions.

### Tests

- Service unit tests with fake jj repo: clean push, fast-forward fetch, conflict surfaced as typed list, resolve choice persisted.
- Integration: round-trip against a tmp git remote (`Bun.spawn("git", ["init", "--bare"])` for the remote), assert ahead/behind reporting (PRD A6).

## Acceptance

- PRD A6 — `ldf sync` against a configured remote performs fetch+push and reports ahead/behind correctly; conflicts list affected paths.
- Auto-sync runs only while TUI is open (PRD N7).
- `$EDITOR` resolution path works without leaking process exit.

## Maps to PRD

- F6, A6.

## Blocked-by

- Foundation, Config & Bootstrap, Repo & VCS adapter.
