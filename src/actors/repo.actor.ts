import type { Operation } from "../domain/repo";
import type { TrackedFile } from "../domain/tracked-file";
import type { Services } from "../composition/services";
import type { ServiceError } from "../services/types";
import type { ActorRuntime } from "./runtime";
import type { Effect, Event, Message, Reducer } from "./types";

export type RepoStatus = "idle" | "loading" | "ready" | "error";

export interface RepoState {
  readonly status: RepoStatus;
  readonly tracked: readonly TrackedFile[];
  readonly operations: readonly Operation[];
  readonly dirty: boolean;
  readonly error: ServiceError | null;
  readonly restoring: { kind: "op" | "backup" } | null;
}

export type RepoMessage =
  | Message<"refresh", undefined>
  | Message<
      "refreshOk",
      { tracked: readonly TrackedFile[]; operations: readonly Operation[]; dirty: boolean }
    >
  | Message<"refreshFailed", { error: ServiceError }>
  | Message<"restoreToOp", { opId: string }>
  | Message<"restoreFromBackup", { backupId: string }>
  | Message<"restoreOk", { kind: "op" | "backup" }>
  | Message<"restoreFailed", { error: ServiceError }>;

export type RepoEvent =
  | Event<"operationsLoaded", { count: number }>
  | Event<"repoDirtyChanged", { dirty: boolean }>
  | Event<"restored", { kind: "op" | "backup" }>
  | Event<"restoreFailed", { error: ServiceError }>;

export const REPO_ACTOR_ID = "repo";

export const initialRepoState: RepoState = {
  status: "idle",
  tracked: [],
  operations: [],
  dirty: false,
  error: null,
  restoring: null,
};

const refreshEffect: Effect<RepoMessage, Services> = async ({ repo }) => {
  const [tracked, ops, status] = await Promise.all([
    repo.trackedFiles(),
    repo.operations(),
    repo.syncState(),
  ]);
  if (!tracked.ok) return { kind: "refreshFailed", payload: { error: tracked.error } };
  if (!ops.ok) return { kind: "refreshFailed", payload: { error: ops.error } };
  if (!status.ok) return { kind: "refreshFailed", payload: { error: status.error } };
  return {
    kind: "refreshOk",
    payload: {
      tracked: tracked.value,
      operations: ops.value,
      dirty: status.value.dirty,
    },
  };
};

function restoreToOpEffect(opId: string): Effect<RepoMessage, Services> {
  return async ({ restore }) => {
    const r = await restore.restoreToOp(opId);
    return r.ok
      ? { kind: "restoreOk", payload: { kind: "op" } }
      : { kind: "restoreFailed", payload: { error: r.error } };
  };
}

function restoreFromBackupEffect(backupId: string): Effect<RepoMessage, Services> {
  return async ({ restore }) => {
    const r = await restore.restoreFromBackup(backupId);
    return r.ok
      ? { kind: "restoreOk", payload: { kind: "backup" } }
      : { kind: "restoreFailed", payload: { error: r.error } };
  };
}

export const repoReducer: Reducer<RepoState, RepoMessage, RepoEvent, Services> = (state, msg) => {
  switch (msg.kind) {
    case "refresh":
      return {
        state: { ...state, status: "loading", error: null },
        events: [],
        effects: [refreshEffect],
      };
    case "refreshOk": {
      const { tracked, operations, dirty } = msg.payload;
      const dirtyChanged = state.dirty !== dirty;
      const events: RepoEvent[] = [
        { kind: "operationsLoaded", payload: { count: operations.length } },
      ];
      if (dirtyChanged) events.push({ kind: "repoDirtyChanged", payload: { dirty } });
      return {
        state: { ...state, status: "ready", tracked, operations, dirty, error: null },
        events,
        effects: [],
      };
    }
    case "refreshFailed":
      return {
        state: { ...state, status: "error", error: msg.payload.error },
        events: [],
        effects: [],
      };
    case "restoreToOp": {
      if (state.restoring !== null) return { state, events: [], effects: [] };
      return {
        state: { ...state, restoring: { kind: "op" }, error: null },
        events: [],
        effects: [restoreToOpEffect(msg.payload.opId)],
      };
    }
    case "restoreFromBackup": {
      if (state.restoring !== null) return { state, events: [], effects: [] };
      return {
        state: { ...state, restoring: { kind: "backup" }, error: null },
        events: [],
        effects: [restoreFromBackupEffect(msg.payload.backupId)],
      };
    }
    case "restoreOk":
      return {
        state: { ...state, restoring: null, status: "loading" },
        events: [{ kind: "restored", payload: { kind: msg.payload.kind } }],
        effects: [refreshEffect],
      };
    case "restoreFailed":
      return {
        state: { ...state, restoring: null, error: msg.payload.error },
        events: [{ kind: "restoreFailed", payload: { error: msg.payload.error } }],
        effects: [],
      };
  }
};

export function spawnRepoActor(runtime: ActorRuntime<Services>): void {
  runtime.spawn<RepoState, RepoMessage, RepoEvent>({
    id: REPO_ACTOR_ID,
    initial: initialRepoState,
    reducer: repoReducer,
  });
}
