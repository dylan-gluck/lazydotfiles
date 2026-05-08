import type { CandidateStatus, DiscoveryCandidate } from "../domain/candidate";
import type { Services } from "../composition/services";
import type { ServiceError } from "../services/types";
import type { ActorRuntime } from "./runtime";
import { TRACK_ACTOR_ID, type TrackEvent, type TrackMessage } from "./track.actor";
import type { Effect, Event, Message, Reducer } from "./types";

export type ScanStatus = "idle" | "scanning" | "ready" | "error";

export interface DiscoveryState {
  readonly status: ScanStatus;
  readonly queue: readonly DiscoveryCandidate[];
  readonly autoTracked: readonly string[];
  readonly error: ServiceError | null;
  readonly refreshing: boolean;
  readonly scannedAt: string | null;
}

export type DiscoveryMessage =
  | Message<"prime", undefined>
  | Message<
      "primed",
      {
        queued: readonly DiscoveryCandidate[];
        autoTracked: readonly string[];
        scannedAt: string;
      }
    >
  | Message<"cacheMiss", undefined>
  | Message<"rescan", undefined>
  | Message<"scanOk", { queued: readonly DiscoveryCandidate[]; autoTracked: readonly string[] }>
  | Message<"scanFailed", { error: ServiceError }>
  | Message<"expand", { path: string; depth?: number }>
  | Message<"expandDir", { path: string; depth?: number }>
  | Message<"expandOk", { siblings: readonly DiscoveryCandidate[] }>
  | Message<"expandFailed", { error: ServiceError }>
  | Message<"accept", { id: string }>
  | Message<"reject", { id: string }>
  | Message<"defer", { id: string }>
  | Message<"commitAccept", { path: string }>
  | Message<"commitDefer", { path: string }>
  | Message<"commitAck", undefined>
  | Message<"revertAcceptByPath", { path: string }>
  | Message<"restoreStatuses", { entries: ReadonlyArray<{ id: string; status: CandidateStatus }> }>;

export type DiscoveryEvent =
  | Event<"scanProgress", { status: ScanStatus }>
  | Event<"candidateAdded", { count: number; reason: "include" | "sibling-of" | "auto" }>
  | Event<
      "candidateDecided",
      { id: string; path: string; decision: "accept" | "reject" | "defer" }
    >;

export const DISCOVERY_ACTOR_ID = "discovery";

export const initialDiscoveryState: DiscoveryState = {
  status: "idle",
  queue: [],
  autoTracked: [],
  error: null,
  refreshing: false,
  scannedAt: null,
};

const rescanEffect: Effect<DiscoveryMessage, Services> = async ({ config, discovery }) => {
  const cfg = await config.loadOrInit();
  if (!cfg.ok) return { kind: "scanFailed", payload: { error: cfg.error } };
  const r = await discovery.scan(cfg.value);
  return r.ok
    ? { kind: "scanOk", payload: { queued: r.value.queued, autoTracked: r.value.autoTracked } }
    : { kind: "scanFailed", payload: { error: r.error } };
};

const primeEffect: Effect<DiscoveryMessage, Services> = async ({ config, discovery }) => {
  const cfg = await config.loadOrInit();
  if (!cfg.ok) return { kind: "scanFailed", payload: { error: cfg.error } };
  const r = await discovery.loadCached(cfg.value);
  if (!r.ok) return { kind: "scanFailed", payload: { error: r.error } };
  if (r.value === null) return { kind: "cacheMiss", payload: undefined };
  return {
    kind: "primed",
    payload: {
      queued: r.value.queued,
      autoTracked: r.value.autoTracked,
      scannedAt: r.value.scannedAt,
    },
  };
};

function expandEffect(path: string, depth?: number): Effect<DiscoveryMessage, Services> {
  return async ({ discovery }) => {
    const r = await discovery.expandSiblings(path, depth);
    return r.ok
      ? { kind: "expandOk", payload: { siblings: r.value } }
      : { kind: "expandFailed", payload: { error: r.error } };
  };
}

function expandDirEffect(path: string, depth?: number): Effect<DiscoveryMessage, Services> {
  return async ({ config, discovery }) => {
    const cfg = await config.loadOrInit();
    if (!cfg.ok) return { kind: "expandFailed", payload: { error: cfg.error } };
    const r = await discovery.expandChildren(cfg.value, path, depth);
    return r.ok
      ? { kind: "expandOk", payload: { siblings: r.value } }
      : { kind: "expandFailed", payload: { error: r.error } };
  };
}

