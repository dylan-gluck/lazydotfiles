import { useEffect, useMemo, useState } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryState } from "../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoState } from "../actors/repo.actor";
import { TRACK_ACTOR_ID, type TrackMessage, type TrackState } from "../actors/track.actor";
import { useActor } from "../actors/use-actor";
import { useOptionalServices } from "../composition/services-context";
import type { DiscoveryCandidate } from "../domain/candidate";
import type { DotfileKind, TrackedFile } from "../domain/tracked-file";
import { topSegment } from "../lib/path";
import type { ServiceError } from "../services/types";

export interface UntrackedChild {
  readonly path: string;
  readonly tracked: boolean;
}

export interface UntrackedFileEntry {
  readonly kind: "file";
  readonly path: string;
  readonly segment: string;
  readonly candidateKind: DotfileKind;
}

export interface UntrackedDirEntry {
  readonly kind: "dir";
  readonly path: string;
  readonly segment: string;
  readonly count: number;
  readonly children: readonly UntrackedChild[];
}

export type UntrackedEntry = UntrackedFileEntry | UntrackedDirEntry;

export interface UseFilesPanel {
  readonly home: string;
  readonly dotfilesRoot: string | null;
  readonly backupRoot: string | null;
  readonly tracked: readonly TrackedFile[];
  readonly untrackedEntries: readonly UntrackedEntry[];
  readonly inFlight: TrackState["inFlight"];
  readonly error: ServiceError | null;
  /** Read a file's contents through the optional fs service. */
  readContents(absPath: string): Promise<{ text: string | null; error: ServiceError | null }>;
  remove(target: string): void;
}

function buildUntrackedEntries(
  queue: readonly DiscoveryCandidate[],
  tracked: readonly TrackedFile[],
  home: string,
): readonly UntrackedEntry[] {
  const trackedTargets = new Set(tracked.map((t) => t.target));
  const trackedBySeg = new Map<string, TrackedFile[]>();
  for (const t of tracked) {
    const seg = topSegment(t.target, home);
    if (seg === null) continue;
    const list = trackedBySeg.get(seg) ?? [];
    list.push(t);
    trackedBySeg.set(seg, list);
  }
  const pendingBySeg = new Map<string, DiscoveryCandidate[]>();
  for (const c of queue) {
    if (c.status !== "pending") continue;
    const seg = topSegment(c.path, home);
    if (seg === null) continue;
    const list = pendingBySeg.get(seg) ?? [];
    list.push(c);
    pendingBySeg.set(seg, list);
  }
  const out: UntrackedEntry[] = [];
  for (const [segment, items] of pendingBySeg) {
    const segPath = home.length > 0 ? `${home}/${segment}` : segment;
    const single = items.length === 1 ? items[0] : null;
    if (single !== undefined && single !== null && single.path === segPath) {
      out.push({
        kind: "file",
        path: single.path,
        segment,
        candidateKind: single.kind,
      });
      continue;
    }
    const trackedHere = trackedBySeg.get(segment) ?? [];
    const seen = new Set<string>();
    const children: UntrackedChild[] = [];
    for (const c of items) {
      if (seen.has(c.path)) continue;
      seen.add(c.path);
      children.push({ path: c.path, tracked: trackedTargets.has(c.path) });
    }
    for (const t of trackedHere) {
      if (seen.has(t.target)) continue;
      seen.add(t.target);
      children.push({ path: t.target, tracked: true });
    }
    children.sort((a, b) => a.path.localeCompare(b.path));
    out.push({
      kind: "dir",
      path: segPath,
      segment,
      count: items.length,
      children,
    });
  }
  out.sort((a, b) => {
    const ac = a.kind === "dir" ? a.count : 1;
    const bc = b.kind === "dir" ? b.count : 1;
    if (ac !== bc) return bc - ac;
    return a.segment.localeCompare(b.segment);
  });
  return out;
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

  const untrackedEntries = useMemo(
    () => buildUntrackedEntries(discovery.state.queue, repo.state.tracked, home),
    [discovery.state.queue, repo.state.tracked, home],
  );

  const [error, setError] = useState<ServiceError | null>(null);

  return {
    home,
    dotfilesRoot,
    backupRoot,
    tracked: repo.state.tracked,
    untrackedEntries,
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
