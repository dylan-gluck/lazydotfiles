---
# ldf-vcv0
title: Track and untrack with backups (F3, F4, F7)
status: todo
type: epic
priority: high
created_at: 2026-05-01T04:21:47Z
updated_at: 2026-05-01T15:10:19Z
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
