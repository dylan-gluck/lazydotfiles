---
# ldf-kkzc
title: View panels and UX polish
status: completed
type: epic
priority: normal
created_at: 2026-05-01T04:21:53Z
updated_at: 2026-05-01T18:20:25Z
parent: ldf-euyx
blocked_by:
  - ldf-j9pe
  - ldf-hia6
  - ldf-zf8l
  - ldf-auiv
  - ldf-vcv0
  - ldf-z560
  - ldf-egel
---

Land the views inventory in PRD §8 that earlier epics did not already complete: Status, Tracked, Config, Help, confirmation modals, theme polish.

## Scope (each panel = one task)

### Status (`/`) — PRD §8.1

- Header (repo path · branch · dirty flag).
- Cards 3-up (`flexDirection="row"`, each `flexGrow={1}`): Tracked / Discovery queue / Sync.
- Recent operations list (last 5, navigates to `/log`).
- Toast/error rail (`height={1}`, anchored bottom).
- Subscribes to `repo`, `discovery`, `sync` actors.

### Tracked (`/tracked`) — PRD §8.3

- Row-shaped table via `flexDirection="row"`, columns: target · kind · added · last touched · backup count.
- Detail pane: link target, source path, symlink validity, backup history.
- Actions: `u` untrack, `b` browse backups, `Enter` jump to `/log` filtered by file.

### Config (`/config`) — PRD §8.6

- Sections (`Paths`, `Discovery`, `Options`, `Experimental`) as labeled forms.
- Field row: label · current value · `Enter` to edit (focused modal).
- Save through `config.service`; inline validation errors before save.

### Help overlay — PRD §8.7

- Modal derived from `globalKeymap` (ADR-002 §4.5).
- Two-column `keys → description`; closes on `?` or `Esc`.

### Confirmation modal — PRD §8.8

- Reused across destructive ops. Title, summary, paths affected, backup destination, `[Confirm]/[Cancel]`. `Esc` cancels.

### Theme polish

- Audit views from earlier epics for hex literals; replace with `useTheme()` tokens.
- Replace any width/height number used for layout flow with flex equivalents (CONSTITUTION §2.2 / non-negotiable #6).

### Tests

- Snapshot tests per panel via `@opentui/react/test-utils` + `ThemeProvider` + stubbed controller hooks (PRD A8).

## Acceptance

- Every PRD §8 view exists, is wired through a controller hook, and consumes only props + theme.
- No `process.exit`, no hex literals outside `views/theme/`, no hand-rolled width/height for layout flow (PRD A9 / CONSTITUTION §6).
- Snapshot tests cover each panel.

## Maps to PRD

- §8 inventory, A8, A9.

## Blocked-by

- Foundation, Config & Bootstrap, Repo & VCS adapter, Discovery, Track / Untrack, Operation log & restore, Sync.

## Summary of Changes

- Phase ldf-kkzc complete. All 7 child tasks completed.
- New panels: StatusPanel (/), ConfigPanel (/config; replaces /settings).
- New shared component: HelpOverlay + provider; `?` toggles, esc/\? close.
- TrackedPanel polished: Enter -> /log filtered by file (search param).
- Audits: no hex literals outside views/theme/, no hand-rolled width/height beyond `height={1}` status bars; locked in by tests.
- Snapshot coverage extended to AppShell, BootstrapErrorPanel, plus new panels.
- Specs under docs/specs/view-panels-and-ux-polish\_\*.md.
- bun test: 364 pass, 0 fail. tsc --noEmit clean. oxlint/oxfmt clean.
