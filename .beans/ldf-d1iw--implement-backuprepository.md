---
# ldf-d1iw
title: Implement backup.repository
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:24:20Z
updated_at: 2026-05-01T16:36:16Z
parent: ldf-vcv0
blocked_by:
  - ldf-zf8l
---

snapshot(srcPath, trigger) -> deterministic <id>/<timestamp>/. Bun.write preserves mode; cross-device fallback to node:fs.cp.
