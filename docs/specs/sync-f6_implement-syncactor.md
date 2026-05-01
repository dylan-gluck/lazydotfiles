# Spec: sync.actor

| Field         | Value                                            |
| ------------- | ------------------------------------------------ |
| Bean          | `ldf-8ly0`                                       |
| Parent epic   | `ldf-egel` (Sync F6)                             |
| PRD reference | §F6, §A6                                         |
| ADR reference | ADR-002 §4.3 (actor protocol), Constitution §1.1 |

## Goal

Own the sync state machine: schedule, in-flight progress, ahead/behind, conflict list, last-sync timestamp. Mediates between the panel and the sync service; exposes events for cross-actor reactions.

## Public surface

`src/actors/sync.actor.ts`:

```ts
import type { ConflictDescriptor, SyncState } from "../domain/repo";
import type { Interval } from "../domain/config";
import type { ServiceError } from "../services/types";
import type { ResolveChoice } from "../services/sync.service";

export type SyncPhase = "idle" | "fetching" | "pushing" | "syncing" | "resolving" | "error";

export interface SyncActorState {
  readonly phase: SyncPhase;
  readonly state: SyncState; // last known SyncState; defaults to a clean stub
  readonly conflicts: readonly ConflictDescriptor[];
  readonly schedule: { running: boolean; interval: Interval | null };
  readonly error: ServiceError | null;
}

export type SyncMessage =
  | Message<"refresh", undefined>
  | Message<"runFetch", undefined>
  | Message<"runPush", undefined>
  | Message<"runSync", undefined>
  | Message<"cancel", undefined>
  | Message<"resolveConflict", { path: string; choice: ResolveChoice }>
  | Message<"scheduleStart", { interval: Interval }>
  | Message<"scheduleStop", undefined>
  | Message<"opOk", { phase: Exclude<SyncPhase, "idle" | "error">; state: SyncState }>
  | Message<"opFailed", { phase: Exclude<SyncPhase, "idle" | "error">; error: ServiceError }>;

export type SyncEvent =
  | Event<"syncStarted", { phase: SyncPhase }>
  | Event<"syncProgress", { phase: SyncPhase }>
  | Event<"syncCompleted", { state: SyncState }>
  | Event<"syncConflict", { conflicts: readonly ConflictDescriptor[] }>
  | Event<"syncFailed", { error: ServiceError }>;

export const SYNC_ACTOR_ID = "sync";
export const initialSyncState: SyncActorState;

export function spawnSyncActor(runtime: ActorRuntime<Services>): void;
```

## Internal design

### Reducer transitions

- `refresh` → effect: `services.sync.state()`. On ok → `opOk{phase:"idle"}` (just snapshot, no started/completed events). On err → `opFailed{phase:"error"}`.
- `runFetch` while phase != idle → drop (no-op). Else: phase="fetching", emit `syncStarted{phase:"fetching"}`, effect calls `services.sync.fetch()`.
- `runPush` analogous: phase="pushing".
- `runSync` analogous: phase="syncing".
- `cancel` → phase="idle". (Actual cancellation of the underlying spawn is not implemented in MVP; `cancel` only stops further messages from being processed against the prior phase.)
- `resolveConflict` while phase != "idle" and != "resolving" → drop. Else: phase="resolving", effect calls `services.sync.resolve(payload)`.
- `opOk{phase, state}` →
  - phase = "idle"-ish refresh → updates state but does not emit `syncCompleted` (which is reserved for fetch/push/sync/resolve completion).
  - For fetch/push/sync/resolve: phase="idle", state = state, conflicts = state.conflicts, error=null. Emits `syncCompleted{state}`. If `state.conflicts.length > 0`, also emits `syncConflict{conflicts}`.
- `opFailed{phase, error}` → phase="error", error=error. Emits `syncFailed{error}`.
- `scheduleStart{interval}` → effect: `scheduler.start(interval, () => actor.send({kind:"runSync"}))`. State: schedule={running:true, interval}.
- `scheduleStop` → effect: `scheduler.stop()`. State: schedule={running:false, interval:null}.

### Effect implementation

Effects close over the scheduler (held by the actor module-level closure created at spawn). The runtime injects services; the scheduler is owned by the actor:

```ts
export function spawnSyncActor(runtime: ActorRuntime<Services>): void {
  const scheduler = createSyncScheduler();
  // closure-captured by effects
}
```

Ticks from the scheduler call the runtime's `actor.send({kind:"runSync"})` directly (the scheduler's `onTick` is bound to that send).

### Cross-actor wiring

- Listens to `configChanged` events: when `options.auto_sync` flips true → `scheduleStart` with current `auto_sync_interval`; flips false → `scheduleStop`. Implemented in `spawnSyncActor` via `runtime.on("configChanged", ...)`.

### Idle state defaults

`initialSyncState.state = { lastSyncAt: null, ahead: 0, behind: 0, dirty: false, remote: null, conflicts: [] }`.

## Dependencies

- Specs: sync.service, sync scheduler, conflict-descriptor.
- Code: `actors/runtime.ts`, `actors/types.ts`, `composition/services.ts`.

## Tests

`src/actors/sync.actor.test.ts`:

- `runFetch` → reducer transitions to `fetching`, emits `syncStarted`.
- `runFetch` while already fetching → no-op.
- `opOk{phase:"fetching", state}` → phase=idle, emits `syncCompleted`.
- `opOk` with non-empty conflicts → emits both `syncCompleted` and `syncConflict`.
- `opFailed{error}` → emits `syncFailed`, phase=error, error stored.
- `cancel` from `fetching` → phase=idle.
- `resolveConflict` dispatches one effect; `opOk` clears the resolved entry from `conflicts` (because `state.conflicts` is the new truth).
- Effect-driven test: `send(runFetch)` against a fake `services.sync` ends in phase=idle with the fake's state.
- Scheduler integration: `scheduleStart{interval:"hourly"}` causes the fake `setInterval` (via injected scheduler factory in this test) to call `runSync` after the interval; assert event order. (Scheduler is created inside `spawnSyncActor`; for testability the spec exposes a `spawnSyncActorWith({runtime, scheduler})` overload that the production `spawnSyncActor` calls with a default scheduler.)

## Acceptance

- Sync state machine is observably correct: every transition out of `idle` returns to `idle` or `error`; `syncConflict` fires iff `state.conflicts.length > 0`.
- Scheduler lifecycle is owned by the actor; nothing else starts or stops it.
- Reducer is pure; effects are the only path to services (Constitution §1.1).

## Review

- Cross-spec interfaces verified: `ConflictDescriptor` (domain) → `SyncState.conflicts` → `SyncOutcome` → `SyncActorState.conflicts` → `SyncPanel`. `ResolveChoice` exported from sync.service consumed by actor and panel.
- PRD coverage: F6 (fetch/push/sync/resolve/auto-sync) + A6 (round-trip integration) covered.
- Constitution checks: no `process.exit`, no width/height for layout flow, no hex literals in components, every boundary returns `Result<T, ServiceError>`.
- Approved.
