import { chmod, copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface FsRepository {
  readonly kind: "FsRepository";
  exists(path: string): Promise<Result<boolean, RepoError>>;
  ensureDir(path: string): Promise<Result<{ created: boolean }, RepoError>>;
  /**
   * Move `src` → `dst`, creating `dirname(dst)` if needed. Uses `rename`; on `EXDEV`
   * falls back to copy-then-unlink with mode preserved. Refuses to overwrite an
   * existing `dst` (returns `IoError`).
   */
  move(input: { src: string; dst: string }): Promise<Result<void, RepoError>>;
  /** Copy `src` → `dst` preserving mode; refuses to overwrite an existing `dst`. */
  copyFile(input: { src: string; dst: string }): Promise<Result<void, RepoError>>;
  /** Remove a regular file. ENOENT → `ok(undefined)`. */
  removeFile(path: string): Promise<Result<void, RepoError>>;
}

function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

function isExdev(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "EXDEV";
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (cause) {
    if (isEnoent(cause)) return false;
    throw cause;
  }
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

    async move({ src, dst }) {
      try {
        if (await exists(dst)) {
          return err({
            tag: "IoError",
            path: dst,
            cause: new Error("destination already exists"),
          });
        }
      } catch (cause) {
        return err({ tag: "IoError", path: dst, cause });
      }
      try {
        await mkdir(dirname(dst), { recursive: true });
      } catch (cause) {
        return err({ tag: "IoError", path: dirname(dst), cause });
      }
      try {
        await rename(src, dst);
        return ok(undefined);
      } catch (cause) {
        if (!isExdev(cause)) {
          return err({ tag: "IoError", path: src, cause });
        }
      }
      // EXDEV fallback: copy with mode + unlink original.
      let mode: number;
      try {
        mode = (await stat(src)).mode & 0o777;
      } catch (cause) {
        return err({ tag: "IoError", path: src, cause });
      }
      try {
        await copyFile(src, dst);
        await chmod(dst, mode);
        await unlink(src);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path: src, cause });
      }
    },

    async copyFile({ src, dst }) {
      try {
        if (await exists(dst)) {
          return err({
            tag: "IoError",
            path: dst,
            cause: new Error("destination already exists"),
          });
        }
      } catch (cause) {
        return err({ tag: "IoError", path: dst, cause });
      }
      try {
        await mkdir(dirname(dst), { recursive: true });
      } catch (cause) {
        return err({ tag: "IoError", path: dirname(dst), cause });
      }
      let mode: number;
      try {
        mode = (await stat(src)).mode & 0o777;
      } catch (cause) {
        return err({ tag: "IoError", path: src, cause });
      }
      try {
        await copyFile(src, dst);
        await chmod(dst, mode);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path: src, cause });
      }
    },

    async removeFile(path) {
      try {
        await unlink(path);
        return ok(undefined);
      } catch (cause) {
        if (isEnoent(cause)) return ok(undefined);
        return err({ tag: "IoError", path, cause });
      }
    },
  };
}
