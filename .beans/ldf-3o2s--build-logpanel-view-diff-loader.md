---
# ldf-3o2s
title: Build LogPanel view + diff loader
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:32Z
updated_at: 2026-05-01T17:23:41Z
parent: ldf-z560
blocked_by:
  - ldf-vcv0
---

Sidebar flexBasis=42, detail flexGrow=1. Kind icon, description, short hash, relative time. Diff pane scrollable. Keymap Enter / R / B.

## Summary of Changes

- `src/controllers/log.controller.ts`: `useLogPanel` hook bridging `OperationService`, `BackupService`, and the repo actor.
- `src/views/panels/log-panel.tsx`: 42-col sidebar + flex-grow detail/diff pane, kind icons, R/B confirm-modal restore paths, PgUp/PgDn diff scroll.
- Tests: `src/views/panels/log-panel.test.tsx` (5 snapshot scenarios).
