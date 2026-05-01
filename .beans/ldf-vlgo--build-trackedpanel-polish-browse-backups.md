---
# ldf-vlgo
title: Build TrackedPanel polish + browse backups
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:25:10Z
updated_at: 2026-05-01T18:20:25Z
parent: ldf-kkzc
blocked_by:
    - ldf-z560
    - ldf-egel
---

Builds on the panel from the Track epic. Adds browse-backups affordance and Enter-to-/log-filtered-by-file.



## Summary of Changes

- TrackedPanel gained `onViewLog`; Enter on focused row jumps to /log filtered by file.
- LogController extracted `filterOpsByFile`; `/log` route now reads `file` search param.
- Tests: extended tracked-panel.test.tsx, new log.controller.test.tsx.
- Spec: `docs/specs/view-panels-and-ux-polish_build-trackedpanel-polish-browse-backups.md`.
