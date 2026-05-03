import type { Services } from "../composition/services";
import type { Config, Interval } from "../domain/config";
import type { ConflictDescriptor, SyncState } from "../domain/repo";
import { createSyncScheduler, type SyncScheduler } from "../services/sync.scheduler";
import type { ResolveChoice } from "../services/sync.service";
import type { ServiceError } from "../services/types";
import type { ConfigEvent } from "./config.actor";
import type { ActorRuntime } from "./runtime";
import type { Effect, Event, Message, Reducer } from "./types";

export type SyncPhase =
  | "idle"
  | "fetching"
  | "pushing"
  | "syncing"
  | "resolving"
  | "refreshing"
  | "error";

type ActivePhase = Exclude<SyncPhase, "idle" | "error">;

export interface SyncActorState {
  readonly phase: SyncPhase;
  readonly state: SyncState;
  readonly conflicts: readonly ConflictDescriptor[];
  readonly schedule: { running: boolean; interval: Interval | null };
  readonly error: ServiceError | null;
}

export type SyncMessage =
  | Message<"refresh", undefined>
  | Message<"runFetch", undefined>
  | Message<"runPush", undefined>
  | Message<"runSync", undefined>
  | Message<"cancel", undefined>
  | Message<"resolveConflict", { path: string; choice: ResolveChoice }>
  | Message<"scheduleStart", { interval: Interval }>
  | Message<"scheduleStop", undefined>
  | Message<"opOk", { phase: ActivePhase; state: SyncState }>
  | Message<"opFailed", { phase: ActivePhase; error: ServiceError }>;

export type SyncEvent =
  | Event<"syncStarted", { phase: ActivePhase }>
  | Event<"syncProgress", { phase: ActivePhase }>
  | Event<"syncCompleted", { state: SyncState }>
  | Event<"syncConflict", { conflicts: readonly ConflictDescriptor[] }>
  | Event<"syncFailed", { error: ServiceError }>;

export const SYNC_ACTOR_ID = "sync";

export const cleanState: SyncState = {
  lastSyncAt: null,
  ahead: 0,
  behind: 0,
  dirty: false,
  remote: null,
  conflicts: [],
};

export const initialSyncState: SyncActorState = {
  phase: "idle",
  state: cleanState,
  conflicts: [],
  schedule: { running: false, interval: null },
  error: null,
};

function refreshEffect(): Effect<SyncMessage, Services> {
  return async ({ sync }) => {
    const r = await sync.state();
    return r.ok
      ? { kind: "opOk", payload: { phase: "refreshing", state: r.value } }
      : { kind: "opFailed", payload: { phase: "refreshing", error: r.error } };
  };
}

function fetchEffect(): Effect<SyncMessage, Services> {
  return async ({ sync }) => {
    const r = await sync.fetch();
    return r.ok
      ? { kind: "opOk", payload: { phase: "fetching", state: r.value.state } }
      : { kind: "opFailed", payload: { phase: "fetching", error: r.error } };
  };
}

function pushEffect(): Effect<SyncMessage, Services> {
  return async ({ sync }) => {
    const r = await sync.push();
    return r.ok
      ? { kind: "opOk", payload: { phase: "pushing", state: r.value.state } }
      : { kind: "opFailed", payload: { phase: "pushing", error: r.error } };
  };
}

function syncEffect(): Effect<SyncMessage, Services> {
  return async ({ sync }) => {
    const r = await sync.sync();
    return r.ok
      ? { kind: "opOk", payload: { phase: "syncing", state: r.value.state } }
      : { kind: "opFailed", payload: { phase: "syncing", error: r.error } };
  };
}

function resolveEffect(path: string, choice: ResolveChoice): Effect<SyncMessage, Services> {
  return async ({ sync }) => {
    const r = await sync.resolve({ path, choice });
    return r.ok
      ? { kind: "opOk", payload: { phase: "resolving", state: r.value.state } }
      : { kind: "opFailed", payload: { phase: "resolving", error: r.error } };
  };
}

