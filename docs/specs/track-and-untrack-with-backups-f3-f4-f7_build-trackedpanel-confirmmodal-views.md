# Spec — `TrackedPanel` + `ConfirmModal` views and `useTrackedPanel` controller

- **Source bean:** `ldf-ud74`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §8.3 (Tracked view)](../prds/001_mvp.md), [PRD §8.8 (Confirmation modals)](../prds/001_mvp.md), [ADR-002 §4.6](../adrs/002_tui.md), [CONSTITUTION §2.2 / §2.3](../CONSTITUTION.md), [track.actor spec](./track-and-untrack-with-backups-f3-f4-f7_implement-trackactor.md).

## Goal

Land the views and controller hook for the Tracked panel. Provide a reusable `ConfirmModal` for destructive ops (add/remove/restore) per PRD §8.8.

## Public surface

### Controller hook

File: `src/controllers/track.controller.ts`.

```ts
import type { TrackedFile } from "../domain/tracked-file";
import type { BackupRecord } from "../domain/backup";
import type { ServiceError } from "../services/types";

export interface UseTrackedPanel {
  readonly tracked: readonly TrackedFile[];
  readonly inFlight: { kind: "add" | "remove"; path: string } | null;
  readonly error: ServiceError | null;
  readonly backups: ReadonlyMap<string, readonly BackupRecord[]>; // keyed by TrackedFile.id
  readonly loadingBackups: boolean;
  refreshBackups(): void;
  add(path: string): void;
  remove(path: string): void;
  clearError(): void;
}

export function useTrackedPanel(): UseTrackedPanel;
```

The hook composes `useActor<RepoState,…>(REPO_ACTOR_ID)` for `tracked`, `useActor<TrackState,…>(TRACK_ACTOR_ID)` for `inFlight`/`error`, and `useService("backups")` (added to the composition; see Dependencies) to fetch `BackupRecord` lists per tracked id. `refreshBackups` walks `tracked` and calls `backups.list(id)` in parallel; results are stored in a `Map<id, readonly BackupRecord[]>` via `useState`. Failures collapse into `error`.

### `ConfirmModal`

File: `src/views/components/confirm-modal.tsx`.

```ts
import type { ReactNode } from "react";

export interface ConfirmModalProps {
  readonly title: string;
  readonly summary: string;
  /** Paths affected by the op (rendered as a bullet list). */
  readonly paths: readonly string[];
  /** Where the backup will land. Optional (omitted for non-destructive prompts). */
  readonly backupDestination?: string;
  /** Confirm button label. Defaults to "Confirm". */
  readonly confirmLabel?: string;
  /** Cancel button label. Defaults to "Cancel". */
  readonly cancelLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmModal(props: ConfirmModalProps): ReactNode;
```

Behavior:

- Modal is centered via `position="absolute"` + `justifyContent`/`alignItems="center"`; backdrop is a `flexGrow={1}` box behind it (no width/height numbers).
- Renders `title` (bold, `fg.accent`), `summary` (`fg.default`), bullet list of `paths` (`fg.dim` for `~/`-prefixed display strings; absolute paths shown verbatim), `backupDestination` line if provided.
- `[Confirm]` / `[Cancel]` buttons in a row at the bottom (`flexDirection="row" gap={t.space.md}`). `[Confirm]` is the default-focused button.
- `useKeyboard`: `enter`/`y` → `onConfirm`; `esc`/`n` → `onCancel`; `tab` cycles focus.
- All colors via `useTheme()`; no hex literals (CONSTITUTION §2.3).

### `TrackedPanel`

File: `src/views/panels/tracked-panel.tsx`.

```ts
import type { ReactNode } from "react";
import type { UseTrackedPanel } from "../../controllers/track.controller";

export interface TrackedPanelProps {
  readonly model: UseTrackedPanel;
}

export function TrackedPanel(props: TrackedPanelProps): ReactNode;
```

Layout (per PRD §8.3, ADR-002 §4.6.1):

```
┌── tracked ──────────────────────────────────────────┐
│ row                                                  │
│ ┌ list (flexBasis=42) ──┬── detail (flexGrow=1) ──┐ │
│ │ target  · kind · added│ link target              │ │
│ │ ...rows               │ source                   │ │
│ │                       │ valid?                   │ │
│ │                       │ backup history (records) │ │
│ └───────────────────────┴──────────────────────────┘ │
│ footer height=1 (hints + counts)                     │
└──────────────────────────────────────────────────────┘
```

