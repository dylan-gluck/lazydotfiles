# LogPanel view + diff loader

- **Source bean**: `ldf-3o2s`
- **Parent epic**: `ldf-z560`
- **PRD**: §F5, §A7
- **ADR**: ADR-002 §3 (panel layout), CONSTITUTION §2.2/§2.3

## Goal

A two-pane `/log` view: left list of operations, right detail with description, files, and a paged diff. Restore actions go through `ConfirmModal` and dispatch `repo.actor` messages.

## Public surface

`src/views/panels/log-panel.tsx`

```ts
export interface LogPanelProps {
  readonly model: UseLogPanel;
}
export function LogPanel(props: LogPanelProps): ReactNode;
```

`src/controllers/log.controller.ts`

```ts
export interface UseLogPanel {
  readonly operations: readonly OperationView[];
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly error: ServiceError | null;
  readonly focusId: string | null;
  readonly diff: { opId: string; text: string } | null;
  readonly diffLoading: boolean;
  readonly restoring: { kind: "op" | "backup" } | null;
  focus(opId: string): void;
  loadDiff(opId: string): void;
  restoreToOp(opId: string): void;
  restoreFromLatestBackup(opId: string): void; // resolves changeId→trackedFile→latest backup
  refresh(): void;
}

export function useLogPanel(): UseLogPanel;
```

## Internal design

### View layout

```
<box flexDirection="row" flexGrow={1} gap={t.space.sm}>
  <box flexBasis={42} flexShrink={0} flexDirection="column"> /* list */ </box>
  <box flexGrow={1} flexDirection="column"> /* detail + diff */ </box>
</box>
```

- **List row**: `{kindIcon} {description.padEnd(28)} {opId.short} {relativeAge(at)}`.
  Icons: `init=●`, `track=+`, `untrack=−`, `sync=↻`, `edit=·`. All chars from base ASCII/box-drawing — no emoji per CONSTITUTION.
- **Detail pane**: description (bold accent), kind + opId + at (dim), `files: <list>`, then a horizontal rule, then `<box flexGrow={1}>` containing the diff scroll region.
- Diff pane uses `<text>` per line within a `<box flexGrow={1}>` with `overflow="hidden"` and a `scrollOffset` state local to the panel; PageUp/PageDown shift `scrollOffset` by the pane's measured height (use `useTerminalDimensions` already imported elsewhere; if unavailable, default to 16-line page steps).

### Keymap

- `j`/`down`, `k`/`up` — list navigation (delegates to `model.focus`).
- `Enter` — `model.loadDiff(focusId)`.
- `R` (uppercase, with shift) — open `ConfirmModal` titled "Restore working copy"; on confirm `model.restoreToOp(focusId)`.
- `B` — open `ConfirmModal` titled "Restore from backup"; on confirm `model.restoreFromLatestBackup(focusId)`.
- `PageUp`/`PageDown` — scroll the diff pane.
- The modal owns input while open (matches `tracked-panel` pattern).

### Controller

- Subscribes to `repo.actor` for `restoring` slice.
- Holds an internal `useState` for `operations`, `status`, `diff`, `diffLoading`, `focusId`.
- On mount: `services.operation.list({ limit: 50 })` → set `operations`, `status = "ready"`. Failure → `error`, `status = "error"`.
- `loadDiff(opId)` calls `services.operation.diff(opId)`; sets `diff`/`diffLoading` accordingly. Caches by `opId`.
- `restoreToOp(opId)` sends `{ kind: "restoreToOp", payload: { opId } }` to the repo actor.
- `restoreFromLatestBackup(opId)`:
  1. Look up the focused op's `changeId` → not directly enough; fall back to "the most recent backup whose `BackupRecord.createdAt` ≤ op `at`". This is implemented by walking `services.backups.list(trackedFileId)` for the tracked file the op touched. For ops with no `filesTouched` or no backup, surface a `ServiceError.NotFound` toast.
  2. Send `{ kind: "restoreFromBackup", payload: { backupId } }`.

### Layout/discipline

- No `width`/`height` literals except the `flexBasis={42}` sidebar (already approved pattern).
- All colors from `useTheme()`.
- No `process.exit`.

## Dependencies

- `src/services/operation.service.ts`
- `src/services/restore.service.ts` (indirect, via repo actor)
- `src/actors/repo.actor.ts` (extended)
- `src/views/components/confirm-modal.tsx` (existing)
- `src/views/components/summarize-error.ts`

## Tests

`src/controllers/log.controller.test.ts`

- **Mount with a fake `Services` returning two ops yields `status="ready"` and `operations.length === 2`.**
- **`loadDiff` toggles `diffLoading` and writes `diff.text` from the fake.**
- **`restoreToOp` sends `restoreToOp` message to the repo actor.**

`src/views/panels/log-panel.test.tsx`

- **Renders empty state ("No operations") when `operations.length === 0` and status is `ready`.**
- **Renders rows with description, kind icon, short opId, relative age.**
- **Renders detail pane and diff text when `diff` is set.**
- **Shows `Restore working copy` modal on `R` key (smoke; relies on `useKeyboard` event injection helper from existing tests).**

## Acceptance

- Snapshot tests pass.
- Manual visual check: list+detail+diff render at 100×24 without overlap.
- Keymap matches the spec.

## Review

- Rewrites: none.
- Approval: pending Step 4 cross-spec consistency review.
