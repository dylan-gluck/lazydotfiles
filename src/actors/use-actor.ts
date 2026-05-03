import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useRef,
  useSyncExternalStore,
} from "react";
import { DomainError } from "../domain/errors";
import type { ActorRuntime } from "./runtime";
import type { Event, Message } from "./types";

export const ActorRuntimeContext = createContext<ActorRuntime<unknown> | null>(null);

export function ActorRuntimeProvider(props: {
  runtime: ActorRuntime<unknown>;
  children: ReactNode;
}): ReactNode {
  return createElement(ActorRuntimeContext.Provider, { value: props.runtime }, props.children);
}

export function useActorRuntime(): ActorRuntime<unknown> {
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

/**
 * Subscribe to a slice of an actor's state. The component only re-renders when
 * the selected value changes by `Object.is` (or by `equals` if provided),
 * regardless of how many other fields churn. Use this when an actor has wide
 * state but a panel only cares about a slice (e.g. a counter, a flag).
 */
export function useActorSelector<S, T, M extends Message = Message, E extends Event = Event>(
  id: string,
  selector: (state: S) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): { selected: T; send: (msg: M) => void } {
  const runtime = useActorRuntime();
  const actor = runtime.get<S, M, E>(id);
  // Cache the last selected value so identical slices return a stable
  // reference; this is what useSyncExternalStore relies on to skip renders.
  const lastRef = useRef<{ value: T; init: boolean }>({ value: undefined as T, init: false });
  const selected = useSyncExternalStore(
    (onChange) => actor.subscribe(() => onChange()),
    () => {
      const next = selector(actor.getState());
      if (lastRef.current.init && equals(lastRef.current.value, next)) {
        return lastRef.current.value;
      }
      lastRef.current = { value: next, init: true };
      return next;
    },
    () => selector(actor.getState()),
  );
  return { selected, send: actor.send };
}
