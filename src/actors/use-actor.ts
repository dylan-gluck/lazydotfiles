import { createContext, useContext, useSyncExternalStore } from "react";
import { DomainError } from "../domain/errors";
import type { ActorRuntime } from "./runtime";
import type { Event, Message } from "./types";

export const ActorRuntimeContext = createContext<ActorRuntime<unknown> | null>(null);

function useActorRuntime(): ActorRuntime<unknown> {
  const rt = useContext(ActorRuntimeContext);
  if (rt === null) {
    throw new DomainError("INVARIANT_VIOLATION", {
      reason: "ActorRuntimeContext not provided",
    });
  }
  return rt;
}

export function useActor<S, M extends Message = Message, E extends Event = Event>(
  id: string,
): { state: S; send: (msg: M) => void } {
  const runtime = useActorRuntime();
  const actor = runtime.get<S, M, E>(id);
  const state = useSyncExternalStore(
    (onChange) => actor.subscribe(() => onChange()),
    () => actor.getState(),
    () => actor.getState(),
  );
  return { state, send: actor.send };
}

const NOOP_UNSUBSCRIBE = (): void => {};

/**
 * Read an actor's state without throwing when the runtime context is absent.
 * Lets shared chrome (header, footer) render safely in component tests that
 * don't wire the actor runtime.
 */
export function useActorStateSafe<S>(id: string): S | null {
  const rt = useContext(ActorRuntimeContext);
  return useSyncExternalStore(
    (cb) => (rt === null ? NOOP_UNSUBSCRIBE : rt.get<S>(id).subscribe(() => cb())),
    () => (rt === null ? null : rt.get<S>(id).getState()),
    () => null,
  );
}