function commitEffect(kind: "accept" | "defer", path: string): Effect<DiscoveryMessage, Services> {
  return async ({ config, discovery }) => {
    const cfg = await config.loadOrInit();
    if (!cfg.ok) return { kind: "scanFailed", payload: { error: cfg.error } };
    const r =
      kind === "accept"
        ? await discovery.commitAccept(cfg.value, path)
        : await discovery.commitDefer(cfg.value, path);
    return r.ok
      ? { kind: "commitAck", payload: undefined }
      : { kind: "scanFailed", payload: { error: r.error } };
  };
}

function readyEvents(
  queued: readonly DiscoveryCandidate[],
  autoTracked?: readonly string[],
): DiscoveryEvent[] {
  const events: DiscoveryEvent[] = [{ kind: "scanProgress", payload: { status: "ready" } }];
  if (queued.length > 0) {
    events.push({ kind: "candidateAdded", payload: { count: queued.length, reason: "include" } });
  }
  if (autoTracked !== undefined && autoTracked.length > 0) {
    events.push({
      kind: "candidateAdded",
      payload: { count: autoTracked.length, reason: "auto" },
    });
  }
  return events;
}

function applyDecision(
  state: DiscoveryState,
  id: string,
  next: DiscoveryCandidate["status"],
): { state: DiscoveryState; candidate: DiscoveryCandidate } | null {
  let changed: DiscoveryCandidate | null = null;
  const queue = state.queue.map((c) => {
    if (c.id !== id) return c;
    const updated = { ...c, status: next };
    changed = updated;
    return updated;
  });
  if (changed === null) return null;
  return { state: { ...state, queue }, candidate: changed };
}

/**
 * Walk `state.queue`, applying `f` to each candidate. If any element returns a
 * different reference, return state with the new queue; otherwise return state
 * unchanged so subscribers don't see spurious updates.
 */
