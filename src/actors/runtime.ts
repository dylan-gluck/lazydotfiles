import type { Actor, Effect, Event, Message, Reducer } from "./types";

export interface EffectFailure {
  readonly actorId: string;
  readonly cause: unknown;
}

export interface ActorRuntime<Services> {
  spawn<S, M extends Message, E extends Event>(spec: {
    id: string;
    initial: S;
    reducer: Reducer<S, M, E, Services>;
  }): Actor<S, M, E>;
  get<S, M extends Message = Message, E extends Event = Event>(id: string): Actor<S, M, E>;
  on<E extends Event>(kind: E["kind"], listener: (event: E) => void): () => void;
  /**
   * Subscribe to effect failures. Effects MUST surface failures via reply
   * messages; a thrown error is a contract violation, surfaced here so a
   * logger/diagnostics actor can react.
   */
  onEffectFailure(listener: (failure: EffectFailure) => void): () => void;
  dispose(): void;
}

type AnyActor = Actor<unknown, Message, Event>;
type Listener<S, E extends Event> = (state: S, event: E | null) => void;

export function createActorRuntime<Services>(deps: { services: Services }): ActorRuntime<Services> {
  const actors = new Map<string, AnyActor>();
  const bus = new Map<string, Set<(event: Event) => void>>();
  const failureListeners = new Set<(failure: EffectFailure) => void>();
  let disposed = false;

  function emit(event: Event): void {
    if (disposed) return;
    const set = bus.get(event.kind);
    if (set === undefined) return;
    for (const fn of set) fn(event);
  }

  function spawn<S, M extends Message, E extends Event>(spec: {
    id: string;
    initial: S;
    reducer: Reducer<S, M, E, Services>;
  }): Actor<S, M, E> {
    if (actors.has(spec.id)) {
      throw new Error(`actor "${spec.id}" already spawned`);
    }
    let state: S = spec.initial;
    const inbox: M[] = [];
    const subscribers = new Set<Listener<S, E>>();
    let running = false;

    function broadcast(event: E | null): void {
      for (const fn of subscribers) fn(state, event);
    }

    function drain(): void {
      if (running || disposed) return;
      running = true;
      try {
        while (inbox.length > 0) {
          const msg = inbox.shift() as M;
          const out = spec.reducer(state, msg);
          state = out.state;
          if (out.events.length === 0) {
            broadcast(null);
          } else {
            for (const e of out.events) {
              broadcast(e);
              emit(e);
            }
          }
          for (const eff of out.effects) {
            queueMicrotask(() => {
              void runEffect(eff);
            });
          }
        }
      } finally {
        running = false;
      }
    }

    async function runEffect(eff: Effect<M, Services>): Promise<void> {
      try {
        const reply = await eff(deps.services);
        if (reply !== null && !disposed) actor.send(reply);
      } catch (cause) {
        // Effects MUST surface failures via reply messages, not throws.
        // The runtime stays alive, but the failure is broadcast so a logger
        // (or test harness) can observe it instead of disappearing silently.
        if (disposed) return;
        for (const fn of failureListeners) {
          try {
            fn({ actorId: spec.id, cause });
          } catch {
            // a failing failure listener cannot itself crash the runtime
          }
        }
      }
    }

    const actor: Actor<S, M, E> = {
      id: spec.id,
      send(msg) {
        if (disposed) return;
        inbox.push(msg);
        drain();
      },
      subscribe(listener) {
        subscribers.add(listener);
        listener(state, null);
        return () => {
          subscribers.delete(listener);
        };
      },
      getState() {
        return state;
      },
    };
    actors.set(spec.id, actor as AnyActor);
    return actor;
  }

  function get<S, M extends Message = Message, E extends Event = Event>(
    id: string,
  ): Actor<S, M, E> {
    const a = actors.get(id);
    if (a === undefined) throw new Error(`actor "${id}" not found`);
    return a as Actor<S, M, E>;
  }

  function on<E extends Event>(kind: E["kind"], listener: (event: E) => void): () => void {
    let set = bus.get(kind);
    if (set === undefined) {
      set = new Set();
      bus.set(kind, set);
    }
    const fn = listener as (event: Event) => void;
    set.add(fn);
    return () => {
      set?.delete(fn);
    };
  }

  function onEffectFailure(listener: (failure: EffectFailure) => void): () => void {
    failureListeners.add(listener);
    return () => {
      failureListeners.delete(listener);
    };
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    bus.clear();
    failureListeners.clear();
    actors.clear();
  }

  return { spawn, get, on, onEffectFailure, dispose };
}
