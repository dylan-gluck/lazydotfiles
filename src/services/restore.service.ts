import { isAbsolute, resolve } from "node:path";
import type { BackupRecord } from "../domain/backup";
import type { TrackedFile } from "../domain/tracked-file";
import { err, ok, type Result } from "../lib/result";
import type { BackupRepository } from "../repositories/backup.repository";
import type { FsRepository } from "../repositories/fs.repository";
import type { JjRepository } from "../repositories/jj.repository";
import type { SymlinkRepository } from "../repositories/symlink.repository";
import type { TrackedFileRepository } from "../repositories/tracked-file.repository";
import type { ServiceError } from "./types";

export interface RestoreToOpOutcome {
  readonly rematerialized: readonly TrackedFile[];
}

export interface RestoreService {
  restoreToOp(opId: string): Promise<Result<RestoreToOpOutcome, ServiceError>>;
  restoreFromBackup(backupId: string): Promise<Result<BackupRecord, ServiceError>>;
}

export interface RestoreServiceDeps {
  readonly home: string;
  readonly dotfilesRoot: string;
  readonly jj: JjRepository;
  readonly tracked: TrackedFileRepository;
  readonly symlinks: SymlinkRepository;
  readonly fs: FsRepository;
  readonly backups: BackupRepository;
  readonly now?: () => Date;
}

export function createRestoreService(deps: RestoreServiceDeps): RestoreService {
  const nowFn = deps.now ?? (() => new Date());

  function resolveSymlinkTarget(linkPath: string, target: string): string {
    return isAbsolute(target) ? target : resolve(linkPath, "..", target);
  }

  async function restoreToOp(opId: string): Promise<Result<RestoreToOpOutcome, ServiceError>> {
    const restore = await deps.jj.opRestore({ root: deps.dotfilesRoot, opId });
    if (!restore.ok) return err({ tag: "Repository", cause: restore.error });
    // Snapshot to keep working copy consistent; surface failure but proceed.
    const snap = await deps.jj.snapshot({ root: deps.dotfilesRoot });
    if (!snap.ok) return err({ tag: "Repository", cause: snap.error });

    const list = await deps.tracked.list();
    if (!list.ok) return err({ tag: "Repository", cause: list.error });

    const sorted = [...list.value].sort((a, b) => a.id.localeCompare(b.id));
    const rematerialized: TrackedFile[] = [];
    for (const tf of sorted) {
      if (tf.status !== "tracked") continue;
      // Source must exist for rematerialization to be meaningful.
      const sourceExists = await deps.fs.exists(tf.source);
      if (!sourceExists.ok) return err({ tag: "Repository", cause: sourceExists.error });
      if (!sourceExists.value) continue;

      const link = await deps.symlinks.read(tf.target);
      if (link.ok) {
        const resolved = resolveSymlinkTarget(tf.target, link.value.target);
        if (resolved === tf.source) continue;
        const u = await deps.symlinks.unlink(tf.target);
        if (!u.ok) return err({ tag: "Repository", cause: u.error });
      } else if (link.error.tag === "NotFound") {
        // ok, nothing to unlink
      } else if (link.error.tag === "IoError") {
        // Path exists but is not a symlink — remove it so we can re-link.
        const rm = await deps.fs.removeFile(tf.target);
        if (!rm.ok) return err({ tag: "Repository", cause: rm.error });
      } else {
        return err({ tag: "Repository", cause: link.error });
      }

      const m = await deps.symlinks.materialize({ target: tf.source, link: tf.target });
      if (!m.ok) return err({ tag: "Repository", cause: m.error });
      rematerialized.push(tf);
    }
    return ok({ rematerialized });
  }

  async function restoreFromBackup(backupId: string): Promise<Result<BackupRecord, ServiceError>> {
    const recordR = await deps.backups.read(backupId);
    if (!recordR.ok) return err({ tag: "Repository", cause: recordR.error });
    const record = recordR.value;

    const tfR = await deps.tracked.read(record.trackedFileId);
    if (!tfR.ok) {
      if (tfR.error.tag === "NotFound") {
        return err({ tag: "NotFound", resource: "TrackedFile", id: record.trackedFileId });
      }
      return err({ tag: "Repository", cause: tfR.error });
    }
    const target = tfR.value.target;

    // Step 1: clear existing target (symlink unlink or file remove).
    let restoredSymlinkSource: string | null = null;
    const link = await deps.symlinks.read(target);
    if (link.ok) {
      restoredSymlinkSource = resolveSymlinkTarget(target, link.value.target);
      const u = await deps.symlinks.unlink(target);
      if (!u.ok) return err({ tag: "Repository", cause: u.error });
    } else if (link.error.tag === "IoError") {
      // Not a symlink (or other IO) — remove regular file.
      const rm = await deps.fs.removeFile(target);
      if (!rm.ok) return err({ tag: "Repository", cause: rm.error });
    } else if (link.error.tag !== "NotFound") {
      return err({ tag: "Repository", cause: link.error });
    }

    // Step 2: copy payload over target.
    const copy = await deps.fs.copyFile({
      src: deps.backups.payloadPath(record),
      dst: target,
    });
    if (!copy.ok) {
      // Best-effort inverse: re-materialize the symlink we removed.
      const rollbackErrors: ServiceError[] = [];
      if (restoredSymlinkSource !== null) {
        const r = await deps.symlinks.materialize({
          target: restoredSymlinkSource,
          link: target,
        });
        if (!r.ok) rollbackErrors.push({ tag: "Repository", cause: r.error });
      }
      return err({
        tag: "Rollback",
        failedStep: "materialize",
        original: { tag: "Repository", cause: copy.error },
        rollbackErrors,
      });
    }

    // Step 3: snapshot the recovered file as a fresh BackupRecord (trigger=restore).
    const snap = await deps.backups.snapshot({
      srcPath: target,
      trackedFileId: record.trackedFileId,
      trigger: "restore",
      now: nowFn,
    });
    if (!snap.ok) return err({ tag: "Repository", cause: snap.error });
    return ok(snap.value);
  }

  return { restoreToOp, restoreFromBackup };
}
