# Spec: `useActor` hook + `ActorRuntimeContext`

- Source bean: `ldf-xgbc`
- Parent epic: `ldf-j9pe`
- References: ADR-002 §4.3.3

## Goal

Expose the actor runtime to React via context, plus a `useActor` hook that subscribes for the component's lifetime.

## Public surface

```ts
// src/actors/use-actor.ts
import {
  type Context,
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ActorRuntime } from "./runtime";
import type { Actor, Event, Message } from "./types";

export const ActorRuntimeContext: Context<ActorRuntime<unknown> | null>;

export function ActorRuntimeProvider(props: {
  runtime: ActorRuntime<unknown>;
  children: React.ReactNode;
}): JSX.Element;

export function useActorRuntime(): ActorRuntime<unknown>;

export function useActor<S, M extends Message = Message, E extends Event = Event>(
  id: string,
): { state: S; send: (msg: M) => void };
```

## Internal design

- `ActorRuntimeContext` defaults to `null`; `useActorRuntime` throws `DomainError("INVARIANT_VIOLATION", { reason: "ActorRuntimeContext not provided" })` when null.
- `useActor` calls `runtime.get<S, M, E>(id)` once per render (cheap), uses `useSyncExternalStore` with `actor.subscribe` and `actor.getState` to return state without re-subscribing on every render.
- `send` is returned as `actor.send` directly (already stable across renders since the actor identity is stable).

## Dependencies

- `actors/runtime.ts`, `actors/types.ts`.
- `react` (already present).

## Tests

- `tests/actors/use-actor.test.tsx` (uses `@opentui/react/test-utils` if needed; otherwise pure renderer):
  - Rendering a component that consumes `useActor("counter")` reads initial state.
  - Calling `send` from the component updates rendered state.
  - Unmounting the component unsubscribes (verified by counting subscribers on the runtime-internal getter or by re-mounting and ensuring no stale callback fires — implementation note: expose `__subscriberCount(id)` from runtime for tests, or simply assert no throw).
  - `useActorRuntime` outside of provider throws.

## Acceptance

- File exists; tests pass.
- Hook does not leak subscriptions on unmount.
