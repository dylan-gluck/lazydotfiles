---
# ldf-auiv
title: Discovery (F2)
status: todo
type: epic
priority: normal
created_at: 2026-05-01T04:21:47Z
updated_at: 2026-05-01T04:22:04Z
parent: ldf-euyx
blocked_by:
  - ldf-j9pe
  - ldf-hia6
  - ldf-zf8l
---

Deliver PRD §F2 discovery: scan, sibling expansion, auto-track gating, and the `/discover` triage view.

## Scope

### Domain

- `domain/candidate.ts` — `DiscoveryCandidate`, `Reason` (`include|sibling-of|auto`), `CandidateStatus` (`pending|accepted|rejected|deferred`).

### Repository

- `repositories/fs-scanner.repository.ts` — globs `home` against `discovery.include`/`discovery.exclude` using gitignore semantics (Q2 default). Yields `AsyncIterable<string>` to keep memory bounded.

### Service

- `services/discovery.service.ts` — `scan(config)`, `expandSiblings(path, depth=4)` (Q2/PRD §F2), `decide(candidate, decision)`. Auto-track non-glob includes go directly to track service; glob includes hit the queue.
- Pure unit tests with a fake scanner repo.

### Actor

- `actors/discovery.actor.ts` — owns scan progress + queue + decisions. Messages: `rescan`, `expand`, `accept`, `reject`, `defer`. Emits `scanProgress`, `candidateAdded`, `candidateDecided`. Effects call the service; reducer stays pure.

### Controller / View

- `controllers/discovery.controller.ts` — `useDiscoveryPanel()` exposing list + decision actions.
- `views/panels/discovery-panel.tsx` — sidebar (grouped by parent dir, `Reason` badge, status filter) + main detail (path · kind · size · first 200 lines · siblings list). Empty queue → centered empty state. Footer keymap: `a` accept, `r` reject, `d` defer, `o` open in `$EDITOR`, `space` expand siblings.
- `routes/discover.tsx` — thin route shell.
- Snapshot tests via `@opentui/react/test-utils`.

## Acceptance

- Discovery surfaces `~/.zshrc`, `~/.config/fish/config.fish`, and at least the siblings of an accepted file (PRD A2).
- Auto-track on a non-glob include lands the file without queue interaction (PRD A2).
- Re-scan keybinding `r` does not block the UI thread (effect-driven).

## Maps to PRD

- F2, A2.

## Blocked-by

- Foundation, Config & Bootstrap, Repo & VCS adapter.

## Blocks

- Track / Untrack with backups (accept handler dispatches into add service).
