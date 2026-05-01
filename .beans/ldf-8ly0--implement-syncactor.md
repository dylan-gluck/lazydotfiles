---
# ldf-8ly0
title: Implement sync.actor
status: todo
type: task
priority: normal
created_at: 2026-05-01T04:24:44Z
updated_at: 2026-05-01T04:26:13Z
parent: ldf-egel
blocked_by:
    - ldf-zf8l
---

Owns schedule + last sync + ahead/behind + conflict list. Messages: runSync, cancel, resolveConflict. Events: syncStarted, syncProgress, syncCompleted, syncConflict, syncFailed.
