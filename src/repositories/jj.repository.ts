import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type Operation,
  OperationSchema,
  parseOperationKind,
  type SyncState,
} from "../domain/repo";
import { isEnoent } from "../lib/fs-errors";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface JjRepository {
  readonly kind: "JjRepository";
  // Used by bootstrap; stable across the rename from vcs.repository.ts.
  isRepo(path: string): Promise<Result<boolean, RepoError>>;
  initColocated(path: string): Promise<Result<void, RepoError>>;
  // New surface for the adapter layer.
  describe(opts: { root: string; message: string }): Promise<Result<void, RepoError>>;
  snapshot(opts: { root: string }): Promise<Result<void, RepoError>>;
  newChange(opts: { root: string }): Promise<Result<void, RepoError>>;
  opLog(opts: { root: string; limit?: number }): Promise<Result<readonly Operation[], RepoError>>;
  log(opts: { root: string; limit?: number }): Promise<Result<readonly Operation[], RepoError>>;
  opRestore(opts: { root: string; opId: string }): Promise<Result<void, RepoError>>;
  /**
   * Look up the change at `@` as of a specific operation. Returns `null` when
   * the operation has no `@` change (e.g. `add workspace`, the root op).
   */
  logAtOp(opts: { root: string; opId: string }): Promise<Result<Operation | null, RepoError>>;
  /** Files touched at `@` as of a specific operation, paths relative to `root`. */
  diffSummaryAtOp(opts: {
    root: string;
    opId: string;
  }): Promise<Result<readonly string[], RepoError>>;
  /** Git-format unified diff at `@` as of a specific operation. */
  diffAtOp(opts: { root: string; opId: string }): Promise<Result<string, RepoError>>;
  status(opts: { root: string }): Promise<Result<SyncState, RepoError>>;
  gitFetch(opts: { root: string }): Promise<Result<void, RepoError>>;
  gitPush(opts: { root: string; bookmark?: string }): Promise<Result<void, RepoError>>;
  /**
   * Create or move a bookmark to `revision`. `jj bookmark set` is idempotent
   * for both — it creates new bookmarks and advances/rewinds existing ones
   * (with `--allow-backwards`).
   */
  bookmarkSet(opts: {
    root: string;
    name: string;
    revision: string;
  }): Promise<Result<void, RepoError>>;
  /** Counts of changes ahead/behind of the tracked remote bookmarks. */
  aheadBehind(opts: {
    root: string;
  }): Promise<Result<{ ahead: number; behind: number }, RepoError>>;
  /** Conflicted paths (dotfiles-repo-relative) per `jj resolve --list`. */
  listConflicts(opts: { root: string }): Promise<Result<readonly string[], RepoError>>;
  /**
   * Idempotently configure a named git remote. Adds when missing, updates URL
   * when present. Defaults `name` to `origin`.
   */
  gitRemoteSet(opts: {
    root: string;
    url: string;
    name?: string;
  }): Promise<Result<void, RepoError>>;
  /** List configured git remotes as `[{ name, url }]`. */
  gitRemoteList(opts: {
    root: string;
  }): Promise<Result<ReadonlyArray<{ name: string; url: string }>, RepoError>>;
}

const US = "\u001f"; // ASCII unit separator — never appears in legitimate jj output we parse.

// jj template emitting one record per op as US-separated fields:
//   id \u001f parentIds(comma) \u001f description-first-line \u001f time-iso \u001f
const OP_LOG_TEMPLATE =
  `id.short() ++ "${US}" ++ ` +
  `parents.map(|p| p.id().short()).join(",") ++ "${US}" ++ ` +
  `description.first_line() ++ "${US}" ++ ` +
  `time.end().format("%+") ++ "${US}" ++ ` +
  `"\n"`;

