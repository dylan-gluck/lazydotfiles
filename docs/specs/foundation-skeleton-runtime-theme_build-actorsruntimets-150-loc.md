# Spec: Actor runtime in `actors/runtime.ts`

- Source bean: `ldf-qb56`
- Parent epic: `ldf-j9pe`
- References: ADR-002 §4.3, CONSTITUTION §1.1, §2.4

## Goal

Provide a tiny in-process actor runtime: an `Actor<S, M, E>` with an inbox, a pure reducer dispatch, an effect runner, a subscriber list, an event bus, and a `dispose()`.

## Public surface

```ts
// src/actors/types.ts
export type Message<K extends string = string, P = unknown> = {
  readonly kind: K;
  readonly payload: P;
};
export type Event<K extends string = string, P = unknown> = {
  readonly kind: K;
  readonly payload: P;
};

export type Effect<M extends Message, Services> = (services: Services) => Promise<M | null>;

export type Reducer<S, M extends Message, E extends Event, Services> = (
  state: S,
  msg: M,
) => { state: S; events: E[]; effects: Effect<M, Services>[] };

export interface Actor<S, M extends Message, E extends Event> {
  readonly id: string;
  send(msg: M): void;
  subscribe(listener: (state: S, event: E | null) => void): () => void;
  getState(): S;
}
```

```ts
// src/actors/runtime.ts
import type { Actor, Event, Message, Reducer } from "./types";

export interface ActorRuntime<Services> {
  spawn<S, M extends Message, E extends Event>(spec: {
    id: string;
    initial: S;
    reducer: Reducer<S, M, E, Services>;
  }): Actor<S, M, E>;
  get<S, M extends Message = Message, E extends Event = Event>(id: string): Actor<S, M, E>;
  on<E extends Event>(kind: E["kind"], listener: (event: E) => void): () => void;
  dispose(): void;
}

export function createActorRuntime<Services>(deps: { services: Services }): ActorRuntime<Services>;
```

## Internal design

- Each spawned actor stores: `state`, `inbox: M[]`, `running: boolean`, `subscribers: Set<listener>`.
- `send(msg)` appends to inbox and triggers `drain()`. `drain()` is reentrant-safe via a `running` flag — if called while already draining, it returns; the loop picks up the new message.
- Drain loop: pop msg → run reducer → set state → broadcast each event to actor subscribers and to the runtime-wide event bus → schedule effects via `queueMicrotask(() => effect(services).then(reply => reply && actor.send(reply)))`.
- `subscribe` returns an unsubscribe function and is also fired once with `(state, null)` after registration so consumers see initial state.
- `on(kind, listener)` is the cross-actor bus. Listeners registered for that kind are invoked when any actor emits an event whose `kind` matches.
- `dispose()` clears all subscribers, all bus listeners, and prevents further `drain` from running. Pending effects cannot be canceled — the runtime accepts that any reply they produce after dispose is dropped.
- Total LOC ≤ 150 including types in `runtime.ts` (separate `types.ts` is permitted; LOC budget is for `runtime.ts`).

## Dependencies

- `lib/result.ts` not required.
- `actors/types.ts` (sibling).
- `Services` is generic at this phase; later phases bind it via the composition root.

## Tests

- `tests/actors/runtime.test.ts` (counter actor):
  - `spawn` then `getState` returns initial.
  - `send({ kind: "inc", payload: undefined })` increments state and notifies subscribers exactly once.
  - Two subscribers both receive the new state.
  - `unsubscribe()` stops further notifications.
  - Reducer-returned effect that resolves to a follow-up message is dispatched and applied (reducer increments by 10 on `bumped`).
  - Effect that returns `null` causes no follow-up dispatch.
  - `runtime.on("counted", listener)` fires when reducer emits a `counted` event.
  - `runtime.dispose()` is idempotent and stops further subscriber notifications.

## Acceptance

- File exists; tests pass.
- Reducer is invoked synchronously from `send`; effect fires asynchronously.
- No `process.exit`, no top-level state.
