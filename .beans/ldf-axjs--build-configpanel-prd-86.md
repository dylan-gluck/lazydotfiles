---
# ldf-axjs
title: Build ConfigPanel (PRD §8.6)
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

Sections (Paths, Discovery, Options, Experimental) as labeled forms. Field row with focused-modal edit. Save through config.service with inline validation.

## Summary of Changes

- New `config.controller.ts`, `config-panel.tsx`, `/config` route (`/settings` removed).
- Keymap binding 3 -> Config; root hint updated.
- Sections, focused row, boolean toggle on Enter, scalar inline editor.
- Snapshot tests in config-panel.test.tsx.
- Spec: `docs/specs/view-panels-and-ux-polish_build-configpanel-prd-86.md`.
