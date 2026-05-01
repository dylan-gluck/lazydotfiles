# Spec: TrackedPanel polish — backups + jump to /log

- **Bean:** `ldf-vlgo` (parent epic `ldf-kkzc`)
- **PRD:** §8.3
- **Notes:** backups affordance already in place (`b` toggles detail). This spec adds the missing `Enter` → `/log` filtered by file.

## Goal

Pressing `Enter` on a focused tracked row navigates to `/log` with a `?file=<target>` search param; the log panel filters operations whose `filesTouched` include that path.

## Public surface

- `TrackedPanelProps` gains `onViewLog(target: string): void` (optional; defaults to no-op when omitted to keep tests simple).
- `useTrackedPanel()` is unchanged.
- `/log` route adds a `validateSearch` schema returning `{ file?: string }` and forwards `file` into `useLogPanel({ file })`.
- `useLogPanel(input?: { file?: string }): UseLogPanel` — when `input.file` is set, `operations` is filtered to entries whose `filesTouched` include `file` (suffix-tolerant: matches `f` exactly or `f` ending with `/<file>`).

## Internal design

- TrackedPanel `useKeyboard`: case `"return"` → `props.onViewLog(focused.target)`. Wired by route via `router.navigate({ to: "/log", search: { file: target } })`.
- `routes/log.tsx` reads `Route.useSearch()` and passes `file` through.
- LogPanel footer hint extended: `[enter] diff` retained (current); add `· filtered: <file>` when `file !== undefined` to make the filter visible.

## Tests

`src/views/panels/tracked-panel.test.tsx` extended:

- `Enter on focused row calls onViewLog with the focused target`.

`src/controllers/log.controller.test.ts` (new file):

- `filter by file returns only matching operations`.

## Acceptance

- Pressing `Enter` on Tracked navigates to `/log?file=...`.
- `/log` shows only matching operations when `file` is set.
- Both verified by tests.

## Review

PRD §8.3 satisfied. No drift.
