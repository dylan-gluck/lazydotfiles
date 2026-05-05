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
