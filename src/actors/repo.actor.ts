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
}

export type RepoMessage =
  | Message<"refresh", undefined>
  | Message<
      "refreshOk",
      { tracked: readonly TrackedFile[]; operations: readonly Operation[]; dirty: boolean }
    >
  | Message<"refreshFailed", { error: ServiceError }>;

export type RepoEvent =
  | Event<"operationsLoaded", { count: number }>
  | Event<"repoDirtyChanged", { dirty: boolean }>;

export const REPO_ACTOR_ID = "repo";

export const initialRepoState: RepoState = {
  status: "idle",
  tracked: [],
  operations: [],
  dirty: false,
  error: null,
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
        state: { status: "ready", tracked, operations, dirty, error: null },
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
  }
};

export function spawnRepoActor(runtime: ActorRuntime<Services>): void {
  runtime.spawn<RepoState, RepoMessage, RepoEvent>({
    id: REPO_ACTOR_ID,
    initial: initialRepoState,
    reducer: repoReducer,
  });
}
