---
# ldf-jl3y
title: Implement restore.service (op + backup paths)
status: todo
type: task
priority: normal
created_at: 2026-05-01T04:24:32Z
updated_at: 2026-05-01T04:26:13Z
parent: ldf-z560
blocked_by:
  - ldf-vcv0
---

restoreToOp -> jj op restore + symlink re-materialization through symlink repo. restoreFromBackup -> copy snapshot over symlink target, leave jj history untouched, record restore as new BackupRecord.
