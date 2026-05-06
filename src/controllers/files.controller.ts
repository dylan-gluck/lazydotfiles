import { useEffect, useMemo, useState } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryState } from "../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoState } from "../actors/repo.actor";
import { TRACK_ACTOR_ID, type TrackMessage, type TrackState } from "../actors/track.actor";
import { useActor } from "../actors/use-actor";
import { useOptionalServices } from "../composition/services-context";
import type { TrackedFile } from "../domain/tracked-file";
import { groupQueueBySegment, type QueueSegmentGroup } from "../lib/path";
import type { ServiceError } from "../services/types";

export type UntrackedGroup = QueueSegmentGroup;

export interface UseFilesPanel {
  readonly home: string;
  readonly dotfilesRoot: string | null;
  readonly backupRoot: string | null;
  readonly tracked: readonly TrackedFile[];
  readonly untrackedGroups: readonly UntrackedGroup[];
  readonly inFlight: TrackState["inFlight"];
  readonly error: ServiceError | null;
  /** Read a file's contents through the optional fs service. */
  readContents(absPath: string): Promise<{ text: string | null; error: ServiceError | null }>;
  remove(target: string): void;
}

export function useFilesPanel(): UseFilesPanel {
  const services = useOptionalServices();
  const repo = useActor<RepoState>(REPO_ACTOR_ID);
  const discovery = useActor<DiscoveryState>(DISCOVERY_ACTOR_ID);
  const track = useActor<TrackState, TrackMessage>(TRACK_ACTOR_ID);

  useEffect(() => {
    // Mount-only refresh. The repo actor publishes tracked + ops; refreshing
    // here keeps focus snapshots fresh on view switch.
  }, []);

  const home = services?.home ?? "";
  const dotfilesRoot = home.length > 0 ? `${home}/dotfiles` : null;
  const backupRoot = home.length > 0 ? `${home}/.dotfiles.bak` : null;

  const untrackedGroups = useMemo(
    () => groupQueueBySegment(discovery.state.queue, home),
    [discovery.state.queue, home],
  );

  const [error, setError] = useState<ServiceError | null>(null);

  return {
    home,
    dotfilesRoot,
    backupRoot,
    tracked: repo.state.tracked,
    untrackedGroups,
    inFlight: track.state.inFlight,
    error: track.state.lastError ?? error,
    readContents: async (absPath) => {
      try {
        const text = await Bun.file(absPath).text();
        return { text, error: null };
      } catch (cause) {
        const err: ServiceError = {
          tag: "Repository",
          cause: { tag: "IoError", path: absPath, cause },
        };
        setError(err);
        return { text: null, error: err };
      }
    },
    remove: (target: string) => track.send({ kind: "remove", payload: { path: target } }),
  };
}