function updateQueueIfChanged(
  state: DiscoveryState,
  f: (c: DiscoveryCandidate) => DiscoveryCandidate,
): DiscoveryState {
  let changed = false;
  const queue = state.queue.map((c) => {
    const next = f(c);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...state, queue } : state;
}

export const discoveryReducer: Reducer<
  DiscoveryState,
  DiscoveryMessage,
  DiscoveryEvent,
  Services
> = (state, msg) => {
  switch (msg.kind) {
    case "prime":
      return {
        state: { ...state, refreshing: true, error: null },
        events: [],
        effects: [primeEffect],
      };
    case "primed": {
      const { queued, autoTracked, scannedAt } = msg.payload;
      return {
        state: {
          status: "ready",
          queue: queued,
          autoTracked,
          error: null,
          refreshing: true,
          scannedAt,
        },
        events: readyEvents(queued),
        effects: [rescanEffect],
      };
    }
    case "cacheMiss":
      return {
        state: { ...state, status: "scanning", refreshing: true, error: null },
        events: [{ kind: "scanProgress", payload: { status: "scanning" } }],
        effects: [rescanEffect],
      };
    case "rescan":
      return {
        state: {
          ...state,
          status: state.status === "ready" ? "ready" : "scanning",
          refreshing: true,
          error: null,
        },
        events: [
          {
            kind: "scanProgress",
            payload: { status: state.status === "ready" ? "ready" : "scanning" },
          },
        ],
        effects: [rescanEffect],
      };
    case "scanOk": {
      const { queued, autoTracked } = msg.payload;
      return {
        state: {
          status: "ready",
          queue: queued,
          autoTracked,
          error: null,
          refreshing: false,
          scannedAt: new Date().toISOString(),
        },
        events: readyEvents(queued, autoTracked),
        effects: [],
      };
    }
    case "scanFailed":
      return {
        state: {
          ...state,
          status: state.status === "ready" ? "ready" : "error",
          error: msg.payload.error,
          refreshing: false,
        },
        events: [
          {
            kind: "scanProgress",
            payload: { status: state.status === "ready" ? "ready" : "error" },
          },
        ],
        effects: [],
      };
    case "expand":
      return {
        state,
        events: [],
        effects: [expandEffect(msg.payload.path, msg.payload.depth)],
      };
    case "expandDir":
      return {
        state,
        events: [],
        effects: [expandDirEffect(msg.payload.path, msg.payload.depth)],
      };
    case "expandOk": {
      const seen = new Set(state.queue.map((c) => c.id));
      const fresh = msg.payload.siblings.filter((c) => !seen.has(c.id));
      const events: DiscoveryEvent[] =
        fresh.length === 0
          ? []
          : [{ kind: "candidateAdded", payload: { count: fresh.length, reason: "sibling-of" } }];
      return {
        state: { ...state, queue: [...state.queue, ...fresh] },
        events,
        effects: [],
      };
    }
    case "expandFailed":
      return {
        state: { ...state, error: msg.payload.error },
        events: [],
        effects: [],
      };
    case "accept":
    case "reject":
    case "defer": {
      const decision = msg.kind;
      const status: CandidateStatus =
        decision === "accept" ? "accepted" : decision === "reject" ? "rejected" : "deferred";
      const next = applyDecision(state, msg.payload.id, status);
      if (next === null) return { state, events: [], effects: [] };
      return {
        state: next.state,
        events: [
          {
            kind: "candidateDecided",
            payload: { id: msg.payload.id, path: next.candidate.path, decision },
          },
        ],
        effects: [],
      };
    }
    case "commitAccept":
      return { state, events: [], effects: [commitEffect("accept", msg.payload.path)] };
    case "commitDefer":
      return { state, events: [], effects: [commitEffect("defer", msg.payload.path)] };
    case "commitAck":
      return { state, events: [], effects: [] };
    case "revertAcceptByPath": {
      const next = updateQueueIfChanged(state, (c) =>
        c.path === msg.payload.path && c.status === "accepted" ? { ...c, status: "pending" } : c,
      );
      return { state: next, events: [], effects: [] };
    }
    case "restoreStatuses": {
      const targets = new Map(msg.payload.entries.map((e) => [e.id, e.status]));
      const next = updateQueueIfChanged(state, (c) => {
        const status = targets.get(c.id);
        return status === undefined || status === c.status ? c : { ...c, status };
      });
      return { state: next, events: [], effects: [] };
    }
  }
};

export function spawnDiscoveryActor(runtime: ActorRuntime<Services>): void {
  const actor = runtime.spawn<DiscoveryState, DiscoveryMessage, DiscoveryEvent>({
    id: DISCOVERY_ACTOR_ID,
    initial: initialDiscoveryState,
    reducer: discoveryReducer,
  });
  // Auto-prime on spawn: serve the cached snapshot immediately while a real
  // scan runs in the background. Cold starts fall through to a full scan.
  actor.send({ kind: "prime", payload: undefined });
  // Cross-actor: a candidate accepted in discovery must actually move/symlink
  // via the track service. We forward to the track actor (which queues while
  // a single op is in flight) so the user's optimistic "accepted" state is
  // backed by the real move. Revert to pending on failure.
  type DecidedEvent = Extract<DiscoveryEvent, { kind: "candidateDecided" }>;
  type AddFailedEvent = Extract<TrackEvent, { kind: "addFailed" }>;
  type TrackedEvent = Extract<TrackEvent, { kind: "tracked" }>;
  runtime.on<DecidedEvent>("candidateDecided", (event) => {
    if (event.payload.decision === "accept") {
      runtime
        .get<unknown, TrackMessage>(TRACK_ACTOR_ID)
        .send({ kind: "add", payload: { path: event.payload.path } });
      return;
    }
    if (event.payload.decision === "defer") {
      // Defer is purely a record — persist it now so future scans skip it.
      runtime
        .get<DiscoveryState, DiscoveryMessage>(DISCOVERY_ACTOR_ID)
        .send({ kind: "commitDefer", payload: { path: event.payload.path } });
    }
  });
  runtime.on<TrackedEvent>("tracked", (event) => {
    runtime
      .get<DiscoveryState, DiscoveryMessage>(DISCOVERY_ACTOR_ID)
      .send({ kind: "commitAccept", payload: { path: event.payload.file.target } });
  });
  runtime.on<AddFailedEvent>("addFailed", (event) => {
    runtime
      .get<DiscoveryState, DiscoveryMessage>(DISCOVERY_ACTOR_ID)
      .send({ kind: "revertAcceptByPath", payload: { path: event.payload.path } });
  });
}
