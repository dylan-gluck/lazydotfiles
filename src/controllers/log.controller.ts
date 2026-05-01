import { useCallback, useEffect, useState } from "react";
import { REPO_ACTOR_ID, type RepoMessage, type RepoState } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useOptionalServices } from "../composition/services-context";
import type { OperationView } from "../domain/repo";
import type { ServiceError } from "../services/types";

export type LogStatus = "idle" | "loading" | "ready" | "error";

export interface UseLogPanel {
  readonly operations: readonly OperationView[];
  readonly status: LogStatus;
  readonly error: ServiceError | null;
  readonly focusId: string | null;
  readonly diff: { opId: string; text: string } | null;
  readonly diffLoading: boolean;
  readonly restoring: { kind: "op" | "backup" } | null;
  focus(opId: string): void;
  loadDiff(opId: string): void;
  restoreToOp(opId: string): void;
  restoreFromLatestBackup(opId: string): void;
  refresh(): void;
}

export function useLogPanel(): UseLogPanel {
  const services = useOptionalServices();
  const repo = useActor<RepoState, RepoMessage>(REPO_ACTOR_ID);
  const [operations, setOperations] = useState<readonly OperationView[]>([]);
  const [status, setStatus] = useState<LogStatus>("idle");
  const [error, setError] = useState<ServiceError | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ opId: string; text: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (services === null) return;
    setStatus("loading");
    const r = await services.operation.list({ limit: 50 });
    if (!r.ok) {
      setError(r.error);
      setStatus("error");
      return;
    }
    setOperations(r.value);
    setStatus("ready");
    if (r.value.length > 0 && focusId === null) setFocusId(r.value[0]?.opId ?? null);
  }, [services, focusId]);

  useEffect(() => {
    void refresh();
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focus = useCallback((opId: string) => setFocusId(opId), []);

  const loadDiff = useCallback(
    async (opId: string) => {
      if (services === null) return;
      setDiffLoading(true);
      const r = await services.operation.diff(opId);
      setDiffLoading(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDiff({ opId, text: r.value });
    },
    [services],
  );

  const restoreToOp = useCallback(
    (opId: string) => repo.send({ kind: "restoreToOp", payload: { opId } }),
    [repo],
  );

  const restoreFromLatestBackup = useCallback(
    async (opId: string) => {
      if (services === null) return;
      const focused = operations.find((o) => o.opId === opId);
      if (focused === undefined || focused.filesTouched.length === 0) {
        setError({ tag: "NotFound", resource: "Backup", id: opId });
        return;
      }
      const tracked = await services.repo.trackedFiles();
      if (!tracked.ok) {
        setError(tracked.error);
        return;
      }
      // Match by source path under dotfilesRoot.
      const tf = tracked.value.find((f) =>
        focused.filesTouched.some((p) => f.source.endsWith(`/${p}`) || f.source === p),
      );
      if (tf === undefined) {
        setError({ tag: "NotFound", resource: "Backup", id: opId });
        return;
      }
      const list = await services.backups.list(tf.id);
      if (!list.ok) {
        setError(list.error);
        return;
      }
      const candidates = [...list.value]
        .filter((b) => Date.parse(b.createdAt) <= Date.parse(focused.at))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const pick = candidates[0] ?? list.value[list.value.length - 1];
      if (pick === undefined) {
        setError({ tag: "NotFound", resource: "Backup", id: opId });
        return;
      }
      repo.send({ kind: "restoreFromBackup", payload: { backupId: pick.id } });
    },
    [services, operations, repo],
  );

  return {
    operations,
    status,
    error,
    focusId,
    diff,
    diffLoading,
    restoring: repo.state.restoring,
    focus,
    loadDiff: (opId) => void loadDiff(opId),
    restoreToOp,
    restoreFromLatestBackup: (opId) => void restoreFromLatestBackup(opId),
    refresh: () => void refresh(),
  };
}
