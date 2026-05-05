import type { Services } from "../composition/services";
import type { TrackedFile } from "../domain/tracked-file";
import type { ServiceError } from "../services/types";
import { REPO_ACTOR_ID, type RepoMessage } from "./repo.actor";
import type { ActorRuntime } from "./runtime";
import type { Effect, Event, Message, Reducer } from "./types";

export type TrackOpKind = "add" | "remove";

export interface InFlightOp {
  readonly kind: TrackOpKind;
  readonly path: string;
}

export interface TrackState {
  readonly inFlight: InFlightOp | null;
  /** FIFO of operations queued while a single op is in flight. */
  readonly pending: readonly InFlightOp[];
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

export const initialTrackState: TrackState = {
  inFlight: null,
  pending: [],
  lastError: null,
};

function addEffect(path: string): Effect<TrackMessage, Services> {
  return async ({ track }) => {
    const r = await track.add(path);
    return r.ok
      ? { kind: "addOk", payload: { file: r.value } }
      : { kind: "addFailed", payload: { path, error: r.error } };
  };
}

function removeEffect(path: string): Effect<TrackMessage, Services> {
  return async ({ track }) => {
    const r = await track.remove(path);
    return r.ok
      ? { kind: "removeOk", payload: { file: r.value } }
      : { kind: "removeFailed", payload: { path, error: r.error } };
  };
}

function effectFor(op: InFlightOp): Effect<TrackMessage, Services> {
  return op.kind === "add" ? addEffect(op.path) : removeEffect(op.path);
}

interface NextStep {
  readonly inFlight: InFlightOp | null;
  readonly pending: readonly InFlightOp[];
  readonly effects: Effect<TrackMessage, Services>[];
}

/** Drain one entry from `pending` (if any) into `inFlight` and dispatch its effect. */
function advance(pending: readonly InFlightOp[]): NextStep {
  if (pending.length === 0) {
    return { inFlight: null, pending, effects: [] };
  }
  const [head, ...rest] = pending;
  return { inFlight: head!, pending: rest, effects: [effectFor(head!)] };
}

export const trackReducer: Reducer<TrackState, TrackMessage, TrackEvent, Services> = (
  state,
  msg,
) => {
  switch (msg.kind) {
    case "add": {
      const op: InFlightOp = { kind: "add", path: msg.payload.path };
      if (state.inFlight !== null) {
        return {
          state: { ...state, pending: [...state.pending, op] },
          events: [],
          effects: [],
        };
      }
      return {
        state: { inFlight: op, pending: state.pending, lastError: null },
        events: [],
        effects: [addEffect(op.path)],
      };
    }
    case "remove": {
      const op: InFlightOp = { kind: "remove", path: msg.payload.path };
      if (state.inFlight !== null) {
        return {
          state: { ...state, pending: [...state.pending, op] },
          events: [],
          effects: [],
        };
      }
      return {
        state: { inFlight: op, pending: state.pending, lastError: null },
        events: [],
        effects: [removeEffect(op.path)],
      };
    }
    case "addOk": {
      const next = advance(state.pending);
      return {
        state: { inFlight: next.inFlight, pending: next.pending, lastError: null },
        events: [{ kind: "tracked", payload: { file: msg.payload.file } }],
        effects: next.effects,
      };
    }
    case "addFailed": {
      const next = advance(state.pending);
      return {
        state: { inFlight: next.inFlight, pending: next.pending, lastError: msg.payload.error },
        events: [
          {
            kind: "addFailed",
            payload: { path: msg.payload.path, error: msg.payload.error },
          },
        ],
        effects: next.effects,
      };
    }
    case "removeOk": {
      const next = advance(state.pending);
      return {
        state: { inFlight: next.inFlight, pending: next.pending, lastError: null },
        events: [{ kind: "untracked", payload: { file: msg.payload.file } }],
        effects: next.effects,
      };
    }
    case "removeFailed": {
      const next = advance(state.pending);
      return {
        state: { inFlight: next.inFlight, pending: next.pending, lastError: msg.payload.error },
        events: [
          {
            kind: "removeFailed",
            payload: { path: msg.payload.path, error: msg.payload.error },
          },
        ],
        effects: next.effects,
      };
    }
  }
};

export function spawnTrackActor(runtime: ActorRuntime<Services>): void {
  runtime.spawn<TrackState, TrackMessage, TrackEvent>({
    id: TRACK_ACTOR_ID,
    initial: initialTrackState,
    reducer: trackReducer,
  });
  // Cross-actor: refresh repo on every tracked / untracked.
  const refresh = () =>
    runtime.get<unknown, RepoMessage>(REPO_ACTOR_ID).send({ kind: "refresh", payload: undefined });
  runtime.on<TrackEvent>("tracked", refresh);
  runtime.on<TrackEvent>("untracked", refresh);
}