- Each row is `<box flexDirection="row">` with five `<text>` children for path / kind / `addedAt` (relative) / last-touched (placeholder = `addedAt` until `Operation`-level data lands) / backup count. No CSS grid (CONSTITUTION §2.2).
- Focus tracked locally with `useState<number>(0)`; `j`/`k` move; `u` opens the `ConfirmModal` for untrack with `summary = "Untrack <relPath>?"`, `paths = [target, source]`, `backupDestination = <backupRoot>/<id>/`. Confirm calls `model.remove(target)`.
- `b` toggles a backups-detail mode that lists the focused file's `BackupRecord`s in the detail pane (rows: `createdAt` · `trigger` · `snapshotPath`).
- `Enter` is reserved for the future `/log?file=<id>` integration — for MVP, it is a no-op that displays a toast "log-by-file not yet wired" via the existing toast/error rail (deferred).
- Empty state: `flexGrow={1}` + `justifyContent`/`alignItems="center"` showing "No tracked files. Press 4 to discover." (matches discovery-panel idiom).
- Error state mirrors `discovery-panel.tsx`'s `summarizeError` helper — extract `summarizeServiceError(err)` to `views/components/summarize-error.ts` so both panels share the helper (DRY — second occurrence triggers extraction per CONSTITUTION §1.3).

### Route wiring

File: `src/routes/tracked.tsx` (new, generated by `tsr`):

```ts
import { createFileRoute } from "@tanstack/react-router";
import { useTrackedPanel } from "../controllers/track.controller";
import { TrackedPanel } from "../views/panels/tracked-panel";

export const Route = createFileRoute("/tracked")({ component: TrackedScreen });

function TrackedScreen() {
  const model = useTrackedPanel();
  return <TrackedPanel model={model} />;
}
```

`controllers/keymap.ts` adds `{ keys:["5"], description:"Tracked", run:({router}) => router.navigate({to:"/tracked"}) }`.

## Internal design

- The shared `summarizeServiceError` helper accepts `ServiceError` and returns `string`; both `TrackedPanel` and `DiscoveryPanel` use it. `DiscoveryPanel` is updated in this phase to import the shared helper (constitution rule: do not leave duplicate logic in place).
- `useTrackedPanel` re-fetches backups on every `tracked` event (subscribes via `runtime.on("tracked", refreshBackups)`); cleanup on unmount.

## Dependencies

- `track.actor` (`TRACK_ACTOR_ID`, `TrackMessage`, `TrackState`, `TrackEvent`).
- `repo.actor` (`REPO_ACTOR_ID`, `RepoState`).
- `BackupService` exposed on `Services` (composition wiring delta in `composition/services.ts`):
  - Add `backups: BackupService` to `Services`; build via `createBackupService({ repo: createBackupRepository({ backupRoot: cfg.path.backup }) })` after bootstrap resolves the path.
  - Note: composition needs the resolved `backupRoot`. Today `wireServices` runs before bootstrap. Resolution: `wireServices` already expands defaults; for the post-bootstrap resolution, `Services.backups` is constructed lazily via a `getBackups(): BackupService` accessor that reads the latest config from the config service. **MVP simplification**: pass the resolved `home` (already known) and assume `backupRoot = `${home}/.dotfiles.bak``(PRD §F1 default) at wire time. If the user has overridden`path.backup`, this MVP wiring uses the default; a follow-up bean is filed for full re-wiring on config change.
- `views/theme/`, `views/components/global-keys.tsx`, `controllers/keymap.ts`.

## Tests

`src/views/panels/tracked-panel.test.tsx` (snapshot via `@opentui/react/test-utils`):

- Empty state renders the "No tracked files." copy.
- Two tracked rows render target/kind/addedAt/backup-count columns.
- Pressing `u` on a row opens the `ConfirmModal` (asserted by querying for the modal title text in the captured frame after a key event is dispatched through the test renderer).
- Error state renders the shared `summarizeServiceError` output.

`src/views/components/confirm-modal.test.tsx`:

- Renders title, summary, paths bullets, backupDestination line.
- `enter` invokes `onConfirm`; `esc` invokes `onCancel`.
- Without `backupDestination`, the destination line is absent.

`src/controllers/track.controller.test.ts` (uses a fake `ActorRuntime` + fake `BackupService`):

- `add(path)` sends `{kind:"add", payload:{path}}` to the track actor.
- `remove(path)` sends `{kind:"remove", payload:{path}}`.
- After a `tracked` event, `refreshBackups` is invoked.
- Backups failure populates `error`.

## Acceptance

- Tracked panel renders the rows-of-flex-row table per PRD §8.3 with no width/height for layout flow.
- `ConfirmModal` is reusable and is the only modal used across destructive ops (add, remove, restore — restore consumer lands in the operation-log phase but uses the same component).
- All tests green.

## Review

Approved with one composition-root caveat documented in §Dependencies: the MVP wires `backupRoot = ${home}/.dotfiles.bak`, matching the default config. A follow-up bean covers re-wiring when `path.backup` is user-overridden — small enough to land as a service-level config-listener once the config-actor's `configChanged` event is consumed by `composition/services.ts`. This is **not** a parallel API: there is one `BackupService` in `Services`; the deferred work upgrades how it is constructed.
