/**
 * Replace a leading `~/` (or bare `~`) and every `$HOME` token with `home`.
 * Returns the input unchanged when neither token is present.
 */
export function expandHome(input: string, home: string): string {
  let out = input;
  if (out === "~") {
    out = home;
  } else if (out.startsWith("~/")) {
    out = home + out.slice(1);
  }
  if (out.includes("$HOME")) {
    out = out.split("$HOME").join(home);
  }
  return out;
}

/**
 * Expand `home`, `dotfiles`, `backup`, `cache` in a `Paths`-shaped aggregate.
 * Pure; returns a new object preserving any extra fields the caller carries.
 */
export function expandPaths<
  P extends { home: string; dotfiles: string; backup: string; cache?: string | undefined },
>(paths: P, home: string): P {
  return {
    ...paths,
    home: expandHome(paths.home, home),
    dotfiles: expandHome(paths.dotfiles, home),
    backup: expandHome(paths.backup, home),
    cache: paths.cache === undefined ? undefined : expandHome(paths.cache, home),
  };
}

/**
 * Top-level segment of `absPath` relative to `home` (e.g. ".config", ".claude").
 * Returns null when the path is empty after stripping leading slashes.
 */
export function topSegment(absPath: string, home: string): string | null {
  if (home.length > 0 && absPath.startsWith(`${home}/`)) {
    const rest = absPath.slice(home.length + 1);
    const slash = rest.indexOf("/");
    return slash === -1 ? rest : rest.slice(0, slash);
  }
  const cleaned = absPath.startsWith("/") ? absPath.slice(1) : absPath;
  const slash = cleaned.indexOf("/");
  return slash === -1 ? (cleaned.length > 0 ? cleaned : null) : cleaned.slice(0, slash);
}

export interface QueueSegmentGroup {
  /** Top-level segment under the home dir (e.g. ".config", ".claude"). */
  readonly segment: string;
  readonly count: number;
}

/**
 * Group a discovery queue's pending entries by their top-level segment under `home`.
 * Sort: highest count first, then segment name asc.
 */
export function groupQueueBySegment(
  queue: readonly { path: string; status: string }[],
  home: string,
): readonly QueueSegmentGroup[] {
  const counts = new Map<string, number>();
  for (const c of queue) {
    if (c.status !== "pending") continue;
    const seg = topSegment(c.path, home);
    if (seg === null) continue;
    counts.set(seg, (counts.get(seg) ?? 0) + 1);
  }
  const groups: QueueSegmentGroup[] = [];
  for (const [segment, count] of counts) groups.push({ segment, count });
  groups.sort((a, b) => b.count - a.count || a.segment.localeCompare(b.segment));
  return groups;
}
