# Spec: StatusPanel (PRD §8.1)

- **Bean:** `ldf-bbxq` (parent epic `ldf-kkzc`)
- **PRD:** §8.1 / A8 / A9
- **ADR:** ADR-002 §4.6 (views), §4.4 (state seam)

## Goal

Render the dashboard at `/` showing repo health, three counter cards, recent operations, and a 1-line toast/error rail. Subscribes to `repo`, `discovery`, `sync` actors via a new controller hook; consumes only props + theme.

## Public surface

`src/controllers/status.controller.ts`:

```ts
export interface UseStatusPanel {
  readonly repoRoot: string;
  readonly dirty: boolean;
  readonly trackedCount: number;
  readonly queueCount: number;
  readonly sync: {
    lastSyncAt: string | null;
    ahead: number;
    behind: number;
    remote: string | null;
  };
  readonly recentOperations: readonly OperationView[]; // last 5 from repo actor
  readonly toast: { message: string; tone: "info" | "danger" } | null;
}
export function useStatusPanel(): UseStatusPanel;
```

`src/views/panels/status-panel.tsx`:

```tsx
export interface StatusPanelProps {
  readonly model: UseStatusPanel;
  readonly repoRoot?: string;
}
export function StatusPanel(props: StatusPanelProps): ReactNode;
```

Route shell at `src/routes/index.tsx` calls the controller and renders the panel; on mount it sends `repo.refresh` and `sync.refresh` (best-effort, ignore in-flight no-op replies).

## Internal design

- `useStatusPanel` reads `repo` (`tracked`, `operations`, `dirty`, `error`, `restoring`), `discovery` (`queue` filtered by `status === "pending"`), and `sync` (`state`, `error`).
- `recentOperations = repo.state.operations.slice(0, 5)`.
- `toast` is derived: prefer `repo.error → sync.error → discovery.error`. Otherwise `null`.
- `repoRoot` defaults to `services.home + "/dotfiles"` via `useOptionalServices`; if services are absent (in tests), falls back to prop or `"~/dotfiles"`.

## Layout

```
column flexGrow=1
  row paddingX=1 (header) — repoRoot · dirty/clean
  row gap=md (cards) — Tracked / Queue / Sync, each flexGrow=1 borderStyle=default padding=md
  column flexGrow=1 (recent ops list, scrolls naturally)
  row height=1 (toast rail)
```

All sizing via flex; only `height={1}` for the toast rail (allowed per §2.2 exception). All colors via `useTheme()`.

## Dependencies

- `actors/repo.actor.ts`, `actors/discovery.actor.ts`, `actors/sync.actor.ts` (existing).
- `views/lib/relative-age.ts` for sync ago/last-op timestamps.
- `views/components/summarize-error.ts` for toast text.

## Tests (`src/views/panels/status-panel.test.tsx`)

- `renders header with repo root and clean flag`
- `renders three cards with tracked count, queue count, sync ago`
- `renders up to 5 most recent operations`
- `renders toast when model.toast is set`
- `omits toast row content when model.toast is null` (rail still 1-line)

## Acceptance

- Route `/` renders the panel.
- Counters reflect actor state changes (verified via stub model in tests).
- No hex literals; no fixed width/height beyond `height={1}` rail.

## Review

Reviewed against PRD §8.1: header, 3-up cards, last 5 ops, toast rail — covered. No spec drift.
