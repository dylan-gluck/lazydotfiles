---
# ldf-ypuh
title: Run bootstrap before renderer in index.tsx
status: completed
type: task
priority: normal
created_at: 2026-05-01T04:23:32Z
updated_at: 2026-05-01T15:44:29Z
parent: ldf-hia6
blocked_by:
    - ldf-j9pe
---

Per PRD §7.1 user must never see a half-bootstrapped UI. Failure -> typed error path, no process.exit.



## Summary of Changes

Landed per spec docs/specs/config-and-first-run-bootstrap-f1_*.md. See epic ldf-hia6 for the file list and commit hash.
