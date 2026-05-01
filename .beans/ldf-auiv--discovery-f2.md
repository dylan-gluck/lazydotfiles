---
# ldf-auiv
title: Discovery (F2)
status: completed
type: epic
priority: normal
created_at: 2026-05-01T04:21:47Z
updated_at: 2026-05-01T16:11:56Z
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

## Summary of Changes

Discovery (F2) shipped end-to-end:

- Specs: `docs/specs/discovery-f2_*.md` (8 files).
- Domain: `src/domain/candidate.ts` (`DiscoveryCandidate`, `Reason`, `CandidateStatus`, `makeCandidate`).
- Repository: `src/repositories/fs-scanner.repository.ts` (gitignore-semantic scan, sibling walk, `classifyPath`, `isGlobPattern`).
- Service: `src/services/discovery.service.ts` (`scan`, `expandSiblings`, `decide`; auto-track callback seam for the future track phase).
- Actor: `src/actors/discovery.actor.ts` (rescan/expand/accept/reject/defer; pure reducer + service-driven effects).
- Controller: `src/controllers/discovery.controller.ts` (`useDiscoveryPanel` hook).
- View: `src/views/panels/discovery-panel.tsx` (sidebar grouped by parent dir, detail pane, footer counts, empty/scanning/error states; flexbox-only).
- Route: `src/routes/discover.tsx` (`/discover`); keymap binds `[4]`.
- Tests: candidate schema, classify rules, scanner integration, service unit, actor reducer + effect, panel snapshot, A2 end-to-end against a real tmp HOME (`tests/discovery.a2.test.ts`).
- Wiring: `src/composition/services.ts` adds `discovery`; `src/composition/actors.ts` spawns `discovery` actor.

PRD acceptance: A2 verified by `tests/discovery.a2.test.ts` (zshrc auto-tracks, fish config queued, sibling expansion surfaces other entries). Re-scan keybinding is effect-driven via the actor runtime.

169 tests pass; `tsc --noEmit` clean; `oxlint` and `oxfmt` clean.
