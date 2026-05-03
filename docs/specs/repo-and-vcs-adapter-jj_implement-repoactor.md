# Spec — `repo.actor`

- **Source bean:** `ldf-267j`
- **Parent epic:** `ldf-zf8l`
- **References:** [ADR-002 §4.3](../adrs/002_tui.md), [CONSTITUTION §1.1](../CONSTITUTION.md).

## Goal

Own the cached tracked-file list, the operation log, and the dirty flag. Emit `operationsLoaded` and `repoDirtyChanged` for views to subscribe.

## Public surface

File: `src/actors/repo.actor.ts`.

```typescript
import type { Operation } from "../domain/repo";
import type { TrackedFile } from "../domain/tracked-file";
import type { ServiceError } from "../services/types";
import type { ActorRuntime } from "./runtime";
import type { Effect, Event, Message, Reducer } from "./types";
import type { Services } from "../composition/services";

export type RepoStatus = "idle" | "loading" | "ready" | "error";

export interface RepoState {
  readonly status: RepoStatus;
  readonly tracked: readonly TrackedFile[];
  readonly operations: readonly Operation[];
  readonly dirty: boolean;
  readonly error: ServiceError | null;
}

export type RepoMessage =
  | Message<"refresh", undefined>
  | Message<
      "refreshOk",
      { tracked: readonly TrackedFile[]; operations: readonly Operation[]; dirty: boolean }
    >
  | Message<"refreshFailed", { error: ServiceError }>;

export type RepoEvent =
  | Event<"operationsLoaded", { count: number }>
  | Event<"repoDirtyChanged", { dirty: boolean }>;

export const REPO_ACTOR_ID = "repo";
export const initialRepoState: RepoState;
export const repoReducer: Reducer<RepoState, RepoMessage, RepoEvent, Services>;
export function spawnRepoActor(runtime: ActorRuntime<Services>): void;
```

## Internal design

- `refresh` sets `status: "loading"` and dispatches one `Effect` that runs `services.repo.trackedFiles()`, `services.repo.operations()`, `services.repo.syncState()` in parallel via `Promise.all`. The first error wins → `refreshFailed`. All ok → `refreshOk`.
- `refreshOk` emits:
  - `operationsLoaded` always.
  - `repoDirtyChanged` only when `state.dirty !== msg.payload.dirty` (so views that listen don't re-render on no-op transitions).
- `refreshFailed` records `error` and sets `status: "error"`. No event emission for a failed refresh — views read `state.error`.
- The reducer is total over `RepoMessage` (TS exhaustiveness).
- The actor takes `services.repo` as its only dependency. Wiring in `composition/actors.ts` adds `spawnRepoActor(runtime)` after `spawnConfigActor`.

## Dependencies

- `src/services/repo.service.ts` (added to `Services` aggregate in `composition/services.ts`).
- `src/actors/runtime.ts`, `src/actors/types.ts`.

## Tests

Pure reducer tests `src/actors/repo.actor.test.ts`:

- `refresh` → `loading`, one effect dispatched, no events.
- `refreshOk` with `dirty=true` from `dirty=false` initial → `ready`, two events: `operationsLoaded`, `repoDirtyChanged`.
- `refreshOk` with `dirty=false` from `dirty=false` → `ready`, one event (`operationsLoaded`).
- `refreshFailed` → `error`, no events.

Effect tests use a fake `RepoService` (in-memory) wired through a one-actor `createActorRuntime` instance:

- `actor.send({kind: "refresh", payload: undefined})` eventually leaves the actor in `status: "ready"` with the fake's data.
- Subscribers receive `operationsLoaded` exactly once per successful refresh.

## Acceptance

- Actor spawned at composition time; views can `useActor("repo")`.
- Reducer pure; effects observable through the runtime's bus.
- Unit + effect tests green.

## Review

Approved. No direct service calls in the reducer; all IO via `Effect`. Matches ADR-002 §4.3.2.
