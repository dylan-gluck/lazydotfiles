---
# ldf-euyx
title: MVP v0.1 - discover, track, version, sync, restore
status: in-progress
type: milestone
priority: high
created_at: 2026-05-01T04:18:27Z
updated_at: 2026-05-01T15:31:34Z
---

End-to-end MVP shipping the round-trip described in PRD-001: discover → track → version → sync → restore, with no data loss and no partial states.

## Source

- [PRD-001](docs/prds/001_mvp.md) — scope, goals, non-goals, acceptance.
- [ADR-001](docs/adrs/001_project.md) — layered structure: domain → repository → service → controller → actor → view.
- [ADR-002](docs/adrs/002_tui.md) — TUI runtime, actor protocol, theme, keymap.
- [CONSTITUTION](docs/CONSTITUTION.md) — non-negotiables.

## Goals (PRD §2)

- G1 First-run bootstrap (TUI + config + jj repo, idempotent).
- G2 Discovery with sibling expansion + auto-track.
- G3 Atomic add: snapshot → move → symlink → describe, with rollback.
- G4 Atomic remove restores file at original location, preserves jj history.
- G5 CLI parity (`status`, `log`, `add`, `rm`, `config`, `sync`) over the same services.
- G6 Sync (`fetch+push`) with conflict surface.
- G7 Backup-protected destructive ops; one-keystroke restore.

## Non-goals (PRD §3)

- N1 Multi-profile selection
- N2 API-key sanitization
- N3 Templated dotfiles
- N4 Three-way merge UI
- N5 Non-jj VCS
- N6 Network-discovered remotes
- N7 Background daemon

## Acceptance gate (PRD §9)

A1–A9 demonstrably true on a clean account before completion.

## Build phases (epics)

1. Foundation — composition root, lib, schema, theme, actor runtime, keymap.
2. Config & Bootstrap — F1.
3. Repo & VCS adapter — jj git init, Operation stream, SyncState reads.
4. Discovery — F2.
5. Track / Untrack with backups — F3, F4, F7.
6. Operation log & restore — F5, F7.
7. Sync — F6.
8. CLI surface — F8.
9. View panels & UX polish — Status, Tracked, Log, Sync, Config, Help, modals.
10. Acceptance & QA — A1–A9 verification.
