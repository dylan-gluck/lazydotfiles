import { stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { makeTrackedFile, type TrackedFile, trackedFileId } from "../domain/tracked-file";
import { err, ok, type Result } from "../lib/result";
import type { FsRepository } from "../repositories/fs.repository";
import type { JjRepository } from "../repositories/jj.repository";
import type { SymlinkRepository } from "../repositories/symlink.repository";
import type { TrackedFileRepository } from "../repositories/tracked-file.repository";
import type { RepoError } from "../repositories/types";
import type { BackupService } from "./backup.service";
import type { ServiceError, TrackStep } from "./types";

export interface TrackService {
  add(absolutePath: string): Promise<Result<TrackedFile, ServiceError>>;
  remove(absolutePath: string): Promise<Result<TrackedFile, ServiceError>>;
}

export interface TrackServiceDeps {
  readonly home: string;
  readonly dotfilesRoot: string;
  readonly fs: FsRepository;
  readonly symlinks: SymlinkRepository;
  readonly tracked: TrackedFileRepository;
  readonly jj: JjRepository;
  readonly backups: BackupService;
  readonly now?: () => Date;
}

function repoErr(cause: RepoError): ServiceError {
  return { tag: "Repository", cause };
}

function isUnder(path: string, root: string): boolean {
  const r = resolve(root);
  const p = resolve(path);
  return p === r || p.startsWith(r + sep);
}

interface InverseStep {
  readonly step: TrackStep;
  run(): Promise<Result<void, ServiceError>>;
}

async function runInverse(inverses: readonly InverseStep[]): Promise<readonly ServiceError[]> {
  const errors: ServiceError[] = [];
  // Replay in reverse order.
  for (let i = inverses.length - 1; i >= 0; i--) {
    const step = inverses[i]!;
    try {
      const r = await step.run();
      if (!r.ok) errors.push(r.error);
    } catch (cause) {
      errors.push({
        tag: "Repository",
        cause: { tag: "IoError", path: "(inverse)", cause },
      });
    }
  }
  return errors;
}

function rollback(
  failedStep: TrackStep,
  original: ServiceError,
  rollbackErrors: readonly ServiceError[],
): ServiceError {
  return { tag: "Rollback", failedStep, original, rollbackErrors };
}

export function createTrackService(deps: TrackServiceDeps): TrackService {
  const nowFn = deps.now ?? (() => new Date());

  async function captureHeadOp(): Promise<string | null> {
    const ops = await deps.jj.opLog({ root: deps.dotfilesRoot, limit: 1 });
    if (!ops.ok) return null;
    return ops.value[0]?.id ?? null;
  }

  function jjRestoreInverse(headOpId: string | null): InverseStep {
    return {
      step: "describe",
      run: async () => {
        if (headOpId === null) return ok(undefined);
        const r = await deps.jj.opRestore({ root: deps.dotfilesRoot, opId: headOpId });
        return r.ok ? ok(undefined) : err(repoErr(r.error));
      },
    };
  }

  /**
   * Run the jj `describe → snapshot → new` triplet that finalizes a
   * track/untrack mutation. On any failure replays the accumulated `inverses`
   * (which the caller seeds with `jjRestoreInverse(preOp)` once `describe`
   * succeeds) and surfaces a Rollback error tagged `"describe"`.
   */
  async function describeAndAdvance(
    message: string,
    preOp: string | null,
    inverses: InverseStep[],
  ): Promise<Result<undefined, ServiceError>> {
    const jjInverse = jjRestoreInverse(preOp);
    const desc = await deps.jj.describe({ root: deps.dotfilesRoot, message });
    if (!desc.ok) {
      return err(rollback("describe", repoErr(desc.error), await runInverse(inverses)));
    }
    inverses.push(jjInverse);
    const snap = await deps.jj.snapshot({ root: deps.dotfilesRoot });
    if (!snap.ok) {
      return err(rollback("describe", repoErr(snap.error), await runInverse(inverses)));
    }
    const advanced = await deps.jj.newChange({ root: deps.dotfilesRoot });
    if (!advanced.ok) {
      return err(rollback("describe", repoErr(advanced.error), await runInverse(inverses)));
    }
    return ok(undefined);
  }

  async function add(absolutePath: string): Promise<Result<TrackedFile, ServiceError>> {
    const target = absolutePath;
    const id = trackedFileId(target);
    const rel = relative(deps.home, target);
    const source = resolve(deps.dotfilesRoot, rel);

    // Step 1: validate.
    const exists = await deps.fs.exists(target);
    if (!exists.ok) return err(repoErr(exists.error));
    if (!exists.value) {
      return err({ tag: "InvalidTarget", reason: "missing", path: target });
    }
    const isLdf = await deps.symlinks.isLdfSymlink({
      path: target,
      dotfilesRoot: deps.dotfilesRoot,
    });
    if (!isLdf.ok) return err(repoErr(isLdf.error));
    if (isLdf.value) {
      return err({ tag: "InvalidTarget", reason: "already-symlinked", path: target });
    }
    if (isUnder(target, deps.dotfilesRoot)) {
      return err({ tag: "InvalidTarget", reason: "under-dotfiles", path: target });
    }

    // Snapshot the current jj head op so we can fully unwind anything jj records
    // (describe + snapshot + new) on failure.
    const preTrackOp = await captureHeadOp();
    const inverses: InverseStep[] = [];

    // Step 2: snapshot.
    const snap = await deps.backups.snapshot({
      srcPath: target,
      trackedFileId: id,
      trigger: "add",
      now: nowFn,
    });
    if (!snap.ok) {
      return err(rollback("snapshot", snap.error, await runInverse(inverses)));
    }
    const record = snap.value;

    // Step 3: move.
    const moved = await deps.fs.move({ src: target, dst: source });
    if (!moved.ok) {
      // If move failed, target should still be there; ensure we don't leave stragglers.
      const targetStill = await deps.fs.exists(target);
      if (targetStill.ok && !targetStill.value) {
        // Restore from backup payload.
        await deps.fs.copyFile({ src: deps.backups.payloadPath(record), dst: target });
      }
      return err(rollback("move", repoErr(moved.error), await runInverse(inverses)));
    }
    inverses.push({
      step: "move",
      run: async () => {
        const sourceStill = await deps.fs.exists(source);
        if (sourceStill.ok && sourceStill.value) {
          const back = await deps.fs.move({ src: source, dst: target });
          return back.ok ? ok(undefined) : err(repoErr(back.error));
        }
        const restore = await deps.fs.copyFile({
          src: deps.backups.payloadPath(record),
          dst: target,
        });
        return restore.ok ? ok(undefined) : err(repoErr(restore.error));
      },
    });

    // Step 4: symlink.
    const linked = await deps.symlinks.materialize({ target: source, link: target });
    if (!linked.ok) {
      return err(rollback("symlink", repoErr(linked.error), await runInverse(inverses)));
    }
    inverses.push({
      step: "symlink",
      run: async () => {
        const u = await deps.symlinks.unlink(target);
        return u.ok ? ok(undefined) : err(repoErr(u.error));
      },
    });

    // Step 5: jj describe → snapshot → new (single inverse: op restore preTrackOp).
    const triplet = await describeAndAdvance(`track ${rel}`, preTrackOp, inverses);
    if (!triplet.ok) return triplet;

    // Step 6: record.
    const file = makeTrackedFile({
      source,
      target,
      kind: "file",
      addedAt: nowFn().toISOString(),
      status: "tracked",
    });
    const upserted = await deps.tracked.upsert(file);
    if (!upserted.ok) {
      return err(rollback("record", repoErr(upserted.error), await runInverse(inverses)));
    }
    return ok(file);
  }

  async function remove(absolutePath: string): Promise<Result<TrackedFile, ServiceError>> {
    const target = absolutePath;
    const id = trackedFileId(target);
    const rel = relative(deps.home, target);
    const source = resolve(deps.dotfilesRoot, rel);

    // Step 1: validate.
    const isLdf = await deps.symlinks.isLdfSymlink({
      path: target,
      dotfilesRoot: deps.dotfilesRoot,
    });
    if (!isLdf.ok) return err(repoErr(isLdf.error));
    if (!isLdf.value) {
      return err({ tag: "InvalidTarget", reason: "not-tracked-symlink", path: target });
    }
    const existing = await deps.tracked.read(id);
    if (!existing.ok) {
      if (existing.error.tag === "NotFound") {
        return err({ tag: "InvalidTarget", reason: "not-tracked-symlink", path: target });
      }
      return err(repoErr(existing.error));
    }
    const sourceExists = await deps.fs.exists(source);
    if (!sourceExists.ok) return err(repoErr(sourceExists.error));
    if (!sourceExists.value) {
      return err({ tag: "InvalidTarget", reason: "not-tracked-symlink", path: target });
    }
    let sourceMode = 0o644;
    try {
      sourceMode = (await stat(source)).mode & 0o777;
    } catch {
      // swallow; default mode 0o644.
    }

    const preTrackOp = await captureHeadOp();
    const inverses: InverseStep[] = [];

    // Step 2: snapshot current source.
    const snap = await deps.backups.snapshot({
      srcPath: source,
      trackedFileId: id,
      trigger: "remove",
      now: nowFn,
    });
    if (!snap.ok) {
      return err(rollback("snapshot", snap.error, await runInverse(inverses)));
    }
    const record = snap.value;

    // Step 3: unlink the symlink at target.
    const unlinked = await deps.symlinks.unlink(target);
    if (!unlinked.ok) {
      return err(rollback("unlink-symlink", repoErr(unlinked.error), await runInverse(inverses)));
    }
    inverses.push({
      step: "unlink-symlink",
      run: async () => {
        const m = await deps.symlinks.materialize({ target: source, link: target });
        return m.ok ? ok(undefined) : err(repoErr(m.error));
      },
    });

    // Step 4: materialize copy at target.
    const copied = await deps.fs.copyFile({ src: source, dst: target });
    if (!copied.ok) {
      return err(rollback("materialize", repoErr(copied.error), await runInverse(inverses)));
    }
    try {
      const { chmod } = await import("node:fs/promises");
      await chmod(target, sourceMode);
    } catch {
      // best-effort; non-fatal.
    }
    inverses.push({
      step: "materialize",
      run: async () => {
        const r = await deps.fs.removeFile(target);
        return r.ok ? ok(undefined) : err(repoErr(r.error));
      },
    });

    // Step 5: remove the source under dotfilesRoot.
    const removedSrc = await deps.fs.removeFile(source);
    if (!removedSrc.ok) {
      return err(rollback("unlink-source", repoErr(removedSrc.error), await runInverse(inverses)));
    }
    inverses.push({
      step: "unlink-source",
      run: async () => {
        const r = await deps.fs.copyFile({
          src: deps.backups.payloadPath(record),
          dst: source,
        });
        return r.ok ? ok(undefined) : err(repoErr(r.error));
      },
    });

    // Step 6: jj describe → snapshot → new.
    const triplet = await describeAndAdvance(`untrack ${rel}`, preTrackOp, inverses);
    if (!triplet.ok) return triplet;

    // Step 7: record (status -> "untracked").
    const updated: TrackedFile = { ...existing.value, status: "untracked" };
    const upserted = await deps.tracked.upsert(updated);
    if (!upserted.ok) {
      const rolledBack = await runInverse(inverses);
      const revert = await deps.tracked.upsert(existing.value);
      const extra = revert.ok ? rolledBack : [...rolledBack, repoErr(revert.error)];
      return err(rollback("record", repoErr(upserted.error), extra));
    }
    return ok(updated);
  }

  return { add, remove };
}
