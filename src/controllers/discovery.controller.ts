import { useCallback, useMemo } from "react";
import {
  DISCOVERY_ACTOR_ID,
  type DiscoveryEvent,
  type DiscoveryMessage,
  type DiscoveryState,
} from "../actors/discovery.actor";
import { useActor } from "../actors/use-actor";
import type { CandidateStatus, DiscoveryCandidate } from "../domain/candidate";
import type { ServiceError } from "../services/types";

export interface UseDiscoveryPanel {
  readonly status: DiscoveryState["status"];
  readonly queue: readonly DiscoveryCandidate[];
  readonly autoTracked: readonly string[];
  readonly error: ServiceError | null;
  readonly counts: {
    readonly pending: number;
    readonly accepted: number;
    readonly rejected: number;
    readonly deferred: number;
  };
  rescan(): void;
  accept(id: string): void;
  reject(id: string): void;
  defer(id: string): void;
  acceptMany(ids: readonly string[]): void;
  deferMany(ids: readonly string[]): void;
  rejectMany(ids: readonly string[]): void;
  restore(entries: ReadonlyArray<{ id: string; status: CandidateStatus }>): void;
  expand(path: string, depth?: number): void;
}

export function useDiscoveryPanel(): UseDiscoveryPanel {
  const { state, send } = useActor<DiscoveryState, DiscoveryMessage, DiscoveryEvent>(
    DISCOVERY_ACTOR_ID,
  );

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, rejected: 0, deferred: 0 };
    for (const x of state.queue) c[x.status]++;
    return c;
  }, [state.queue]);

  const rescan = useCallback(() => send({ kind: "rescan", payload: undefined }), [send]);
  const accept = useCallback((id: string) => send({ kind: "accept", payload: { id } }), [send]);
  const reject = useCallback((id: string) => send({ kind: "reject", payload: { id } }), [send]);
  const defer = useCallback((id: string) => send({ kind: "defer", payload: { id } }), [send]);
  const acceptMany = useCallback(
    (ids: readonly string[]) => {
      for (const id of ids) send({ kind: "accept", payload: { id } });
    },
    [send],
  );
  const deferMany = useCallback(
    (ids: readonly string[]) => {
      for (const id of ids) send({ kind: "defer", payload: { id } });
    },
    [send],
  );
  const rejectMany = useCallback(
    (ids: readonly string[]) => {
      for (const id of ids) send({ kind: "reject", payload: { id } });
    },
    [send],
  );
  const restore = useCallback(
    (entries: ReadonlyArray<{ id: string; status: CandidateStatus }>) =>
      send({ kind: "restoreStatuses", payload: { entries } }),
    [send],
  );
  const expand = useCallback(
    (path: string, depth?: number) => send({ kind: "expand", payload: { path, depth } }),
    [send],
  );

  return {
    status: state.status,
    queue: state.queue,
    autoTracked: state.autoTracked,
    error: state.error,
    counts,
    rescan,
    accept,
    reject,
    defer,
    acceptMany,
    deferMany,
    rejectMany,
    restore,
    expand,
  };
}
