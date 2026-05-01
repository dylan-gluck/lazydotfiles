# Spec — Follow-up beans for post-MVP work

- **Source bean:** `ldf-w9v5`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §3 N1–N7](../prds/001_mvp.md), [PRD §10 Q3](../prds/001_mvp.md).

## Goal

Enumerate and file follow-up beans for every deferred non-goal and open question that requires post-MVP work.

## Public surface

No production code changes. Deliverable: beans created via `beans add` for each item below.

**Before running any command, the implementer MUST run `beans add --help` to confirm the exact flag set.** The commands below assume `--title`, `--body`, `--type=task`, and `--parent` flags; adjust syntax if the CLI differs.

## Beans to file

### 1. Multi-profile selection (PRD N1)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="Multi-profile / multi-machine selection" \
  --body="Support multiple profiles per machine so users can maintain separate dotfile sets (e.g. work vs. personal). Currently one profile per machine per ADR-001. See PRD §3 N1."
```

### 2. API-key sanitization (PRD N2)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="API-key sanitization (experimental.detect_api_keys)" \
  --body="Implement the experimental.detect_api_keys feature to scan tracked files for API keys and secrets before committing. Listed as experimental in README. See PRD §3 N2."
```

### 3. Templated dotfiles (PRD N3)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="Templated dotfiles with variable substitution" \
  --body="Support template syntax (e.g. {{hostname}}) in tracked dotfiles, expanding variables at symlink-materialization time. See PRD §3 N3."
```

### 4. Three-way merge UI (PRD N4)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="Three-way merge conflict UI" \
  --body="Upgrade sync conflict resolution from pick-ours/pick-theirs to a three-way merge editor within the TUI. Current MVP shows conflicts and lets user pick a side. See PRD §3 N4."
```

### 5. Git VCS backend (PRD N5)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="Git VCS backend support" \
  --body="Add git as an alternative VCS backend alongside jj. MVP supports only vcs=jj (colocated). The VCS adapter interface in jj.repository.ts is the extension point. See PRD §3 N5."
```

### 6. Background daemon (PRD N7)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="Background sync daemon" \
  --body="Run auto-sync outside the TUI via a background daemon process. MVP auto-sync runs only while the TUI is open or via manual cron/launchd. See PRD §3 N7."
```

### 7. Backup GC (PRD Q3)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="Backup garbage collection and retention policy" \
  --body="Implement configurable backup retention (age-based or count-based GC) for the .dotfiles.bak directory. MVP has no GC; disk usage grows unbounded. See PRD §10 Q3."
```

### 8. Backup directory size in Status panel (Q3 follow-up)

```sh
beans add --type=task --parent=ldf-swfv \
  --title="Show backup directory size in Status panel" \
  --body="Add a backup-dir-size metric to UseStatusPanel and display it in the Status panel. PRD Q3 says 'surface size in Status' but the current implementation has no such field. Requires adding a size computation to the status controller."
```

## Internal design

Each bean is a standalone task with no implementation detail — just a tracking ticket. The `--parent=ldf-swfv` links them to the MVP epic for traceability. The implementer runs the commands sequentially and records the resulting bean IDs in `docs/RELEASE_NOTES_v0.1.md` §5.

## Dependencies

- `beans` CLI available in PATH.
- `docs/RELEASE_NOTES_v0.1.md` (created by release-notes spec `ldf-gd64`) for back-linking.

## Tests

No test deliverable. This spec produces tracking beans, not code.

## Acceptance

- All 8 beans are created via `beans add`.
- Each bean has a title, body citing the PRD section, type `task`, and parent `ldf-swfv`.
- Bean IDs are recorded in `docs/RELEASE_NOTES_v0.1.md` §5.

## Review

Approved. No constitution violations — this spec produces only tracking artifacts. N6 (network-discovered remotes) is intentionally excluded: the PRD states the remote URL is user-configured, making this a permanent design choice rather than deferred work.
