---
# ldf-gxgq
title: Integration test A7 restore stays in TUI
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:32Z
updated_at: 2026-05-01T17:23:41Z
parent: ldf-z560
blocked_by:
  - ldf-vcv0
---

Working copy rewinds and symlinks re-materialize without leaving the TUI.

## Summary of Changes

- `src/services/restore.service.a7.integration.test.ts`: end-to-end track → untrack → `services.restore.restoreToOp(headOp.opId)` against a real `jj` binary in `withTmpDir`. Asserts symlink rematerialized and source content preserved — PRD A7 satisfied through the same services the TUI binds.