// `jj log` template with the same five-field shape.
const LOG_TEMPLATE =
  `change_id.short() ++ "${US}" ++ ` +
  `parents.map(|p| p.change_id().short()).join(",") ++ "${US}" ++ ` +
  `description.first_line() ++ "${US}" ++ ` +
  `author.timestamp().format("%+") ++ "${US}" ++ ` +
  `"\n"`;

interface RunOk {
  readonly stdout: string;
  readonly stderr: string;
}

async function runJj(
  args: readonly string[],
  opts: { cwd?: string } = {},
): Promise<Result<RunOk, RepoError>> {
  const command = ["jj", ...args] as const;
  // Provide deterministic identity defaults so tests against fresh tmp HOMEs do not fail
  // on jj's "user/email not configured" guard. Real users' env values still win.
  const env = {
    ...process.env,
    JJ_USER: process.env["JJ_USER"] ?? "ldf",
    JJ_EMAIL: process.env["JJ_EMAIL"] ?? "ldf@local",
  } as Record<string, string>;
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn([...command], {
      cwd: opts.cwd,
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
  } catch (cause) {
    return err({ tag: "IoError", path: opts.cwd ?? "", cause });
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
    new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    return err({
      tag: "Spawn",
      command: [...command],
      exitCode,
      stderr: stderr.trim(),
    });
  }
  return ok({ stdout, stderr });
}

/**
 * Parse a single US-separated op log line into an `Operation`. Exported for unit tests.
 * Accepts an optional trailing US so the writer can include one for line-stability.
 */
export function parseOperationLine(line: string): Result<Operation, RepoError> {
  const cleaned = line.endsWith(US) ? line.slice(0, -1) : line;
  const parts = cleaned.split(US);
  if (parts.length !== 4) {
    return err({
      tag: "ParseError",
      path: "(jj op log line)",
      issues: [
        {
          message: `expected 4 fields, got ${parts.length}`,
        },
      ],
    });
  }
  const [id, parentField, description, at] = parts as [string, string, string, string];
  const parentId = parentField.length === 0 ? null : parentField.split(",")[0]!;
  const candidate = {
    id,
    parentId,
    kind: parseOperationKind(description),
    description,
    at,
    filesTouched: [] as string[],
  };
  const parsed = OperationSchema["~standard"].validate(candidate);
  if (parsed.issues !== undefined) {
    return err({ tag: "ParseError", path: "(jj op log line)", issues: parsed.issues });
  }
  return ok(parsed.value);
}

function parseOperationStream(stdout: string): Result<readonly Operation[], RepoError> {
  const lines = stdout.split("\n").filter((l) => l.length > 0);
  const out: Operation[] = [];
  for (const line of lines) {
    const r = parseOperationLine(line);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(out);
}

/**
 * Parse a `jj diff --summary` block. Each non-empty line has the form
 * `<status> <path>` where `<status>` is one of `A|M|D|R|C` (single char).
 * Returns the list of paths in source order.
 */
export function parseDiffSummary(stdout: string): readonly string[] {
  const out: string[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trimEnd();
    if (line.length === 0) continue;
    const space = line.indexOf(" ");
    if (space === -1) {
      out.push(line);
      continue;
    }
    out.push(line.slice(space + 1));
  }
  return out;
}

function parseStatus(text: string, remote: string | null): SyncState {
  // `jj status` prints "The working copy has no changes." (or similar) when clean.
  // "Working copy changes:" precedes a non-empty change list.
  const dirty =
    /Working copy changes:/i.test(text) || /Working copy : .*\(.*modified.*\)/i.test(text);
  return {
    lastSyncAt: null, // populated by repo service from the most recent sync op when needed
    ahead: 0,
    behind: 0,
    dirty,
    remote,
    conflicts: [],
  };
}

/**
 * Count non-empty lines emitted by a `jj log -T '"x\n"'` invocation.
 * Exported for unit testing.
 */
export function countLines(stdout: string): number {
  let n = 0;
  for (const raw of stdout.split("\n")) {
    if (raw.length > 0) n++;
  }
  return n;
}

/**
 * Parse `jj resolve --list` output. Each non-empty line is
 * `<conflict-summary> <path>` where the summary may contain spaces
 * (e.g. "2-sided conflict including 1 deletion"). The path is the
 * trailing whitespace-separated token. Exported for unit testing.
 */
export function parseConflictList(stdout: string): readonly string[] {
  const out: string[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trimEnd();
    if (line.length === 0) continue;
    const space = line.lastIndexOf(" ");
    out.push(space === -1 ? line : line.slice(space + 1));
  }
  return out;
}

export function createJjRepository(): JjRepository {
  return {
    kind: "JjRepository",

    async isRepo(path) {
      try {
        const s = await stat(join(path, ".jj"));
        return ok(s.isDirectory());
      } catch (cause) {
        if (isEnoent(cause)) return ok(false);
        return err({ tag: "IoError", path, cause });
      }
    },

    async initColocated(path) {
      try {
        await mkdir(dirname(path), { recursive: true });
        await mkdir(path, { recursive: true });
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
      const r = await runJj(["git", "init", "--colocate", path]);
      return r.ok ? ok(undefined) : err(r.error);
    },

    async describe({ root, message }) {
      const r = await runJj(["describe", "-m", message], { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async snapshot({ root }) {
      const r = await runJj(["debug", "snapshot"], { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async newChange({ root }) {
      const r = await runJj(["new"], { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async opLog({ root, limit }) {
      const args = [
        "op",
        "log",
        "--no-graph",
        "-T",
        OP_LOG_TEMPLATE,
        "--limit",
        String(limit ?? 50),
      ];
      const r = await runJj(args, { cwd: root });
      if (!r.ok) return err(r.error);
      return parseOperationStream(r.value.stdout);
    },

    async log({ root, limit }) {
      const args = ["log", "--no-graph", "-T", LOG_TEMPLATE, "--limit", String(limit ?? 50)];
      const r = await runJj(args, { cwd: root });
      if (!r.ok) return err(r.error);
      return parseOperationStream(r.value.stdout);
    },

    async opRestore({ root, opId }) {
      const r = await runJj(["op", "restore", opId], { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async logAtOp({ root, opId }) {
      const args = ["log", "--at-op", opId, "--no-graph", "-r", "@", "-T", LOG_TEMPLATE];
      const r = await runJj(args, { cwd: root });
      if (!r.ok) {
        // Root operations and `add workspace` ops have no @ working-copy commit.
        // jj exits non-zero with a recognizable message; treat as "no change".
        if (r.error.tag === "Spawn" && /doesn't have a working-copy commit/i.test(r.error.stderr)) {
          return ok(null);
        }
        return err(r.error);
      }
      const parsed = parseOperationStream(r.value.stdout);
      if (!parsed.ok) return parsed;
      const first = parsed.value[0];
      return ok(first ?? null);
    },

    async diffSummaryAtOp({ root, opId }) {
      const r = await runJj(["diff", "--at-op", opId, "--summary", "-r", "@"], { cwd: root });
      if (!r.ok) {
        if (r.error.tag === "Spawn" && /doesn't have a working-copy commit/i.test(r.error.stderr)) {
          return ok([]);
        }
        return err(r.error);
      }
      return ok(parseDiffSummary(r.value.stdout));
    },

    async diffAtOp({ root, opId }) {
      const r = await runJj(["diff", "--at-op", opId, "--git", "-r", "@"], { cwd: root });
      if (r.ok) return ok(r.value.stdout);
      if (r.error.tag === "Spawn" && /doesn't have a working-copy commit/i.test(r.error.stderr)) {
        return ok("");
      }
      return err(r.error);
    },

    async gitFetch({ root }) {
      const r = await runJj(["git", "fetch"], { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async gitPush({ root, bookmark }) {
      const args = ["git", "push"];
      if (bookmark !== undefined) {
        // `jj git push --bookmark <name>` auto-tracks the matching remote
        // bookmark on first push, which is what we want for a fresh repo
        // whose `main` has never been pushed.
        args.push("--bookmark", bookmark);
      }
      const r = await runJj(args, { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async bookmarkSet({ root, name, revision }) {
      const r = await runJj(["bookmark", "set", name, "-r", revision, "--allow-backwards"], {
        cwd: root,
      });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async aheadBehind({ root }) {
      const ahead = await runJj(
        ["log", "--no-graph", "-r", "remote_bookmarks()..@", "-T", `"x\n"`],
        { cwd: root },
      );
      if (!ahead.ok) {
        // No remote bookmarks yet \u2192 jj exits 0 with empty stdout, but on some versions
        // it errors; treat that as zero counts rather than a hard failure.
        if (
          ahead.error.tag === "Spawn" &&
          /(no such revset|unknown revision)/i.test(ahead.error.stderr)
        ) {
          return ok({ ahead: 0, behind: 0 });
        }
        return err(ahead.error);
      }
      const behind = await runJj(
        ["log", "--no-graph", "-r", "@..remote_bookmarks()", "-T", `"x\n"`],
        { cwd: root },
      );
      if (!behind.ok) {
        if (
          behind.error.tag === "Spawn" &&
          /(no such revset|unknown revision)/i.test(behind.error.stderr)
        ) {
          return ok({ ahead: countLines(ahead.value.stdout), behind: 0 });
        }
        return err(behind.error);
      }
      return ok({
        ahead: countLines(ahead.value.stdout),
        behind: countLines(behind.value.stdout),
      });
    },

    async listConflicts({ root }) {
      const r = await runJj(["resolve", "--list"], { cwd: root });
      if (r.ok) return ok(parseConflictList(r.value.stdout));
      // jj exits non-zero when there are no conflicts. Treat as empty.
      if (
        r.error.tag === "Spawn" &&
        /no conflicts? (to resolve|in revision|found)/i.test(r.error.stderr)
      ) {
        return ok([]);
      }
      return err(r.error);
    },

    async status({ root }) {
      const s = await runJj(["status"], { cwd: root });
      if (!s.ok) return err(s.error);
      // Best-effort remote: `jj git remote list`. Empty stdout → no remote.
      const remoteRes = await runJj(["git", "remote", "list"], { cwd: root });
      let remote: string | null = null;
      if (remoteRes.ok) {
        const first = remoteRes.value.stdout.split("\n").find((l) => l.length > 0);
        if (first !== undefined) {
          // format: "<name> <url>"
          const idx = first.indexOf(" ");
          remote = idx === -1 ? null : first.slice(idx + 1).trim();
        }
      }
      return ok(parseStatus(s.value.stdout, remote));
    },

    async gitRemoteList({ root }) {
      const r = await runJj(["git", "remote", "list"], { cwd: root });
      if (!r.ok) return err(r.error);
      const out: { name: string; url: string }[] = [];
      for (const raw of r.value.stdout.split("\n")) {
        const line = raw.trim();
        if (line.length === 0) continue;
        const space = line.indexOf(" ");
        if (space === -1) continue;
        out.push({ name: line.slice(0, space), url: line.slice(space + 1).trim() });
      }
      return ok(out);
    },

    async gitRemoteSet({ root, url, name }) {
      const remoteName = name ?? "origin";
      const list = await runJj(["git", "remote", "list"], { cwd: root });
      if (!list.ok) return err(list.error);
      const exists = list.value.stdout
        .split("\n")
        .some((l) => l.startsWith(`${remoteName} `) || l === remoteName);
      const args = exists
        ? ["git", "remote", "set-url", remoteName, url]
        : ["git", "remote", "add", remoteName, url];
      const r = await runJj(args, { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },
  };
}
