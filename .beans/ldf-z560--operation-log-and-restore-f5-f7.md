---
# ldf-z560
title: Operation log and restore (F5, F7)
status: completed
type: epic
priority: normal
created_at: 2026-05-01T04:21:47Z
updated_at: 2026-05-01T17:23:41Z
parent: ldf-euyx
blocked_by:
  - ldf-j9pe
  - ldf-hia6
  - ldf-zf8l
  - ldf-vcv0
---

Deliver PRD §F5 operation log + §F7 restore from backup, with the `/log` view as a navigable timeline.

## Scope

### Service

- `services/operation.service.ts` — projects `jj op log` + `jj log` to a unified `Operation[]` stream (kind, hash, description, timestamp, parent, files touched, diff loader). Pagination-friendly.
- `services/restore.service.ts` — two paths:
  - `restoreToOp(opId)` → `jj op restore` → repo actor re-materializes symlinks for any tracked file whose target changed. Re-materialization runs through the same symlink repo as add/remove (one source of truth).
  - `restoreFromBackup(backupId)` → copies snapshot back over the symlink target, leaving jj history untouched. Records the restore as a fresh `BackupRecord` with `trigger = "restore"`.

### Actor

- Extends `repo.actor` with `restoreOp` / `restoreFromBackup` messages. Emits `restored` event.

### Controller / View

- `controllers/log.controller.ts` — list + diff loader + restore actions.
- `views/panels/log-panel.tsx` — left list (kind icon · description · short hash · relative time), right detail (description, files, diff preview, paged). Layout: `flexDirection="row"`, sidebar `flexBasis=42`, detail `flexGrow=1`, body `flexGrow=1` scrollable.
- Keymap: `Enter` open diff, `R` restore working copy to op, `B` restore from backup at this point.
- Confirmation modal for both restore paths.

### Tests

- Service unit tests on the projection (fake jj outputs).
- Integration: restore-to-op rewinds working copy and re-materializes symlinks without leaving the TUI (PRD A7).

## Acceptance

- PRD A7 — restoring from `jj op log` rewinds working copy and re-materializes symlinks; user does not need to leave the TUI.
- Restore from backup works independently of jj (PRD §F7).

## Maps to PRD

- F5, F7, A7.

## Blocked-by

- Foundation, Config & Bootstrap, Repo & VCS adapter, Track / Untrack.

## Summary of Changes

- Specs: 6 files at `docs/specs/operation-log-and-restore-f5-f7_*.md`.
- Domain: `OperationView` schema.
- Repository: `JjRepository.{logAtOp,diffSummaryAtOp,diffAtOp}` plus `parseDiffSummary`.
- Services: `OperationService`, `RestoreService` wired in `composition/services.ts`.
- Actor: `repo.actor` extended with restore message+state+events; chained refresh on `restoreOk`.
- View: `LogPanel` + `useLogPanel` controller + `/log` route + `[6] log` keybinding.
- Tests: 273 pass (45 files); A7 integration test green; tsc + oxlint + oxfmt clean.
- PRD acceptance: A7 demonstrated end-to-end. F5 (op log + diff + restore) and F7 (backup restore path) implemented.
