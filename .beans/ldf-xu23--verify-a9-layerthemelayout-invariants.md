---
# ldf-xu23
title: Verify A9 layer/theme/layout invariants
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:25:32Z
updated_at: 2026-05-01T18:51:15Z
parent: ldf-swfv
blocked_by:
    - ldf-zfcv
    - ldf-kkzc
---

bun run check:layers script: no process.exit, no hex outside views/theme/, no hand-rolled width/height for layout flow.
