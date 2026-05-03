---
# ldf-394b
title: Theme audit - remove hex literals
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

Scan views/ for hex literals outside views/theme/; replace with useTheme tokens. CONSTITUTION non-negotiable #6 requirement adjacent.

## Summary of Changes

- Audit confirmed no hex literals outside `src/views/theme/`.
- Regression test `src/views/theme/no-hex-literals.test.ts` scans the tree.
- Spec: `docs/specs/view-panels-and-ux-polish_theme-audit-remove-hex-literals.md`.
