---
# ldf-8ubg
title: Extend repo.actor with restore messages
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:32Z
updated_at: 2026-05-01T17:23:41Z
parent: ldf-z560
blocked_by:
    - ldf-vcv0
---

restoreOp, restoreFromBackup. Emits restored event. Re-uses symlink repo for re-materialization.


## Summary of Changes
- `src/actors/repo.actor.ts`: extended messages with `restoreToOp`, `restoreFromBackup`, `restoreOk`, `restoreFailed`; added `restoring` state slice, `restored` / `restoreFailed` events.
- `restoreOk` chains a `refresh` so the panel state catches up automatically.
- `repoReducer` `refreshOk` now spreads prior state to preserve `restoring`.
- Tests: extended `src/actors/repo.actor.test.ts` with reducer + e2e effect coverage.
