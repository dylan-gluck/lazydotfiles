import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { TrackedFileSchema, type TrackedFile } from "../domain/tracked-file";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface TrackedFileRepository {
  readonly kind: "TrackedFileRepository";
  list(): Promise<Result<readonly TrackedFile[], RepoError>>;
  read(id: string): Promise<Result<TrackedFile, RepoError>>;
  upsert(file: TrackedFile): Promise<Result<void, RepoError>>;
  remove(id: string): Promise<Result<void, RepoError>>;
}

function isEnoent(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

export function createTrackedFileRepository(opts: { dotfilesRoot: string }): TrackedFileRepository {
  const indexDir = join(opts.dotfilesRoot, ".ldf", "tracked");
  const entryPath = (id: string) => join(indexDir, `${id}.json`);

  async function readEntry(path: string): Promise<Result<TrackedFile, RepoError>> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return err({ tag: "NotFound", path });
    }
    let raw: unknown;
    try {
      raw = await file.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err({ tag: "ParseError", path, issues: [{ message }] });
    }
    const parsed = TrackedFileSchema["~standard"].validate(raw);
    if (parsed.issues !== undefined) {
      return err({ tag: "ParseError", path, issues: parsed.issues });
    }
    return ok(parsed.value);
  }

  return {
    kind: "TrackedFileRepository",

    async list() {
      let entries: string[];
      try {
        entries = await readdir(indexDir);
      } catch (cause) {
        if (isEnoent(cause)) return ok([] as readonly TrackedFile[]);
        return err({ tag: "IoError", path: indexDir, cause });
      }
      const out: TrackedFile[] = [];
      for (const name of entries) {
        if (!name.endsWith(".json")) continue;
        const r = await readEntry(join(indexDir, name));
        if (!r.ok) return r;
        out.push(r.value);
      }
      return ok(out);
    },

    async read(id) {
      return readEntry(entryPath(id));
    },

    async upsert(file) {
      const path = entryPath(file.id);
      try {
        await mkdir(indexDir, { recursive: true });
      } catch (cause) {
        return err({ tag: "IoError", path: indexDir, cause });
      }
      try {
        await Bun.write(path, `${JSON.stringify(file, null, 2)}\n`);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
    },

    async remove(id) {
      const path = entryPath(id);
      try {
        await rm(path, { force: false });
        return ok(undefined);
      } catch (cause) {
        if (isEnoent(cause)) return err({ tag: "NotFound", path });
        return err({ tag: "IoError", path, cause });
      }
    },
  };
}
