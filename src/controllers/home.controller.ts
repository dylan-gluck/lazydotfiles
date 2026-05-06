import { useEffect, useMemo } from "react";
import { CONFIG_ACTOR_ID, type ConfigState } from "../actors/config.actor";
import { DISCOVERY_ACTOR_ID, type DiscoveryState } from "../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoMessage, type RepoState } from "../actors/repo.actor";
import { SYNC_ACTOR_ID, type SyncActorState, type SyncMessage } from "../actors/sync.actor";
import { useActor } from "../actors/use-actor";
import { useOptionalServices } from "../composition/services-context";
import type { Interval } from "../domain/config";
import type { Operation } from "../domain/repo";
import type { TrackedFile } from "../domain/tracked-file";
import { groupQueueBySegment, type QueueSegmentGroup } from "../lib/path";
import { INTERVAL_MS } from "../services/sync.scheduler";
import type { ServiceError } from "../services/types";

export type HomeQueueGroup = QueueSegmentGroup;

export interface UseHomePanel {
  readonly repoRoot: string;
  readonly home: string;
  readonly branchSummary: string;
  readonly dirty: boolean;
  readonly tracked: readonly TrackedFile[];
  readonly trackedCount: number;
  readonly queueCount: number;
  readonly queueGroups: readonly HomeQueueGroup[];
  readonly queueGroupCount: number;
  readonly sync: {
    readonly lastSyncAt: string | null;
    readonly nextAutoSyncIso: string | null;
    readonly ahead: number;
    readonly behind: number;
    readonly remote: string | null;
    readonly autoInterval: Interval | null;
  };
  readonly recentOperations: readonly Operation[];
  readonly totalOperations: number;
  readonly toast: { readonly message: string; readonly tone: "info" | "danger" } | null;
}

const TRACKED_PREVIEW_LIMIT = 6;
const RECENT_LIMIT = 5;
const QUEUE_GROUP_LIMIT = 6;

function firstError(...errs: readonly (ServiceError | null)[]): ServiceError | null {
  for (const e of errs) if (e !== null) return e;
  return null;
}

function deriveRepoRoot(servicesHome: string | null, configHome: string | null): string {
  if (servicesHome !== null) return `${servicesHome}/dotfiles`;
  if (configHome !== null) return `${configHome}/dotfiles`;
  return "~/dotfiles";
}

function nextAutoSyncIso(
  running: boolean,
  interval: Interval | null,
  lastSyncAt: string | null,
): string | null {
  if (!running || interval === null || lastSyncAt === null) return null;
  const t = Date.parse(lastSyncAt);
  if (Number.isNaN(t)) return null;
  return new Date(t + INTERVAL_MS[interval]).toISOString();
}

export function useHomePanel(): UseHomePanel {
  const services = useOptionalServices();
  const repo = useActor<RepoState, RepoMessage>(REPO_ACTOR_ID);
  const discovery = useActor<DiscoveryState>(DISCOVERY_ACTOR_ID);
  const sync = useActor<SyncActorState, SyncMessage>(SYNC_ACTOR_ID);
  const config = useActor<ConfigState>(CONFIG_ACTOR_ID);

  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    sync.send({ kind: "refresh", payload: undefined });
    // mount-only refresh
  }, []);

  const home = config.state.config?.path.home ?? services?.home ?? "";
  const repoRoot = deriveRepoRoot(services?.home ?? null, config.state.config?.path.home ?? null);

  const queueCount = useMemo(
    () => discovery.state.queue.filter((c) => c.status === "pending").length,
    [discovery.state.queue],
  );

  const queueGroups = useMemo(
    () => groupQueueBySegment(discovery.state.queue, home),
    [discovery.state.queue, home],
  );

  const recentOperations = useMemo(
    () => repo.state.operations.slice(0, RECENT_LIMIT),
    [repo.state.operations],
  );

  const tracked = useMemo(
    () => repo.state.tracked.slice(0, TRACKED_PREVIEW_LIMIT),
    [repo.state.tracked],
  );

  const head = repo.state.operations[0];
  const branchSummary = head !== undefined ? `main @ ${head.id.slice(0, 8)}` : "main";

  const syncState = sync.state.state;
  const autoInterval = sync.state.schedule.running ? sync.state.schedule.interval : null;
  const nextAuto = nextAutoSyncIso(
    sync.state.schedule.running,
    sync.state.schedule.interval,
    syncState.lastSyncAt,
  );

  const error = firstError(repo.state.error, sync.state.error, discovery.state.error);
  const toast = error === null ? null : { message: error.tag, tone: "danger" as const };

  return {
    repoRoot,
    home,
    branchSummary,
    dirty: repo.state.dirty,
    tracked,
    trackedCount: repo.state.tracked.length,
    queueCount,
    queueGroups: queueGroups.slice(0, QUEUE_GROUP_LIMIT),
    queueGroupCount: queueGroups.length,
    sync: {
      lastSyncAt: syncState.lastSyncAt,
      nextAutoSyncIso: nextAuto,
      ahead: syncState.ahead,
      behind: syncState.behind,
      remote: syncState.remote,
      autoInterval,
    },
    recentOperations,
    totalOperations: repo.state.operations.length,
    toast,
  };
}
