import { useCallback, useEffect, useMemo, useState } from "react";
import { REPO_ACTOR_ID, type RepoState } from "../actors/repo.actor";
import {
  TRACK_ACTOR_ID,
  type TrackEvent,
  type TrackMessage,
  type TrackState,
} from "../actors/track.actor";
import { useActor } from "../actors/use-actor";
import { useOptionalServices } from "../composition/services-context";
import type { BackupRecord } from "../domain/backup";
import type { TrackedFile } from "../domain/tracked-file";
import type { ServiceError } from "../services/types";

export interface UseTrackedPanel {
  readonly tracked: readonly TrackedFile[];
  readonly inFlight: { kind: "add" | "remove"; path: string } | null;
  readonly error: ServiceError | null;
  readonly backups: ReadonlyMap<string, readonly BackupRecord[]>;
  readonly loadingBackups: boolean;
  refreshBackups(): void;
  add(path: string): void;
  remove(path: string): void;
  clearError(): void;
}

export function useTrackedPanel(): UseTrackedPanel {
  const services = useOptionalServices();
  const repo = useActor<RepoState>(REPO_ACTOR_ID);
  const track = useActor<TrackState, TrackMessage, TrackEvent>(TRACK_ACTOR_ID);
  const [backups, setBackups] = useState<ReadonlyMap<string, readonly BackupRecord[]>>(new Map());
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [localError, setLocalError] = useState<ServiceError | null>(null);

  const trackedList = repo.state.tracked;

  const refreshBackups = useCallback(async () => {
    if (services === null) return;
    setLoadingBackups(true);
    const next = new Map<string, readonly BackupRecord[]>();
    for (const tf of trackedList) {
      const r = await services.backups.list(tf.id);
      if (!r.ok) {
        setLocalError(r.error);
        setLoadingBackups(false);
        return;
      }
      next.set(tf.id, r.value);
    }
    setBackups(next);
    setLoadingBackups(false);
  }, [services, trackedList]);

  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  const add = useCallback(
    (path: string) => track.send({ kind: "add", payload: { path } }),
    [track],
  );
  const remove = useCallback(
    (path: string) => track.send({ kind: "remove", payload: { path } }),
    [track],
  );
  const clearError = useCallback(() => setLocalError(null), []);

  const error: ServiceError | null = useMemo(
    () => track.state.lastError ?? localError,
    [track.state.lastError, localError],
  );

  return {
    tracked: trackedList,
    inFlight: track.state.inFlight,
    error,
    backups,
    loadingBackups,
    refreshBackups: () => void refreshBackups(),
    add,
    remove,
    clearError,
  };
}
