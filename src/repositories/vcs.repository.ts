import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface JjRepository {
  readonly kind: "JjRepository";
  /** True iff `<path>/.jj/` exists. Does not validate repo health. */
  isRepo(path: string): Promise<Result<boolean, RepoError>>;
  /** Run `jj git init <path>` (colocated). Creates `<path>` if missing. */
  initColocated(path: string): Promise<Result<void, RepoError>>;
}

function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
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
      try {
        const proc = Bun.spawn(["jj", "git", "init", "--colocate", path], {
          stdout: "pipe",
          stderr: "pipe",
        });
        const exitCode = await proc.exited;
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          return err({
            tag: "IoError",
            path,
            cause: new Error(`jj git init exited ${exitCode}: ${stderr.trim()}`),
          });
        }
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
    },
  };
}
