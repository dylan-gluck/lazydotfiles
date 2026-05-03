/**
 * Path display helpers for the TUI.
 *
 * - {@link tildify} collapses an absolute path under `home` to `~/...`.
 * - {@link compressPath} shortens deep paths to `~/.../parent/leaf`.
 * - {@link truncateToWidth} hard-truncates a string to fit a column width.
 */

export function tildify(path: string, home: string): string {
  if (home.length === 0) return path;
  if (path === home) return "~";
  if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
  return path;
}

export interface CompressOptions {
  /** Keep at most this many trailing segments (default 2: parent/leaf). */
  readonly tail?: number;
  /** Replace removed middle with this (default "..."). */
  readonly placeholder?: string;
}

/**
 * `~/a/b/c/d/leaf` → `~/.../d/leaf` (tail=2). Preserves the leading `~` or `/`
 * when present so the result still reads as a path.
 */
export function compressPath(path: string, opts: CompressOptions = {}): string {
  const tail = opts.tail ?? 2;
  const placeholder = opts.placeholder ?? "...";
  const segs = path.split("/");
  const leadingEmpty = segs[0] === "";
  const root = leadingEmpty ? "/" : segs[0] === "~" ? "~/" : "";
  const body = leadingEmpty || segs[0] === "~" ? segs.slice(1) : segs;
  if (body.length <= tail + 1) return path;
  return `${root}${placeholder}/${body.slice(-tail).join("/")}`;
}

/** Truncate to width, with a 1-char ellipsis when shortened. */
export function truncateToWidth(s: string, width: number): string {
  if (width <= 0) return "";
  if (s.length <= width) return s;
  if (width === 1) return "…";
  return `${s.slice(0, width - 1)}…`;
}

/** Tildify, then compress when deeper than `tail + 1` from `~`. */
export function shortDir(path: string, home: string, tail = 2): string {
  return compressPath(tildify(path, home), { tail });
}
