import { useEffect, useMemo, useState } from "react";
import { DISCOVERY_ACTOR_ID, type DiscoveryState } from "../actors/discovery.actor";
import { REPO_ACTOR_ID, type RepoState } from "../actors/repo.actor";
import { TRACK_ACTOR_ID, type TrackMessage, type TrackState } from "../actors/track.actor";
import { useActor } from "../actors/use-actor";
import { useOptionalServices } from "../composition/services-context";
import type { DiscoveryCandidate } from "../domain/candidate";
import type { DotfileKind, TrackedFile } from "../domain/tracked-file";
import type { ServiceError } from "../services/types";

export interface UntrackedNode {
  readonly path: string;
  readonly name: string;
  readonly kind: "file" | "dir";
  /** Pending candidates this node represents (self + descendants). */
  readonly count: number;
  /** null when this node is a synthesized intermediate dir. */
  readonly candidateKind: DotfileKind | null;
  readonly children: readonly UntrackedNode[];
}

export interface UseFilesPanel {
  readonly home: string;
  readonly dotfilesRoot: string | null;
  readonly backupRoot: string | null;
  readonly tracked: readonly TrackedFile[];
  readonly untrackedTree: readonly UntrackedNode[];
  readonly inFlight: TrackState["inFlight"];
  readonly error: ServiceError | null;
  /** Read a file's contents through the optional fs service. */
  readContents(absPath: string): Promise<{ text: string | null; error: ServiceError | null }>;
  remove(target: string): void;
}

interface MutNode {
  path: string;
  name: string;
  kind: "file" | "dir";
  candidateKind: DotfileKind | null;
  children: Map<string, MutNode>;
}

function freezeNode(n: MutNode): UntrackedNode {
  const childs = [...n.children.values()].map(freezeNode);
  childs.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  let count = n.candidateKind === null ? 0 : 1;
  for (const c of childs) count += c.count;
  return {
    path: n.path,
    name: n.name,
    kind: n.kind,
    candidateKind: n.candidateKind,
    children: childs,
    count,
  };
}

function buildUntrackedTree(
  queue: readonly DiscoveryCandidate[],
  tracked: readonly TrackedFile[],
  home: string,
): readonly UntrackedNode[] {
  if (home.length === 0) return [];
  const trackedTargets = new Set(tracked.map((t) => t.target));
  const root: MutNode = {
    path: home,
    name: "",
    kind: "dir",
    candidateKind: null,
    children: new Map(),
  };
  const homePrefix = `${home}/`;
  for (const c of queue) {
    if (c.status !== "pending") continue;
    if (trackedTargets.has(c.path)) continue;
    if (!c.path.startsWith(homePrefix)) continue;
    const segments = c.path.slice(homePrefix.length).split("/");
    if (segments.length === 0 || segments[0] === "") continue;
    let node = root;
    let acc = home;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      acc = `${acc}/${seg}`;
      const isLeaf = i === segments.length - 1;
      const expectedKind: "file" | "dir" = isLeaf && c.kind !== "directory" ? "file" : "dir";
      let child = node.children.get(seg);
      if (child === undefined) {
        child = {
          path: acc,
          name: seg,
          kind: expectedKind,
          candidateKind: null,
          children: new Map(),
        };
        node.children.set(seg, child);
      } else if (expectedKind === "dir" && child.kind === "file") {
        // Promote a previously-leaf node to a dir when a deeper candidate appears.
        child = { ...child, kind: "dir" };
        node.children.set(seg, child);
      }
      if (isLeaf) child.candidateKind = c.kind;
      node = child;
    }
  }
  const top = [...root.children.values()].map(freezeNode);
  top.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return top;
}

export { buildUntrackedTree };

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

  const untrackedTree = useMemo(
    () => buildUntrackedTree(discovery.state.queue, repo.state.tracked, home),
    [discovery.state.queue, repo.state.tracked, home],
  );

  const [error, setError] = useState<ServiceError | null>(null);

  return {
    home,
    dotfilesRoot,
    backupRoot,
    tracked: repo.state.tracked,
    untrackedTree,
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
