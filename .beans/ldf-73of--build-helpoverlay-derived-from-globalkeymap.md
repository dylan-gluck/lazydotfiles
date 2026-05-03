---
# ldf-73of
title: Build HelpOverlay derived from globalKeymap
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

Two-column keys -> description. Bound to ? and Esc to close. Pure render of the keymap table.

## Summary of Changes

- New `help-overlay.tsx` + `help-overlay-context.tsx`; Provider wraps app in index.tsx.
- GlobalKeys consumes `useHelpOverlay` so `?` toggles overlay; Esc/? close.
- Snapshot tests in help-overlay.test.tsx + help-overlay-context.test.tsx.
- Spec: `docs/specs/view-panels-and-ux-polish_build-helpoverlay-derived-from-globalkeymap.md`.
