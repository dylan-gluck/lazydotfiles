---
# ldf-bbxq
title: Build StatusPanel (PRD §8.1)
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

Header + 3-up cards (Tracked / Queue / Sync, each flexGrow=1) + recent operations + 1-row toast/error rail. Subscribes to repo, discovery, sync actors.



## Summary of Changes

- New `src/controllers/status.controller.ts` (`useStatusPanel`).
- New `src/views/panels/status-panel.tsx` rendering header, 3-up cards, recent ops, toast rail.
- `src/routes/index.tsx` rewired to mount StatusPanel.
- Snapshot tests in `status-panel.test.tsx`.
- Spec: `docs/specs/view-panels-and-ux-polish_build-statuspanel-prd-81.md`.
