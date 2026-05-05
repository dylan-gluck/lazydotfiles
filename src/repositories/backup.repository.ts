import { chmod, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  type BackupRecord,
  BackupRecordSchema,
  type BackupTrigger,
  formatBackupTimestamp,
  makeBackupRecord,
} from "../domain/backup";
import { isEnoent, isExdev } from "../lib/fs-errors";
import { err, ok, type Result } from "../lib/result";
import type { RepoError } from "./types";

export interface BackupSnapshotInput {
  readonly srcPath: string;
  readonly trackedFileId: string;
  readonly trigger: BackupTrigger;
  readonly now?: () => Date;
}

export interface BackupRepository {
  readonly kind: "BackupRepository";
  snapshot(input: BackupSnapshotInput): Promise<Result<BackupRecord, RepoError>>;
  list(trackedFileId: string): Promise<Result<readonly BackupRecord[], RepoError>>;
  read(id: string): Promise<Result<BackupRecord, RepoError>>;
  payloadPath(record: BackupRecord): string;
}

const PAYLOAD = "payload";
const META = "meta.json";

export function createBackupRepository(opts: { backupRoot: string }): BackupRepository {
  function payloadPath(record: BackupRecord): string {
    return join(record.snapshotPath, PAYLOAD);
  }

  async function readMeta(metaFile: string): Promise<Result<BackupRecord, RepoError>> {
    const file = Bun.file(metaFile);
    if (!(await file.exists())) return err({ tag: "NotFound", path: metaFile });
    let raw: unknown;
    try {
      raw = await file.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return err({ tag: "ParseError", path: metaFile, issues: [{ message }] });
    }
    const parsed = BackupRecordSchema["~standard"].validate(raw);
    if (parsed.issues !== undefined) {
      return err({ tag: "ParseError", path: metaFile, issues: parsed.issues });
    }
    return ok(parsed.value);
  }

  return {
    kind: "BackupRepository",

    async snapshot({ srcPath, trackedFileId, trigger, now }) {
      let srcStat: Awaited<ReturnType<typeof stat>>;
      try {
        srcStat = await stat(srcPath);
      } catch (cause) {
        if (isEnoent(cause)) return err({ tag: "NotFound", path: srcPath });
        return err({ tag: "IoError", path: srcPath, cause });
      }
      const at = (now ?? (() => new Date()))();
      const stamp = formatBackupTimestamp(at);
      const dir = join(opts.backupRoot, trackedFileId, `${stamp}-${trigger}`);
      try {
        await stat(dir);
        return err({
          tag: "IoError",
          path: dir,
          cause: new Error("snapshot directory already exists (clock collision)"),
        });
      } catch (cause) {
        if (!isEnoent(cause)) return err({ tag: "IoError", path: dir, cause });
      }
      try {
        await mkdir(dir, { recursive: true });
      } catch (cause) {
        return err({ tag: "IoError", path: dir, cause });
      }
      const payload = join(dir, PAYLOAD);
      try {
        await Bun.write(payload, Bun.file(srcPath));
      } catch (cause) {
        if (!isExdev(cause)) return err({ tag: "IoError", path: payload, cause });
        try {
          const { cp } = await import("node:fs/promises");
          await cp(srcPath, payload, { preserveTimestamps: true });
        } catch (cpCause) {
          return err({ tag: "IoError", path: payload, cause: cpCause });
        }
      }
      try {
        await chmod(payload, srcStat.mode & 0o777);
      } catch (cause) {
        return err({ tag: "IoError", path: payload, cause });
      }
      const record = makeBackupRecord({
        trackedFileId,
        snapshotPath: dir,
        createdAt: at.toISOString(),
        trigger,
      });
      try {
        await Bun.write(join(dir, META), `${JSON.stringify(record, null, 2)}\n`);
      } catch (cause) {
        return err({ tag: "IoError", path: join(dir, META), cause });
      }
      return ok(record);
    },

    async list(trackedFileId) {
      const dir = join(opts.backupRoot, trackedFileId);
      let entries: string[];
      try {
        entries = await readdir(dir);
      } catch (cause) {
        if (isEnoent(cause)) return ok([]);
        return err({ tag: "IoError", path: dir, cause });
      }
      const records: BackupRecord[] = [];
      for (const name of entries) {
        const metaFile = join(dir, name, META);
        if (!(await Bun.file(metaFile).exists())) continue;
        const r = await readMeta(metaFile);
        if (!r.ok) return r;
        records.push(r.value);
      }
      records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return ok(records);
    },

    async read(id) {
      const slash = id.indexOf("/");
      if (slash === -1 || slash === id.length - 1) {
        return err({ tag: "NotFound", path: id });
      }
      const trackedFileId = id.slice(0, slash);
      const leaf = id.slice(slash + 1);
      const metaFile = join(opts.backupRoot, trackedFileId, leaf, META);
      return readMeta(metaFile);
    },

    payloadPath,
  };
}
