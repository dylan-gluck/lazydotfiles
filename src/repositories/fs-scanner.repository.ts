import { opendir, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface ScannedEntry {
  readonly path: string;
  readonly isDir: boolean;
}

export interface FsScannerRepository {
  readonly kind: "FsScannerRepository";
  scan(opts: {
    readonly home: string;
    readonly include: readonly string[];
    readonly exclude: readonly string[];
  }): AsyncIterable<ScannedEntry>;
  siblings(opts: {
    readonly path: string;
    readonly depth: number;
  }): Promise<Result<readonly string[], RepoError>>;
  /**
   * Direct (or up to `depth`) descendants of a directory, including
   * sub-directories. Honors HARD_STOP_DIRS. Used by the files panel to lazily
   * fill in a dir node the user is expanding.
   */
  listChildren(opts: {
    readonly path: string;
    readonly depth?: number;
  }): Promise<Result<readonly ScannedEntry[], RepoError>>;
}

/**
 * Directory names that are never scanned regardless of include rules.
 * Anchored at any depth — so `Library/Caches` and `Project/.cache` are both
 * skipped via the `.cache`/`Caches` entry. Keep this list focused on dirs
 * that are large, recreated cheaply, or never meant to be tracked as
 * dotfiles, so we don't waste a HOME walk on them.
 */
const HARD_STOP_DIRS = new Set([
  ".git",
  ".jj",
  "node_modules",
  "Library",
  "Applications",
  ".Trash",
  ".cache",
  "Caches",
  ".npm",
  ".bun",
  ".cargo",
  ".rustup",
  ".pnpm-store",
  ".yarn",
  ".gradle",
  "Downloads",
  "Movies",
  "Pictures",
  "Music",
  "Public",
  "Desktop",
  "Documents",
]);

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

interface CompiledRules {
  readonly includes: readonly Bun.Glob[];
  readonly excludes: readonly CompiledRule[];
}

function compileRules(include: readonly string[], exclude: readonly string[]): CompiledRules {
  const includes: Bun.Glob[] = [];
  for (const p of include) {
    if (p.startsWith("!")) continue;
    includes.push(new Bun.Glob(p));
  }
  const excludes = exclude.map(compile);
  return { includes, excludes };
}

function classifyCompiled(relPath: string, rules: CompiledRules): "include" | "exclude" {
  let matched = false;
  for (const g of rules.includes) {
    if (g.match(relPath)) {
      matched = true;
      break;
    }
  }
  if (!matched) return "exclude";
  let state: "include" | "exclude" = "include";
  for (const rule of rules.excludes) {
    if (!rule.glob.match(relPath)) continue;
    state = rule.negate ? "include" : "exclude";
  }
  return state;
}

/**
 * Pure: classify a forward-slash relative path against ordered include/exclude rules.
 * Returns "include" iff some include matches AND, after applying excludes in order,
 * the final state is included. `!pattern` in `exclude` re-includes a previously excluded path.
 *
 * For one-shot calls. Hot-path scans should call `compileRules` once and reuse
 * via `classifyCompiled` to avoid recompiling globs per file.
 */
export function classifyPath(
  relPath: string,
  include: readonly string[],
  exclude: readonly string[],
): "include" | "exclude" {
  return classifyCompiled(relPath, compileRules(include, exclude));
}

/**
 * Pure: apply only the exclude rules. Used by the lazy dir-expansion path,
 * where the user explicitly opened a directory and wants to see everything
 * inside that hasn't been blacklisted (e.g. `.DS_Store`, `.env*`).
 */
export function isExcludedPath(relPath: string, exclude: readonly string[]): boolean {
  const compiled = exclude.map(compile);
  let state: "keep" | "drop" = "keep";
  for (const rule of compiled) {
    if (!rule.glob.match(relPath)) continue;
    state = rule.negate ? "keep" : "drop";
  }
  return state === "drop";
}

function toRel(home: string, abs: string): string {
  // Always forward-slash for glob matching, even on Windows-flavored paths.
  return relative(home, abs).split(sep).join("/");
}

/**
 * Single dir-entry pass shared by `siblings()`. Pushes files to `out` and
 * directories with budget remaining to `queue`. `skipName` is honored at the
 * starting depth (the focal file itself); pass `null` for sub-dirs.
 */
function processEntries(
  entries: readonly {
    name: string;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }[],
  dir: string,
  remaining: number,
  skipName: string | null,
  queue: { dir: string; remaining: number }[],
  out: string[],
): void {
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (HARD_STOP_DIRS.has(entry.name)) continue;
      if (remaining > 1) queue.push({ dir: full, remaining: remaining - 1 });
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (entry.name === skipName) continue;
      out.push(full);
    }
  }
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
      const rules = compileRules(include, exclude);
      const seen = new Set<string>();
      for await (const entry of walk(home)) {
        const rel = toRel(home, entry.path);
        if (classifyCompiled(rel, rules) !== "include") continue;
        if (seen.has(entry.path)) continue;
        seen.add(entry.path);
        yield { path: entry.path, isDir: entry.isDir };
      }
    },

    async listChildren({ path, depth }) {
      const max = depth ?? 1;
      let entries;
      try {
        entries = await readdir(path, { withFileTypes: true });
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
      const out: ScannedEntry[] = [];
      const queue: { dir: string; remaining: number }[] = [];
      for (const entry of entries) {
        const full = join(path, entry.name);
        if (entry.isDirectory()) {
          if (HARD_STOP_DIRS.has(entry.name)) continue;
          out.push({ path: full, isDir: true });
          if (max > 1) queue.push({ dir: full, remaining: max - 1 });
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          out.push({ path: full, isDir: false });
        }
      }
      while (queue.length > 0) {
        const head = queue.shift()!;
        let sub;
        try {
          sub = await readdir(head.dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const entry of sub) {
          const full = join(head.dir, entry.name);
          if (entry.isDirectory()) {
            if (HARD_STOP_DIRS.has(entry.name)) continue;
            out.push({ path: full, isDir: true });
            if (head.remaining > 1) queue.push({ dir: full, remaining: head.remaining - 1 });
          } else if (entry.isFile() || entry.isSymbolicLink()) {
            out.push({ path: full, isDir: false });
          }
        }
      }
      return ok(out);
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
      processEntries(entries, parent, depth, skip, queue, out);
      while (queue.length > 0) {
        const head = queue.shift()!;
        let subEntries;
        try {
          subEntries = await readdir(head.dir, { withFileTypes: true });
        } catch {
          continue;
        }
        processEntries(subEntries, head.dir, head.remaining, null, queue, out);
      }
      return ok(out);
    },
  };
}
