import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type Operation,
  OperationSchema,
  parseOperationKind,
  type SyncState,
} from "../domain/repo";
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
  opLog(opts: { root: string; limit?: number }): Promise<Result<readonly Operation[], RepoError>>;
  log(opts: { root: string; limit?: number }): Promise<Result<readonly Operation[], RepoError>>;
  opRestore(opts: { root: string; opId: string }): Promise<Result<void, RepoError>>;
  status(opts: { root: string }): Promise<Result<SyncState, RepoError>>;
  gitFetch(opts: { root: string }): Promise<Result<void, RepoError>>;
  gitPush(opts: { root: string }): Promise<Result<void, RepoError>>;
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

function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

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
  };
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

    async gitFetch({ root }) {
      const r = await runJj(["git", "fetch"], { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
    },

    async gitPush({ root }) {
      const r = await runJj(["git", "push"], { cwd: root });
      return r.ok ? ok(undefined) : err(r.error);
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
  };
}
