---
# ldf-irkm
title: Implement track.service.add with rollback
status: todo
type: task
priority: normal
created_at: 2026-05-01T04:24:20Z
updated_at: 2026-05-01T04:26:12Z
parent: ldf-vcv0
blocked_by:
  - ldf-zf8l
---

PRD §F3 sequence: validate -> snapshot -> move -> symlink -> jj describe + snapshot -> record TrackedFile. Each step reversible; failure replays inverse ops; emits addFailed.
