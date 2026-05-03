---
# ldf-2l2q
title: Implement operation.service projection
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:32Z
updated_at: 2026-05-01T17:23:41Z
parent: ldf-z560
blocked_by:
  - ldf-vcv0
---

Projects jj op log + jj log to unified Operation[]: kind, hash, description, timestamp, parent, files, diff loader. Pagination-friendly. Unit tests with fake jj outputs.

## Summary of Changes

- `src/domain/repo.ts`: added `OperationViewSchema` / `OperationView`.
- `src/repositories/jj.repository.ts`: added `logAtOp`, `diffSummaryAtOp`, `diffAtOp`, plus `parseDiffSummary`.
- `src/services/operation.service.ts`: `OperationService` projection + diff loader.
- Tests: `src/services/operation.service.test.ts`, `src/repositories/jj.repository.diff-summary.parse.test.ts`.
