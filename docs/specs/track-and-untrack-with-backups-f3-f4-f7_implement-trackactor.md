# Spec — `track.actor`

- **Source bean:** `ldf-pmt3`
- **Parent epic:** `ldf-vcv0`
- **References:** [ADR-002 §4.3](../adrs/002_tui.md), [PRD §7.3 (Add operation sequence)](../prds/001_mvp.md), [TrackService specs](./track-and-untrack-with-backups-f3-f4-f7_implement-trackserviceadd-with-rollback.md).

## Goal

Mediate `add`/`remove` intents from controllers, dispatch the corresponding effect against `TrackService`, and emit `tracked` / `untracked` / `addFailed` / `removeFailed` events. State carries the in-flight operation so views can render progress.

## Public surface

File: `src/actors/track.actor.ts`.

```ts
import type { TrackedFile } from "../domain/tracked-file";
import type { ServiceError } from "../services/types";
import type { ActorRuntime } from "./runtime";
import type { Effect, Event, Message, Reducer } from "./types";
import type { Services } from "../composition/services";

export type TrackOpKind = "add" | "remove";

export interface InFlightOp {
  readonly kind: TrackOpKind;
  readonly path: string;
}

export interface TrackState {
  readonly inFlight: InFlightOp | null;
  readonly lastError: ServiceError | null;
}

export type TrackMessage =
  | Message<"add", { path: string }>
  | Message<"remove", { path: string }>
  | Message<"addOk", { file: TrackedFile }>
  | Message<"addFailed", { path: string; error: ServiceError }>
  | Message<"removeOk", { file: TrackedFile }>
  | Message<"removeFailed", { path: string; error: ServiceError }>;

export type TrackEvent =
  | Event<"tracked", { file: TrackedFile }>
  | Event<"untracked", { file: TrackedFile }>
  | Event<"addFailed", { path: string; error: ServiceError }>
  | Event<"removeFailed", { path: string; error: ServiceError }>;

export const TRACK_ACTOR_ID = "track";
export const initialTrackState: TrackState;
export const trackReducer: Reducer<TrackState, TrackMessage, TrackEvent, Services>;
export function spawnTrackActor(runtime: ActorRuntime<Services>): void;
```

## Internal design

- **`add` / `remove`**:
  - If `state.inFlight !== null`, drop the message (return `{state, events:[], effects:[]}`); the controller surfaces this by reading `state.inFlight` before dispatching.
  - Else set `inFlight = { kind, path }`, emit no events, dispatch one effect.
- **Effects**:
  - `addEffect(path)`: `services.track.add(path)` → `addOk` or `addFailed`.
  - `removeEffect(path)`: `services.track.remove(path)` → `removeOk` or `removeFailed`.
- **`addOk` / `removeOk`**: clear `inFlight`, clear `lastError`, emit `tracked` / `untracked` with the file. Cross-actor wiring (see below) re-refreshes the repo actor.
- **`addFailed` / `removeFailed`**: clear `inFlight`, store `lastError`, emit corresponding event.
- **Cross-actor refresh**: `spawnTrackActor` registers a `runtime.on("tracked"|"untracked", () => repoActor.send({kind:"refresh", payload:undefined}))` so `RepoActor.tracked`/`operations` stay current after a successful op. This lives in the actor factory, not in views (ADR-002 §4.3.4).

The reducer is pure: it computes only `{state, events, effects}` from `(state, msg)`. No clock reads inside the reducer.

## Dependencies

- `src/services/track.service.ts` (added to `Services` aggregate in `composition/services.ts`).
- `src/actors/repo.actor.ts` (refresh trigger).

## Tests

`src/actors/track.actor.test.ts` (pure reducer + effect via fake services):

- `add` from idle → `inFlight={kind:"add", path}`, no events, one effect.
- `add` while `inFlight !== null` is a no-op (state-equal output, no effect dispatched).
- `addOk` clears `inFlight`, emits `tracked` with the file payload.
- `addFailed` clears `inFlight`, sets `lastError`, emits `addFailed` event.
- `remove` analogous (tests mirror the `add` cases for the remove pathway).
- Effect test: with a fake `TrackService` that returns `ok(file)`, `actor.send({kind:"add", payload:{path:"/h/.zshrc"}})` ends with the actor in idle, `tracked` event observed on the bus.
- Cross-actor: a `tracked` event causes the repo actor to receive `refresh` (asserted by spying on the repo actor's inbox via a fake reducer in the same runtime).

## Acceptance

- Views can `useActor("track")` to dispatch and read `inFlight`.
- `tracked`/`untracked` events propagate to the repo actor and refresh `state.tracked`/`state.operations`.
- All tests green.

## Review

Approved. `InFlightOp` carries only `{kind, path}` — storing `startedAt` would have required a clock read inside the reducer, breaking purity. View progress UI displays "tracking…" / "untracking…" purely based on `inFlight.kind`; if a duration display is needed later, the start timestamp is recorded in the dispatched effect and threaded back via a `tick`-style message (out of MVP).
