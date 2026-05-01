import { mkdir, stat } from "node:fs/promises";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface FsRepository {
  readonly kind: "FsRepository";
  exists(path: string): Promise<Result<boolean, RepoError>>;
  ensureDir(path: string): Promise<Result<{ created: boolean }, RepoError>>;
}

function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

export function createFsRepository(): FsRepository {
  return {
    kind: "FsRepository",
    async exists(path) {
      try {
        await stat(path);
        return ok(true);
      } catch (cause) {
        if (isEnoent(cause)) return ok(false);
        return err({ tag: "IoError", path, cause });
      }
    },
    async ensureDir(path) {
      let preExisted = false;
      try {
        const s = await stat(path);
        preExisted = s.isDirectory();
        if (!preExisted) {
          return err({
            tag: "IoError",
            path,
            cause: new Error(`path exists and is not a directory: ${path}`),
          });
        }
      } catch (cause) {
        if (!isEnoent(cause)) {
          return err({ tag: "IoError", path, cause });
        }
      }
      try {
        await mkdir(path, { recursive: true });
        return ok({ created: !preExisted });
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
    },
  };
}
