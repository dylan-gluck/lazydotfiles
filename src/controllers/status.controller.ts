import { useEffect, useMemo } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryState } from "../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoMessage, type RepoState } from "../actors/repo.actor";
import { SYNC_ACTOR_ID, type SyncActorState, type SyncMessage } from "../actors/sync.actor";
import { useActor } from "../actors/use-actor";
import { useOptionalServices } from "../composition/services-context";
import type { Operation, SyncState } from "../domain/repo";
import type { ServiceError } from "../services/types";

export interface UseStatusPanel {
  readonly repoRoot: string;
  readonly dirty: boolean;
  readonly trackedCount: number;
  readonly queueCount: number;
  readonly sync: {
    readonly lastSyncAt: string | null;
    readonly ahead: number;
    readonly behind: number;
    readonly remote: string | null;
  };
  readonly recentOperations: readonly Operation[];
  readonly toast: { readonly message: string; readonly tone: "info" | "danger" } | null;
}

const RECENT_LIMIT = 20;

function firstError(...errs: readonly (ServiceError | null)[]): ServiceError | null {
  for (const e of errs) if (e !== null) return e;
  return null;
}

export function useStatusPanel(): UseStatusPanel {
  const services = useOptionalServices();
  const repo = useActor<RepoState, RepoMessage>(REPO_ACTOR_ID);
  const discovery = useActor<DiscoveryState>(DISCOVERY_ACTOR_ID);
  const sync = useActor<SyncActorState, SyncMessage>(SYNC_ACTOR_ID);

  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    sync.send({ kind: "refresh", payload: undefined });
    // mount-only refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repoRoot = services !== null ? `${services.home}/dotfiles` : "~/dotfiles";

  const queueCount = useMemo(
    () => discovery.state.queue.filter((c) => c.status === "pending").length,
    [discovery.state.queue],
  );

  const recentOperations = useMemo(
    () => repo.state.operations.slice(0, RECENT_LIMIT),
    [repo.state.operations],
  );

  const syncState: SyncState = sync.state.state;

  const error = firstError(repo.state.error, sync.state.error, discovery.state.error);
  const toast = error === null ? null : { message: error.tag, tone: "danger" as const };

  return {
    repoRoot,
    dirty: repo.state.dirty,
    trackedCount: repo.state.tracked.length,
    queueCount,
    sync: {
      lastSyncAt: syncState.lastSyncAt,
      ahead: syncState.ahead,
      behind: syncState.behind,
      remote: syncState.remote,
    },
    recentOperations,
    toast,
  };
}
