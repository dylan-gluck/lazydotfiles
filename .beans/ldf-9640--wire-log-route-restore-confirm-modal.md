---
# ldf-9640
title: Wire /log route + restore confirm modal
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:32Z
updated_at: 2026-05-01T17:23:41Z
parent: ldf-z560
blocked_by:
  - ldf-vcv0
---

Thin route shell. Both restore paths route through ConfirmModal.

## Summary of Changes

- `src/routes/log.tsx`: thin shell route that mounts `LogPanel` and dispatches `repo.refresh` on mount.
- `src/controllers/keymap.ts`: added `[6] Log` global binding.
- `src/routes/__root.tsx`: footer hint updated.
- `src/routeTree.gen.ts`: regenerated via `bun run generate-routes`.
