---
# ldf-jl3y
title: Implement restore.service (op + backup paths)
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:32Z
updated_at: 2026-05-01T17:23:41Z
parent: ldf-z560
blocked_by:
    - ldf-vcv0
---

restoreToOp -> jj op restore + symlink re-materialization through symlink repo. restoreFromBackup -> copy snapshot over symlink target, leave jj history untouched, record restore as new BackupRecord.


## Summary of Changes
- `src/services/restore.service.ts`: `RestoreService` with `restoreToOp` (re-materializes symlinks via `SymlinkRepository`) and `restoreFromBackup` (copies snapshot, records new `BackupRecord` trigger=restore).
- Tests: `src/services/restore.service.test.ts` (6 cases including Rollback path).
- Wired into `src/composition/services.ts` as `Services.restore`.