export function makeSyncReducer(
  scheduler: SyncScheduler,
  /** Called when scheduler ticks; supplied by the spawn fn so the actor can self-send. */
  onTick: () => void,
): Reducer<SyncActorState, SyncMessage, SyncEvent, Services> {
  return (state, msg) => {
    switch (msg.kind) {
      case "refresh": {
        if (state.phase !== "idle" && state.phase !== "error") {
          return { state, events: [], effects: [] };
        }
        return {
          state: { ...state, phase: "refreshing", error: null },
          events: [],
          effects: [refreshEffect()],
        };
      }
      case "runFetch":
      case "runPush":
      case "runSync": {
        if (state.phase !== "idle" && state.phase !== "error") {
          return { state, events: [], effects: [] };
        }
        const phase: ActivePhase =
          msg.kind === "runFetch" ? "fetching" : msg.kind === "runPush" ? "pushing" : "syncing";
        const effect =
          msg.kind === "runFetch"
            ? fetchEffect()
            : msg.kind === "runPush"
              ? pushEffect()
              : syncEffect();
        return {
          state: { ...state, phase, error: null },
          events: [{ kind: "syncStarted", payload: { phase } }],
          effects: [effect],
        };
      }
      case "cancel": {
        if (state.phase === "idle") return { state, events: [], effects: [] };
        return { state: { ...state, phase: "idle" }, events: [], effects: [] };
      }
      case "resolveConflict": {
        if (state.phase !== "idle" && state.phase !== "error") {
          return { state, events: [], effects: [] };
        }
        return {
          state: { ...state, phase: "resolving", error: null },
          events: [{ kind: "syncStarted", payload: { phase: "resolving" } }],
          effects: [resolveEffect(msg.payload.path, msg.payload.choice)],
        };
      }
      case "scheduleStart": {
        const interval = msg.payload.interval;
        scheduler.start(interval, onTick);
        return {
          state: { ...state, schedule: { running: true, interval } },
          events: [],
          effects: [],
        };
      }
      case "scheduleStop": {
        scheduler.stop();
        return {
          state: { ...state, schedule: { running: false, interval: null } },
          events: [],
          effects: [],
        };
      }
      case "opOk": {
        const { phase, state: nextState } = msg.payload;
        const events: SyncEvent[] = [];
        if (phase !== "refreshing") {
          events.push({ kind: "syncCompleted", payload: { state: nextState } });
        }
        if (nextState.conflicts.length > 0) {
          events.push({ kind: "syncConflict", payload: { conflicts: nextState.conflicts } });
        }
        return {
          state: {
            ...state,
            phase: "idle",
            state: nextState,
            conflicts: nextState.conflicts,
            error: null,
          },
          events,
          effects: [],
        };
      }
      case "opFailed": {
        return {
          state: { ...state, phase: "error", error: msg.payload.error },
          events: [{ kind: "syncFailed", payload: { error: msg.payload.error } }],
          effects: [],
        };
      }
    }
  };
}

export interface SpawnSyncActorOptions {
  readonly scheduler?: SyncScheduler;
}

export function spawnSyncActor(
  runtime: ActorRuntime<Services>,
  opts: SpawnSyncActorOptions = {},
): void {
  const scheduler = opts.scheduler ?? createSyncScheduler();
  // Forward declaration: the reducer references `actor.send` via `onTick`.
  // We resolve it after spawn by capturing `runtime.get(...)`.
  const onTick = () => {
    runtime.get<SyncActorState, SyncMessage, SyncEvent>(SYNC_ACTOR_ID).send({
      kind: "runSync",
      payload: undefined,
    });
  };
  runtime.spawn<SyncActorState, SyncMessage, SyncEvent>({
    id: SYNC_ACTOR_ID,
    initial: initialSyncState,
    reducer: makeSyncReducer(scheduler, onTick),
  });

  // Cross-actor: react to configChanged to mirror options.auto_sync state.
  let lastAutoSync: { enabled: boolean; interval: Interval } | null = null;
  runtime.on<ConfigEvent>("configChanged", (event) => {
    if (event.kind !== "configChanged") return;
    const cfg: Config = event.payload.config;
    const enabled = cfg.options.auto_sync;
    const interval = cfg.options.auto_sync_interval;
    if (
      lastAutoSync !== null &&
      lastAutoSync.enabled === enabled &&
      lastAutoSync.interval === interval
    ) {
      return;
    }
    lastAutoSync = { enabled, interval };
    const actor = runtime.get<SyncActorState, SyncMessage, SyncEvent>(SYNC_ACTOR_ID);
    if (enabled) {
      actor.send({ kind: "scheduleStart", payload: { interval } });
    } else {
      actor.send({ kind: "scheduleStop", payload: undefined });
    }
  });
}
