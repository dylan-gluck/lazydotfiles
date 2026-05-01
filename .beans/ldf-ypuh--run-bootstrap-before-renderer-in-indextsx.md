---
# ldf-ypuh
title: Run bootstrap before renderer in index.tsx
status: todo
type: task
priority: normal
created_at: 2026-05-01T04:23:32Z
updated_at: 2026-05-01T04:26:11Z
parent: ldf-hia6
blocked_by:
  - ldf-j9pe
---

Per PRD §7.1 user must never see a half-bootstrapped UI. Failure -> typed error path, no process.exit.
