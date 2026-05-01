import { describe, expect, test } from "bun:test";
import type { BackupRecord } from "../domain/backup";
import type { TrackedFile } from "../domain/tracked-file";
import { err, ok } from "../lib/result";
import type { BackupRepository } from "../repositories/backup.repository";
import type { FsRepository } from "../repositories/fs.repository";
import type { JjRepository } from "../repositories/jj.repository";
import type { SymlinkRepository } from "../repositories/symlink.repository";
import type { TrackedFileRepository } from "../repositories/tracked-file.repository";
import { createRestoreService } from "./restore.service";

const tf = (over: Partial<TrackedFile> = {}): TrackedFile => ({
  id: "abc",
  source: "/d/.zshrc",
  target: "/h/.zshrc",
  kind: "file",
  addedAt: "2026-05-01T00:00:00Z",
  status: "tracked",
  ...over,
});

const record = (over: Partial<BackupRecord> = {}): BackupRecord => ({
  id: "abc/20260501T000000000Z-add",
  trackedFileId: "abc",
  snapshotPath: "/b/abc/20260501T000000000Z-add",
  createdAt: "2026-05-01T00:00:00Z",
  trigger: "add",
  ...over,
});

interface Calls {
  unlink: string[];
  materialize: { target: string; link: string }[];
  removeFile: string[];
  copyFile: { src: string; dst: string }[];
  snapshot: { srcPath: string; trigger: BackupRecord["trigger"] }[];
  opRestore: string[];
}

function makeFakes(
  over: {
    symlinkRead?: SymlinkRepository["read"];
    trackedList?: TrackedFileRepository["list"];
    trackedRead?: TrackedFileRepository["read"];
    backupsRead?: BackupRepository["read"];
    copyFile?: FsRepository["copyFile"];
    jjOpRestore?: JjRepository["opRestore"];
    fsExists?: FsRepository["exists"];
  } = {},
) {
  const calls: Calls = {
    unlink: [],
    materialize: [],
    removeFile: [],
    copyFile: [],
    snapshot: [],
    opRestore: [],
  };
  const symlinks: SymlinkRepository = {
    kind: "SymlinkRepository",
    materialize: async (input) => {
      calls.materialize.push(input);
      return ok(undefined);
    },
    unlink: async (path) => {
      calls.unlink.push(path);
      return ok(undefined);
    },
    read: over.symlinkRead ?? (async () => err({ tag: "NotFound", path: "x" })),
    isLdfSymlink: async () => ok(false),
  };
  const fs: FsRepository = {
    kind: "FsRepository",
    exists: over.fsExists ?? (async () => ok(true)),
    ensureDir: async () => ok({ created: false }),
    move: async () => ok(undefined),
    copyFile:
      over.copyFile ??
      (async (input) => {
        calls.copyFile.push(input);
        return ok(undefined);
      }),
    removeFile: async (path) => {
      calls.removeFile.push(path);
      return ok(undefined);
    },
  };
  const tracked: TrackedFileRepository = {
    kind: "TrackedFileRepository",
    list: over.trackedList ?? (async () => ok([])),
    read: over.trackedRead ?? (async () => ok(tf())),
    upsert: async () => ok(undefined),
    remove: async () => ok(undefined),
  };
  const backups: BackupRepository = {
    kind: "BackupRepository",
    snapshot: async (input) => {
      calls.snapshot.push({ srcPath: input.srcPath, trigger: input.trigger });
      return ok(record({ trigger: input.trigger, id: `abc/${input.trigger}` }));
    },
    list: async () => ok([]),
    read: over.backupsRead ?? (async () => ok(record())),
    payloadPath: (r) => `${r.snapshotPath}/payload`,
  };
  const jj: Partial<JjRepository> = {
    opRestore:
      over.jjOpRestore ??
      (async ({ opId }) => {
        calls.opRestore.push(opId);
        return ok(undefined);
      }),
    snapshot: async () => ok(undefined),
  };
  return { symlinks, fs, tracked, backups, jj: jj as JjRepository, calls };
}

describe("restoreToOp", () => {
  test("rematerializes symlinks whose target is missing", async () => {
    const f = makeFakes({
      trackedList: async () => ok([tf()]),
      symlinkRead: async () => err({ tag: "NotFound", path: "/h/.zshrc" }),
    });
    const svc = createRestoreService({
      home: "/h",
      dotfilesRoot: "/d",
      ...f,
    });
    const r = await svc.restoreToOp("opX");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(f.calls.opRestore).toEqual(["opX"]);
    expect(f.calls.materialize).toEqual([{ target: "/d/.zshrc", link: "/h/.zshrc" }]);
    expect(r.value.rematerialized.map((x) => x.id)).toEqual(["abc"]);
  });

  test("does nothing when symlink already points at source", async () => {
    const f = makeFakes({
      trackedList: async () => ok([tf()]),
      symlinkRead: async () => ok({ target: "/d/.zshrc" }),
    });
    const svc = createRestoreService({ home: "/h", dotfilesRoot: "/d", ...f });
    const r = await svc.restoreToOp("opX");
    expect(r.ok).toBe(true);
    expect(f.calls.materialize).toEqual([]);
  });

  test("surfaces Repository error when jj.opRestore fails and does NOT touch symlinks", async () => {
    const f = makeFakes({
      jjOpRestore: async () =>
        err({ tag: "Spawn", command: ["jj", "op", "restore"], exitCode: 1, stderr: "x" }),
    });
    const svc = createRestoreService({ home: "/h", dotfilesRoot: "/d", ...f });
    const r = await svc.restoreToOp("opX");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
    expect(f.calls.materialize).toEqual([]);
    expect(f.calls.unlink).toEqual([]);
  });
});

describe("restoreFromBackup", () => {
  test("unlinks symlink, copies payload, emits new BackupRecord with trigger=restore", async () => {
    const f = makeFakes({
      symlinkRead: async () => ok({ target: "/d/.zshrc" }),
    });
    const svc = createRestoreService({ home: "/h", dotfilesRoot: "/d", ...f });
    const r = await svc.restoreFromBackup("abc/20260501T000000000Z-add");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.trigger).toBe("restore");
    expect(f.calls.unlink).toEqual(["/h/.zshrc"]);
    expect(f.calls.copyFile).toEqual([
      { src: "/b/abc/20260501T000000000Z-add/payload", dst: "/h/.zshrc" },
    ]);
    expect(f.calls.snapshot).toEqual([{ srcPath: "/h/.zshrc", trigger: "restore" }]);
  });

  test("returns NotFound when the BackupRecord's tracked file is gone", async () => {
    const f = makeFakes({
      trackedRead: async () => err({ tag: "NotFound", path: "x" }),
    });
    const svc = createRestoreService({ home: "/h", dotfilesRoot: "/d", ...f });
    const r = await svc.restoreFromBackup("abc/x-add");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("NotFound");
  });

  test("returns Rollback when copyFile fails after the unlink succeeded", async () => {
    const f = makeFakes({
      symlinkRead: async () => ok({ target: "/d/.zshrc" }),
      copyFile: async () => err({ tag: "IoError", path: "/h/.zshrc", cause: new Error("ENOSPC") }),
    });
    const svc = createRestoreService({ home: "/h", dotfilesRoot: "/d", ...f });
    const r = await svc.restoreFromBackup("abc/x-add");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Rollback");
    if (r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("materialize");
    // Inverse re-materialized the symlink to its prior absolute target.
    expect(f.calls.materialize).toEqual([{ target: "/d/.zshrc", link: "/h/.zshrc" }]);
  });
});
