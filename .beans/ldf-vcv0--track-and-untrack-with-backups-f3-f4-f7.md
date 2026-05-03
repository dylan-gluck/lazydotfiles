---
# ldf-vcv0
title: Track and untrack with backups (F3, F4, F7)
status: completed
type: epic
priority: high
created_at: 2026-05-01T04:21:47Z
updated_at: 2026-05-01T16:51:00Z
parent: ldf-euyx
blocked_by:
  - ldf-j9pe
  - ldf-hia6
  - ldf-zf8l
---

Deliver atomic add/remove with snapshot-protected rollback (PRD §F3, §F4, §F7).

## Scope

### Domain

- `domain/backup.ts` — `BackupRecord`, `Trigger` (`add|remove|restore`). `snapshotPath` immutable post-creation.

### Repository

- `repositories/backup.repository.ts` — `snapshot(srcPath, trigger)`, `list(trackedFileId)`, `read(id)`. Files copied via `Bun.write` preserving mode; cross-device fallback to `node:fs.cp`.
- `repositories/symlink.repository.ts` — `materialize(target, link)`, `unlink(path)`, `read(path)`, `isLdfSymlink(path)`.

### Service

- `services/backup.service.ts` — thin orchestrator over the repo with deterministic `<id>/<timestamp>/` paths.
- `services/track.service.ts` — `add(absolutePath)` runs PRD §F3 sequence: validate → snapshot → move → symlink → describe + snapshot in jj → record `TrackedFile`. Each step is a discrete, reversible transaction; failure replays inverse ops up to the failure point and emits `addFailed` with rollback result.
- `services/track.service.ts` — `remove(absolutePath)` runs PRD §F4 inverse: validate symlink ownership → snapshot current target content → materialize copy back → describe + snapshot in jj → mark `TrackedFile.status = "untracked"`.
- Validation rules: target exists, is not a symlink already pointing into `dotfiles`, is not under `dotfiles`. Reject with typed error.

### Actor

- `actors/track.actor.ts` — `add | remove` messages → service effects → `tracked | untracked | addFailed | removeFailed` events. State carries the in-flight op so views can show progress.

### Controller / View

- `controllers/track.controller.ts` — `useTrackedPanel()` + `useAddDotfile()` + `useRemoveDotfile()`.
- Confirmation modal per PRD §8.8 — title, summary, paths, backup destination, `[Confirm]/[Cancel]`, `Esc` cancels.
- Views: `views/panels/tracked-panel.tsx` (table-shaped via `flexDirection="row"` rows), backup history pane.

### Tests

- Service unit tests with fake repos covering each rollback branch.
- Integration test in a tmp `$HOME` with a real jj repo: kill mid-add (SIGTERM) → assert filesystem is fully tracked **or** fully restored, never half (PRD A5).
- Untrack integration: file at original location has the latest committed content; `jj log` retains history (PRD A4).

## Acceptance

- PRD A3 (backup, move, symlink, jj describe) verified end-to-end.
- PRD A4 (untrack) verified.
- PRD A5 (mid-add SIGTERM rollback) verified.

## Maps to PRD

- F3, F4, F7, A3, A4, A5.

## Blocked-by

- Foundation, Config & Bootstrap, Repo & VCS adapter.

## Summary of Changes

PRD F3, F4, F7 shipped end-to-end. PRD acceptance A3 (track sequence end-to-end), A4 (untrack preserves history), A5 (SIGTERM mid-add recovery) verified.

### Specs

All 11 specs landed under `docs/specs/track-and-untrack-with-backups-f3-f4-f7_*.md`.

### Production code

- `src/domain/backup.ts` — `BackupRecord`, `BackupTrigger`, deterministic timestamp helpers.
- `src/repositories/backup.repository.ts` — snapshot/list/read with payload + meta.json layout.
- `src/repositories/symlink.repository.ts` — only place symlinks are created or removed.
- `src/repositories/fs.repository.ts` — extended with `move`/`copyFile`/`removeFile`.
- `src/repositories/jj.repository.ts` — added `newChange` (`jj new`) so each describe lands its own change.
- `src/services/types.ts` — `ServiceError` extended with `InvalidTarget` + `Rollback` tags + `TrackStep`.
- `src/services/backup.service.ts`, `src/services/track.service.ts` (add+remove with full rollback).
- `src/actors/track.actor.ts` — `tracked`/`untracked`/`addFailed`/`removeFailed` events; refreshes `repo` actor on success.
- `src/composition/services.ts` + `src/composition/actors.ts` + new `src/composition/services-context.tsx` provider.
- `src/controllers/track.controller.ts`, `src/controllers/keymap.ts` (added `5: Tracked` binding).
- `src/views/components/confirm-modal.tsx`, `src/views/components/summarize-error.ts` (shared with discovery panel — duplicate logic in `discovery-panel.tsx` removed).
- `src/views/panels/tracked-panel.tsx`, `src/routes/tracked.tsx`.

### Tests

- 248 tests pass; lint + fmt + typecheck clean.
- Track service rollback matrix: 9 add cases (A1-A9) + 9 remove cases (R1-R9) — all observable filesystem post-state asserted.
- A4 (`track.service.untrack-history.integration.test.ts`) — real `jj`, real tmp $HOME.
- A5 (`track.service.sigterm.integration.test.ts` + `scripts/track-add-once.ts`) — 5 trials with randomized SIGTERM delay.
- Snapshot tests for `TrackedPanel` and `ConfirmModal`.

### Carve-outs (documented in specs)

- jj rollback on partial-describe leaves an empty-described change observable via `/log` rather than calling `jj op restore` from the rollback path. The filesystem invariant required by A5 holds.
- `composition/services.ts` wires `backupRoot = \$HOME/.dotfiles.bak` (default). User-overridden `path.backup` reuse via the config-actor's `configChanged` event is left as a follow-up.
