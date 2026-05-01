import { lstat, readlink, symlink, unlink } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface SymlinkInfo {
  readonly target: string;
}

export interface SymlinkRepository {
  readonly kind: "SymlinkRepository";
  materialize(input: { target: string; link: string }): Promise<Result<void, RepoError>>;
  unlink(path: string): Promise<Result<void, RepoError>>;
  read(path: string): Promise<Result<SymlinkInfo, RepoError>>;
  isLdfSymlink(input: { path: string; dotfilesRoot: string }): Promise<Result<boolean, RepoError>>;
}

function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

export function createSymlinkRepository(): SymlinkRepository {
  return {
    kind: "SymlinkRepository",

    async materialize({ target, link }) {
      try {
        await lstat(link);
        return err({
          tag: "IoError",
          path: link,
          cause: new Error("link path already exists"),
        });
      } catch (cause) {
        if (!isEnoent(cause)) return err({ tag: "IoError", path: link, cause });
      }
      try {
        await symlink(target, link);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path: link, cause });
      }
    },

    async unlink(path) {
      let stats: Awaited<ReturnType<typeof lstat>>;
      try {
        stats = await lstat(path);
      } catch (cause) {
        if (isEnoent(cause)) return ok(undefined);
        return err({ tag: "IoError", path, cause });
      }
      if (!stats.isSymbolicLink()) {
        return err({
          tag: "IoError",
          path,
          cause: new Error("refusing to unlink non-symlink"),
        });
      }
      try {
        await unlink(path);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
    },

    async read(path) {
      let stats: Awaited<ReturnType<typeof lstat>>;
      try {
        stats = await lstat(path);
      } catch (cause) {
        if (isEnoent(cause)) return err({ tag: "NotFound", path });
        return err({ tag: "IoError", path, cause });
      }
      if (!stats.isSymbolicLink()) {
        return err({ tag: "IoError", path, cause: new Error("not a symlink") });
      }
      try {
        const target = await readlink(path);
        return ok({ target });
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
    },

    async isLdfSymlink({ path, dotfilesRoot }) {
      let stats: Awaited<ReturnType<typeof lstat>>;
      try {
        stats = await lstat(path);
      } catch (cause) {
        if (isEnoent(cause)) return ok(false);
        return err({ tag: "IoError", path, cause });
      }
      if (!stats.isSymbolicLink()) return ok(false);
      let target: string;
      try {
        target = await readlink(path);
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
      const resolved = isAbsolute(target) ? target : resolve(dirname(path), target);
      return ok(resolved === dotfilesRoot || resolved.startsWith(dotfilesRoot + sep));
    },
  };
}
