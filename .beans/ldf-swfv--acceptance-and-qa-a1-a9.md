---
# ldf-swfv
title: Acceptance and QA (A1-A9)
status: completed
type: epic
priority: normal
created_at: 2026-05-01T04:21:53Z
updated_at: 2026-05-01T18:51:40Z
parent: ldf-euyx
blocked_by:
    - ldf-j9pe
    - ldf-hia6
    - ldf-zf8l
    - ldf-auiv
    - ldf-vcv0
    - ldf-z560
    - ldf-egel
    - ldf-zfcv
    - ldf-kkzc
---

Cross-cutting acceptance verification. Walks PRD §9 A1–A9 end-to-end on a clean account, captures a script that future regressions can run, and resolves every PRD §10 open question with a documented default before declaring MVP done.

## Scope

### End-to-end harness

- `tests/e2e/` — scripted runs in a tmp `$HOME` with fake `~/.config`, `~/.zshrc`, `~/.config/fish/config.fish`. Each scenario asserts the observable outcome stated by an `Aₙ`.
- Scenarios:
  - **A1** clean account, `ldf` opens Status in <500ms (timed assertion).
  - **A2** discovery surfaces `~/.zshrc`, `~/.config/fish/config.fish`, and siblings of an accepted file; auto-track on a non-glob include lands the file without queue interaction.
  - **A3** accept candidate → backup at `<bak>/<id>/<ts>/`, file under `<dotfiles>`, working symlink, jj change `track <relpath>`.
  - **A4** `ldf rm <path>` restores file at original location with latest committed content; `jj log` retains history.
  - **A5** kill mid-add (SIGTERM) → fully tracked or fully restored, never half. Asserted via filesystem inspection after the killed process exits.
  - **A6** sync against a tmp bare git remote: ahead/behind reported, conflicts list affected paths.
  - **A7** restore from `jj op log` rewinds working copy, re-materializes symlinks; user stays in the TUI.
  - **A8** unit tests on services/reducers, integration on repos, snapshot tests on panels (audit + close gaps).
  - **A9** static review: no `process.exit` outside binary entry; no hand-rolled width/height for layout flow; no hex literals outside `views/theme/`. Encoded as a `bun run check:layers` script.

### Open questions (PRD §10)

- Q1 GPG signing — defer to v1.1; document.
- Q2 Discovery exclude — gitignore semantics; verify implemented in Discovery epic.
- Q3 Backup retention — none for MVP; surface size in Status.
- Q4 jj backend — colocated `jj git init`; verified by Repo & VCS epic.

### Deliverables

- `bun test` runs the full e2e suite.
- `docs/RELEASE_NOTES_v0.1.md` summarising goals met, non-goals deferred, follow-up beans.

## Acceptance

- A1–A9 demonstrably true on a freshly created tmp `$HOME` (script + CI-able).
- Every PRD §10 open question has a recorded resolution.
- A list of follow-up beans exists for: API-key sanitization (N2), three-way merge UI (N4), git VCS backend (N5), background daemon (N7), backup GC.

## Maps to PRD

- A1–A9, §10.

## Blocked-by

- Every prior epic.



## Summary of Changes

QA build phase shipped on 2026-05-01.

**Acceptance evidence (A1–A9):**
- A1 → `tests/e2e/a1-boot-speed.test.ts` (new)
- A2 → `tests/discovery.a2.test.ts`
- A3 → `tests/e2e/a3-add-round-trip.test.ts` (new)
- A4 → `src/services/track.service.untrack-history.integration.test.ts`
- A5 → `src/services/track.service.sigterm.integration.test.ts`
- A6 → `src/services/sync.service.a6.integration.test.ts`
- A7 → `src/services/restore.service.a7.integration.test.ts`
- A8 → `docs/audits/a8-test-coverage.md` + `src/services/sync.editor.test.ts` (new, closes only §3.1 gap)
- A9 → `tests/e2e/a9-static-invariants.test.ts` + `src/views/no-process-exit.test.ts` (new) + existing layout/hex guards + `scripts/check-layers.ts` (new)

**Specs:** 13 specs at `docs/specs/acceptance-and-qa-a1-a9_*.md`.
**Open questions:** Q1 deferred, Q2/Q4 verified, Q3 surfaced via follow-up bean. Recorded in `docs/audits/q-resolutions.md` and release notes.
**Release notes:** `docs/RELEASE_NOTES_v0.1.md`.
**Follow-up beans:** ldf-zm82, ldf-4lmw, ldf-nsgo, ldf-p1b7, ldf-euox, ldf-fy8o, ldf-2lcb (parented under milestone ldf-euyx).

**Verification:** `bun test` 387/387 pass, `bun run typecheck` clean, `bun lint` 0 errors, `bun fmt` clean, `bun run check:layers` green.
