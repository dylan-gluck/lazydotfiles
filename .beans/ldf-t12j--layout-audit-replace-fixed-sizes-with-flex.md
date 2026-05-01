---
# ldf-t12j
title: Layout audit - replace fixed sizes with flex
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

Scan for hand-rolled width/height used for layout flow; convert to flexGrow / flexBasis / gap. Exceptions only for fixed-glyph affordances.



## Summary of Changes

- Audit confirmed only `height={1}` for permitted 1-line status bars; no other fixed sizes.
- Regression test `src/views/layout-discipline.test.ts`.
- Spec: `docs/specs/view-panels-and-ux-polish_layout-audit-replace-fixed-sizes-with-flex.md`.
