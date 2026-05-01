import { opendir, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface FsScannerRepository {
  readonly kind: "FsScannerRepository";
  scan(opts: {
    readonly home: string;
    readonly include: readonly string[];
    readonly exclude: readonly string[];
  }): AsyncIterable<string>;
  siblings(opts: {
    readonly path: string;
    readonly depth: number;
  }): Promise<Result<readonly string[], RepoError>>;
}

/** Directory names that are never scanned regardless of include rules. */
const HARD_STOP_DIRS = new Set([".git", ".jj", "node_modules"]);

/** True for any pattern that would expand under glob semantics. */
export function isGlobPattern(pattern: string): boolean {
  return /[*?[\]{}]/.test(pattern);
}

interface CompiledRule {
  readonly negate: boolean;
  readonly glob: Bun.Glob;
}

function compile(pattern: string): CompiledRule {
  const negate = pattern.startsWith("!");
  const body = negate ? pattern.slice(1) : pattern;
  return { negate, glob: new Bun.Glob(body) };
}

/**
 * Pure: classify a forward-slash relative path against ordered include/exclude rules.
 * Returns "include" iff some include matches AND, after applying excludes in order,
 * the final state is included. `!pattern` in `exclude` re-includes a previously excluded path.
 */
export function classifyPath(
  relPath: string,
  include: readonly string[],
  exclude: readonly string[],
): "include" | "exclude" {
  // 1. Must match at least one non-negation include.
  let matched = false;
  for (const p of include) {
    if (p.startsWith("!")) continue;
    if (new Bun.Glob(p).match(relPath)) {
      matched = true;
      break;
    }
  }
  if (!matched) return "exclude";

  // 2. Apply excludes in order. Negation flips the state back to included.
  let state: "include" | "exclude" = "include";
  for (const p of exclude) {
    const rule = compile(p);
    if (!rule.glob.match(relPath)) continue;
    state = rule.negate ? "include" : "exclude";
  }
  return state;
}

function toRel(home: string, abs: string): string {
  // Always forward-slash for glob matching, even on Windows-flavored paths.
  return relative(home, abs).split(sep).join("/");
}

async function* walk(root: string): AsyncIterable<{ path: string; isDir: boolean }> {
  let dir;
  try {
    dir = await opendir(root);
  } catch {
    return;
  }
  for await (const entry of dir) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (HARD_STOP_DIRS.has(entry.name)) continue;
      yield { path: full, isDir: true };
      yield* walk(full);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      yield { path: full, isDir: false };
    }
  }
}

export function createFsScannerRepository(): FsScannerRepository {
  return {
    kind: "FsScannerRepository",

    async *scan({ home, include, exclude }) {
      const seen = new Set<string>();
      for await (const entry of walk(home)) {
        if (entry.isDir) continue;
        const rel = toRel(home, entry.path);
        if (classifyPath(rel, include, exclude) !== "include") continue;
        if (seen.has(entry.path)) continue;
        seen.add(entry.path);
        yield entry.path;
      }
    },

    async siblings({ path, depth }) {
      const parent = dirname(path);
      const skip = basename(path);
      let entries;
      try {
        entries = await readdir(parent, { withFileTypes: true });
      } catch (cause) {
        return err({ tag: "IoError", path: parent, cause });
      }
      const out: string[] = [];
      const queue: { dir: string; remaining: number }[] = [];
      for (const entry of entries) {
        const full = join(parent, entry.name);
        if (entry.isDirectory()) {
          if (HARD_STOP_DIRS.has(entry.name)) continue;
          if (depth > 1) queue.push({ dir: full, remaining: depth - 1 });
        } else if ((entry.isFile() || entry.isSymbolicLink()) && entry.name !== skip) {
          out.push(full);
        }
      }
      while (queue.length > 0) {
        const head = queue.shift()!;
        let subEntries;
        try {
          subEntries = await readdir(head.dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of subEntries) {
          const full = join(head.dir, entry.name);
          if (entry.isDirectory()) {
            if (HARD_STOP_DIRS.has(entry.name)) continue;
            if (head.remaining > 1) queue.push({ dir: full, remaining: head.remaining - 1 });
          } else if (entry.isFile() || entry.isSymbolicLink()) {
            out.push(full);
          }
        }
      }
      return ok(out);
    },
  };
}
