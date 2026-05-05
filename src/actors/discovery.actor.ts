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
  | Message<"expandOk", { siblings: readonly DiscoveryCandidate[] }>
  | Message<"expandFailed", { error: ServiceError }>
  | Message<"accept", { id: string }>
  | Message<"reject", { id: string }>
  | Message<"defer", { id: string }>
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
      const events: DiscoveryEvent[] = [{ kind: "scanProgress", payload: { status: "ready" } }];
      if (queued.length > 0) {
        events.push({
          kind: "candidateAdded",
          payload: { count: queued.length, reason: "include" },
        });
      }
      return {
        state: {
          status: "ready",
          queue: queued,
          autoTracked,
          error: null,
          refreshing: true,
          scannedAt,
        },
        events,
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
      const events: DiscoveryEvent[] = [{ kind: "scanProgress", payload: { status: "ready" } }];
      if (queued.length > 0) {
        events.push({
          kind: "candidateAdded",
          payload: { count: queued.length, reason: "include" },
        });
      }
      if (autoTracked.length > 0) {
        events.push({
          kind: "candidateAdded",
          payload: { count: autoTracked.length, reason: "auto" },
        });
      }
      return {
        state: {
          status: "ready",
          queue: queued,
          autoTracked,
          error: null,
          refreshing: false,
          scannedAt: new Date().toISOString(),
        },
        events,
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
    case "accept": {
      const next = applyDecision(state, msg.payload.id, "accepted");
      if (next === null) return { state, events: [], effects: [] };
      return {
        state: next.state,
        events: [
          {
            kind: "candidateDecided",
            payload: { id: msg.payload.id, path: next.candidate.path, decision: "accept" },
          },
        ],
        effects: [],
      };
    }
    case "reject": {
      const next = applyDecision(state, msg.payload.id, "rejected");
      if (next === null) return { state, events: [], effects: [] };
      return {
        state: next.state,
        events: [
          {
            kind: "candidateDecided",
            payload: { id: msg.payload.id, path: next.candidate.path, decision: "reject" },
          },
        ],
        effects: [],
      };
    }
    case "defer": {
      const next = applyDecision(state, msg.payload.id, "deferred");
      if (next === null) return { state, events: [], effects: [] };
      return {
        state: next.state,
        events: [
          {
            kind: "candidateDecided",
            payload: { id: msg.payload.id, path: next.candidate.path, decision: "defer" },
          },
        ],
        effects: [],
      };
    }
    case "revertAcceptByPath": {
      let changed = false;
      const queue = state.queue.map((c) => {
        if (c.path !== msg.payload.path || c.status !== "accepted") return c;
        changed = true;
        return { ...c, status: "pending" as const };
      });
      return changed
        ? { state: { ...state, queue }, events: [], effects: [] }
        : { state, events: [], effects: [] };
    }
    case "restoreStatuses": {
      const targets = new Map(msg.payload.entries.map((e) => [e.id, e.status]));
      let changed = false;
      const queue = state.queue.map((c) => {
        const next = targets.get(c.id);
        if (next === undefined || next === c.status) return c;
        changed = true;
        return { ...c, status: next };
      });
      return changed
        ? { state: { ...state, queue }, events: [], effects: [] }
        : { state, events: [], effects: [] };
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
  runtime.on<DecidedEvent>("candidateDecided", (event) => {
    if (event.payload.decision !== "accept") return;
    runtime
      .get<unknown, TrackMessage>(TRACK_ACTOR_ID)
      .send({ kind: "add", payload: { path: event.payload.path } });
  });
  runtime.on<AddFailedEvent>("addFailed", (event) => {
    runtime
      .get<DiscoveryState, DiscoveryMessage>(DISCOVERY_ACTOR_ID)
      .send({ kind: "revertAcceptByPath", payload: { path: event.payload.path } });
  });
}
