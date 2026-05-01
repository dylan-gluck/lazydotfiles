import { useCallback, useEffect } from "react";
import {
  type SyncActorState,
  type SyncEvent,
  type SyncMessage,
  type SyncPhase,
  SYNC_ACTOR_ID,
} from "../actors/sync.actor";
import { useActor } from "../actors/use-actor";
import type { ConflictDescriptor, SyncState } from "../domain/repo";
import type { Interval } from "../domain/config";
import type { ResolveChoice } from "../services/sync.service";
import type { ServiceError } from "../services/types";

export interface UseSyncPanel {
  readonly state: SyncState;
  readonly conflicts: readonly ConflictDescriptor[];
  readonly phase: SyncPhase;
  readonly schedule: { running: boolean; interval: Interval | null };
  readonly error: ServiceError | null;
  fetch(): void;
  push(): void;
  syncNow(): void;
  resolve(path: string, choice: ResolveChoice): void;
  refresh(): void;
}

export function useSyncPanel(): UseSyncPanel {
  const { state: actorState, send } = useActor<SyncActorState, SyncMessage, SyncEvent>(
    SYNC_ACTOR_ID,
  );

  useEffect(() => {
    send({ kind: "refresh", payload: undefined });
    // mount-only refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetch = useCallback(() => send({ kind: "runFetch", payload: undefined }), [send]);
  const push = useCallback(() => send({ kind: "runPush", payload: undefined }), [send]);
  const syncNow = useCallback(() => send({ kind: "runSync", payload: undefined }), [send]);
  const resolve = useCallback(
    (path: string, choice: ResolveChoice) =>
      send({ kind: "resolveConflict", payload: { path, choice } }),
    [send],
  );
  const refresh = useCallback(() => send({ kind: "refresh", payload: undefined }), [send]);

  return {
    state: actorState.state,
    conflicts: actorState.conflicts,
    phase: actorState.phase,
    schedule: actorState.schedule,
    error: actorState.error,
    fetch,
    push,
    syncNow,
    resolve,
    refresh,
  };
}
