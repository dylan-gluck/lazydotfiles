# Spec: SyncPanel view

| Field         | Value                                       |
| ------------- | ------------------------------------------- |
| Bean          | `ldf-166t`                                  |
| Parent epic   | `ldf-egel` (Sync F6)                        |
| PRD reference | §8.5 Sync, §F6                              |
| ADR reference | ADR-002 §4.6 (views), Constitution §2.2/2.3 |

## Goal

Render the sync state machine: header, action row, body that switches by phase, and a per-file conflict list.

## Public surface

`src/views/panels/sync-panel.tsx`:

```ts
export interface UseSyncPanel {
  readonly state: SyncState;
  readonly conflicts: readonly ConflictDescriptor[];
  readonly phase: SyncPhase;
  readonly schedule: { running: boolean; interval: Interval | null };
  readonly error: ServiceError | null;
  fetch(): void;
  push(): void;
  syncNow(): void;
  resolve(path: string, choice: ResolveChoice): void;
}
export interface SyncPanelProps {
  readonly model: UseSyncPanel;
}
export function SyncPanel({ model }: SyncPanelProps): ReactNode;
```

`src/controllers/sync.controller.ts`:

```ts
export function useSyncPanel(): UseSyncPanel;
```

## Internal design

### Layout

```
flexDirection=column flexGrow=1
├── header  flexDirection=row gap=md
│   • remote (or "(no remote)") · branch ahead/behind dirty?
├── action row  flexDirection=row gap=md
│   • [Fetch] [Push] [Sync]   (focused style via accent/dim)
├── body  flexGrow=1
│   • idle: "last sync · <relative>", "next auto-sync · <relative>" (or "off")
│   • fetching/pushing/syncing/resolving: spinner-less progress text
│   • conflict (state.conflicts.length>0): per-file rows
│       <path>   [Ours] [Theirs] [Edit]
│   • error: red box with summarizeServiceError()
└── footer  height=1
    • "[f] fetch · [p] push · [s] sync · [j/k] move · [o] ours · [t] theirs · [e] edit"
```

All sizing via flexbox. No hex literals (theme tokens only).

### Keymap (panel-local `useKeyboard`)

- `f` → `model.fetch()`; ignored when `phase != "idle"`.
- `p` → `model.push()`.
- `s` → `model.syncNow()`.
- When body shows conflicts:
  - `j`/`down`, `k`/`up` move focus through `model.conflicts`.
  - `o` → `model.resolve(focused.path, "ours")`.
  - `t` → `model.resolve(focused.path, "theirs")`.
  - `e` → `model.resolve(focused.path, "edit")`.
- Global key `q` continues to quit (handled by `globalKeymap`); `?` opens help.

### Controller

`useSyncPanel`:

- Subscribes to `useActor<SyncActorState, SyncMessage, SyncEvent>(SYNC_ACTOR_ID)`.
- Sends `refresh` on mount; sends `cancel` in cleanup.
- Returns derived `phase`, `state`, `conflicts`, `schedule`, `error`.
- Action methods send actor messages; do **not** call services directly.

### Status formatting

- Ahead/behind: `"↑3 ↓1"` (plain ASCII fallback `"+3/-1"` if unicode disallowed). Use unicode arrows; no test asserts the byte; tests assert numbers.
- `lastSyncAt`: `relativeAge(iso)` mirroring the helper already in `log-panel.tsx` (extract a shared helper at `src/views/lib/relative-age.ts` to avoid third-occurrence duplication).
- `next auto-sync` only rendered when `schedule.running`; computed as `lastSyncAt + INTERVAL_MS[interval]`.

## Dependencies

- Spec: sync.actor, scheduler, conflict-descriptor.
- Code: `actors/sync.actor.ts`, `actors/use-actor.ts`, `views/components/summarize-error.ts`, `views/theme/*`.
- New shared helper: `src/views/lib/relative-age.ts` (extract from `log-panel.tsx` and `tracked-panel.tsx`; both must be migrated in this task).

## Tests

`src/views/panels/sync-panel.test.tsx` (snapshot-style frame assertions):

- Empty/idle clean state: renders "(no remote)" header when `state.remote === null`.
- Idle with remote + ahead/behind: header contains "↑3", "↓1", and the remote URL.
- `phase = "fetching"`: body contains "fetching…".
- Conflict body: with two conflicts, both paths render; first row shows "›" focus marker.
- Error body: renders `summarizeServiceError` output.

`src/controllers/sync.controller.test.ts` (light unit, fake actor runtime):

- `fetch()` sends `runFetch` to the sync actor.
- `resolve(path, "edit")` sends `resolveConflict` with the right payload.

`src/views/lib/relative-age.test.ts`:

- `< 60s → "just now"`, `< 60m → "Nm ago"`, `< 24h → "Nh ago"`, else `"Nd ago"`.

## Acceptance

- All keybindings function as documented; conflict resolution dispatches correctly.
- No `width`/`height` numeric literals outside `height={1}` for the footer.
- No hex color in the panel; tokens only.
- View depends only on `domain/`, `actors/types`, `controllers/sync.controller`; no service/repo imports.

## Review

- Cross-spec interfaces verified: `ConflictDescriptor` (domain) → `SyncState.conflicts` → `SyncOutcome` → `SyncActorState.conflicts` → `SyncPanel`. `ResolveChoice` exported from sync.service consumed by actor and panel.
- PRD coverage: F6 (fetch/push/sync/resolve/auto-sync) + A6 (round-trip integration) covered.
- Constitution checks: no `process.exit`, no width/height for layout flow, no hex literals in components, every boundary returns `Result<T, ServiceError>`.
- Approved.
