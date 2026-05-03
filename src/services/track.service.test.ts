import { afterEach, describe, expect, test } from "bun:test";
import { lstat, mkdir, readlink, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { trackedFileId } from "../domain/tracked-file";
import { err, ok, type Result } from "../lib/result";
import { createBackupRepository } from "../repositories/backup.repository";
import { createFsRepository, type FsRepository } from "../repositories/fs.repository";
import type { JjRepository } from "../repositories/jj.repository";
import {
  createSymlinkRepository,
  type SymlinkRepository,
} from "../repositories/symlink.repository";
import {
  createTrackedFileRepository,
  type TrackedFileRepository,
} from "../repositories/tracked-file.repository";
import type { RepoError } from "../repositories/types";
import { makeTmpDir, type TmpDir } from "../test-utils/tmp";
import { createBackupService } from "./backup.service";
import { createTrackService, type TrackService } from "./track.service";

interface JjCall {
  readonly cmd: "describe" | "snapshot" | "opRestore";
  readonly message?: string;
  readonly opId?: string;
}

interface FakeJj extends JjRepository {
  readonly calls: readonly JjCall[];
  readonly callsArr: JjCall[];
}

function fakeJj(faults: { describe?: RepoError; snapshot?: RepoError } = {}): FakeJj {
  const callsArr: JjCall[] = [];
  const repo: JjRepository = {
    kind: "JjRepository",
    isRepo: async () => ok(true),
    initColocated: async () => ok(undefined),
    describe: async ({ message }) => {
      callsArr.push({ cmd: "describe", message });
      if (faults.describe !== undefined) return err(faults.describe);
      return ok(undefined);
    },
    snapshot: async () => {
      callsArr.push({ cmd: "snapshot" });
      if (faults.snapshot !== undefined) return err(faults.snapshot);
      return ok(undefined);
    },
    newChange: async () => ok(undefined),
    // The track service captures the head op pre-track and uses
    // `opRestore` as the canonical rollback for the describe/snapshot/new
    // triplet. Return a stable id so the test can assert the rollback path.
    opLog: async () =>
      ok([
        {
          id: "preTrack",
          parentId: null,
          kind: "edit",
          description: "head",
          at: "2024-01-01",
          filesTouched: [],
        },
      ]),
    log: async () => ok([]),
    opRestore: async ({ opId }) => {
      callsArr.push({ cmd: "opRestore", opId });
      return ok(undefined);
    },
    logAtOp: async () => ok(null),
    diffSummaryAtOp: async () => ok([]),
    diffAtOp: async () => ok(""),
    gitFetch: async () => ok(undefined),
    gitPush: async () => ok(undefined),
    status: async () =>
      ok({ lastSyncAt: null, ahead: 0, behind: 0, dirty: false, remote: null, conflicts: [] }),
    aheadBehind: async () => ok({ ahead: 0, behind: 0 }),
    listConflicts: async () => ok([]),
  };
  return Object.assign(repo, { calls: callsArr, callsArr });
}

type FaultMap<T> = Partial<Record<keyof T, () => Result<unknown, RepoError>>>;

function withFault<T extends object>(real: T, faults: FaultMap<T>): T {
  const proxy = { ...real } as Record<string | symbol, unknown>;
  for (const key of Object.keys(faults)) {
    const fault = faults[key as keyof T]!;
    const original = (real as unknown as Record<string, (...args: unknown[]) => unknown>)[key]!;
    let triggered = false;
    proxy[key] = async (...args: unknown[]) => {
      if (!triggered) {
        triggered = true;
        return fault();
      }
      return original.call(real, ...args);
    };
  }
  return proxy as T;
}

interface Harness {
  tmp: TmpDir;
  home: string;
  dotfilesRoot: string;
  backupRoot: string;
  fs: FsRepository;
  symlinks: SymlinkRepository;
  tracked: TrackedFileRepository;
  jj: FakeJj;
  service: TrackService;
}

async function makeHarness(opts: {
  fsFaults?: FaultMap<FsRepository>;
  symlinkFaults?: FaultMap<SymlinkRepository>;
  trackedFaults?: FaultMap<TrackedFileRepository>;
  backupSnapshotFault?: RepoError;
  jjFaults?: { describe?: RepoError; snapshot?: RepoError };
}): Promise<Harness> {
  const tmp = await makeTmpDir("ldf-track-");
  const home = tmp.path;
  const dotfilesRoot = join(home, "dotfiles");
  const backupRoot = join(home, ".dotfiles.bak");
  await mkdir(dotfilesRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });

  const realFs = createFsRepository();
  const realSymlinks = createSymlinkRepository();
  const realTracked = createTrackedFileRepository({ dotfilesRoot });
  const fs = opts.fsFaults ? withFault(realFs, opts.fsFaults) : realFs;
  const symlinks = opts.symlinkFaults ? withFault(realSymlinks, opts.symlinkFaults) : realSymlinks;
  const tracked = opts.trackedFaults ? withFault(realTracked, opts.trackedFaults) : realTracked;

  const realBackupRepo = createBackupRepository({ backupRoot });
  const backupRepo =
    opts.backupSnapshotFault !== undefined
      ? { ...realBackupRepo, snapshot: async () => err(opts.backupSnapshotFault!) }
      : realBackupRepo;
  const backups = createBackupService({ repo: backupRepo });
  const jj = fakeJj(opts.jjFaults);

  const service = createTrackService({
    home,
    dotfilesRoot,
    fs,
    symlinks,
    tracked,
    jj,
    backups,
    now: () => new Date("2026-05-01T16:30:42.123Z"),
  });

  return { tmp, home, dotfilesRoot, backupRoot, fs, symlinks, tracked, jj, service };
}

let h: Harness | undefined;

afterEach(async () => {
  if (h) {
    await h.tmp.cleanup();
    h = undefined;
  }
});

async function fileBytes(path: string): Promise<string | null> {
  const f = Bun.file(path);
  return (await f.exists()) ? f.text() : null;
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

describe("TrackService.add — validation", () => {
  test("A2: missing target → InvalidTarget(missing)", async () => {
    h = await makeHarness({});
    const r = await h.service.add(join(h.home, "nope"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("InvalidTarget");
    if (r.error.tag !== "InvalidTarget") return;
    expect(r.error.reason).toBe("missing");
  });

  test("A3: already-symlinked → InvalidTarget(already-symlinked)", async () => {
    h = await makeHarness({});
    const target = join(h.home, ".zshrc");
    const inside = join(h.dotfilesRoot, ".zshrc");
    await writeFile(inside, "x");
    await symlink(inside, target);
    const r = await h.service.add(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "InvalidTarget") return;
    expect(r.error.reason).toBe("already-symlinked");
  });

  test("A4: under-dotfiles → InvalidTarget(under-dotfiles)", async () => {
    h = await makeHarness({});
    const target = join(h.dotfilesRoot, "nested.conf");
    await writeFile(target, "x");
    const r = await h.service.add(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "InvalidTarget") return;
    expect(r.error.reason).toBe("under-dotfiles");
  });
});

describe("TrackService.add — happy path (A1)", () => {
  test("backup, source, symlink, jj describe, tracked entry", async () => {
    h = await makeHarness({});
    const target = join(h.home, ".zshrc");
    await writeFile(target, "alias g=jj\n", { mode: 0o600 });
    const r = await h.service.add(target);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).toBe(trackedFileId(target));
    expect(r.value.status).toBe("tracked");
    expect(r.value.addedAt).toBe("2026-05-01T16:30:42.123Z");

    // Source under dotfiles holds the bytes.
    expect(await fileBytes(join(h.dotfilesRoot, ".zshrc"))).toBe("alias g=jj\n");
    // Target is a symlink to the source.
    expect(await isSymlink(target)).toBe(true);
    expect(await readlink(target)).toBe(join(h.dotfilesRoot, ".zshrc"));
    // jj describe was invoked.
    expect(h.jj.calls.some((c) => c.cmd === "describe" && c.message === "track .zshrc")).toBe(true);
    // Tracked entry persisted.
    const stored = await h.tracked.read(r.value.id);
    expect(stored.ok).toBe(true);
    // Backup exists.
    const backups = await Bun.file(
      join(h.backupRoot, r.value.id, "20260501T163042123Z-add", "payload"),
    ).text();
    expect(backups).toBe("alias g=jj\n");
  });
});

describe("TrackService.add — rollback branches", () => {
  test("A5: snapshot fail → fs unchanged; Rollback{snapshot}", async () => {
    h = await makeHarness({
      backupSnapshotFault: { tag: "IoError", path: "/x", cause: new Error("boom") },
    });
    const target = join(h.home, ".zshrc");
    await writeFile(target, "x", { mode: 0o600 });
    const r = await h.service.add(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("snapshot");
    expect(await isSymlink(target)).toBe(false);
    expect(await fileBytes(target)).toBe("x");
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(false);
    expect(h.jj.calls.length).toBe(0);
  });

  test("A6: move fail → target restored, no source, no symlink", async () => {
    h = await makeHarness({
      fsFaults: {
        move: () => err({ tag: "IoError", path: "/x", cause: new Error("boom") }),
      },
    });
    const target = join(h.home, ".zshrc");
    await writeFile(target, "orig", { mode: 0o600 });
    const r = await h.service.add(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("move");
    expect(await fileBytes(target)).toBe("orig");
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(false);
    expect(await isSymlink(target)).toBe(false);
  });

  test("A7: symlink fail → source moved back, no symlink", async () => {
    h = await makeHarness({
      symlinkFaults: {
        materialize: () => err({ tag: "IoError", path: "/x", cause: new Error("boom") }),
      },
    });
    const target = join(h.home, ".zshrc");
    await writeFile(target, "orig", { mode: 0o600 });
    const r = await h.service.add(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("symlink");
    expect(await fileBytes(target)).toBe("orig");
    expect(await isSymlink(target)).toBe(false);
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(false);
  });

  test("A8: jj describe fail → unwound to original state", async () => {
    h = await makeHarness({
      jjFaults: { describe: { tag: "Spawn", command: ["jj"], exitCode: 1, stderr: "" } },
    });
    const target = join(h.home, ".zshrc");
    await writeFile(target, "orig", { mode: 0o600 });
    const r = await h.service.add(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("describe");
    expect(await fileBytes(target)).toBe("orig");
    expect(await isSymlink(target)).toBe(false);
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(false);
  });

  test("A9: record fail → unwound + jj op restore replayed", async () => {
    h = await makeHarness({
      trackedFaults: {
        upsert: () => err({ tag: "IoError", path: "/x", cause: new Error("boom") }),
      },
    });
    const target = join(h.home, ".zshrc");
    await writeFile(target, "orig", { mode: 0o600 });
    const r = await h.service.add(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("record");
    expect(await fileBytes(target)).toBe("orig");
    expect(await isSymlink(target)).toBe(false);
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(false);
    // Track only describes once (the real "track" message); the rollback
    // restores via jj op restore <preTrackOp>, not an empty describe.
    expect(h.jj.calls.filter((c) => c.cmd === "describe").length).toBe(1);
    const restores = h.jj.calls.filter((c) => c.cmd === "opRestore");
    expect(restores.length).toBe(1);
    expect(restores[0]?.opId).toBe("preTrack");
  });
});

describe("TrackService.remove — validation", () => {
  test("R2: target not LDF symlink → InvalidTarget(not-tracked-symlink)", async () => {
    h = await makeHarness({});
    const target = join(h.home, ".zshrc");
    await writeFile(target, "x");
    const r = await h.service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "InvalidTarget") return;
    expect(r.error.reason).toBe("not-tracked-symlink");
  });

  test("R3: no tracked entry → InvalidTarget(not-tracked-symlink)", async () => {
    h = await makeHarness({});
    // Create a symlink into dotfiles but no tracked-file index entry.
    const inside = join(h.dotfilesRoot, ".zshrc");
    await writeFile(inside, "x");
    const target = join(h.home, ".zshrc");
    await symlink(inside, target);
    const r = await h.service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "InvalidTarget") return;
    expect(r.error.reason).toBe("not-tracked-symlink");
  });
});

async function setupTracked(harness: Harness, content = "alias g=jj\n"): Promise<string> {
  const target = join(harness.home, ".zshrc");
  await writeFile(target, content, { mode: 0o600 });
  const added = await harness.service.add(target);
  expect(added.ok).toBe(true);
  return target;
}

describe("TrackService.remove — happy path (R1)", () => {
  test("target restored, source removed, backup written, status untracked", async () => {
    h = await makeHarness({});
    const target = await setupTracked(h);
    h.jj.callsArr.length = 0;
    const r = await h.service.remove(target);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("untracked");
    expect(await isSymlink(target)).toBe(false);
    expect(await fileBytes(target)).toBe("alias g=jj\n");
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(false);
    expect(h.jj.calls.some((c) => c.message === "untrack .zshrc")).toBe(true);
    const stored = await h.tracked.read(r.value.id);
    expect(stored.ok && stored.value.status).toBe("untracked");
  });
});

describe("TrackService.remove — rollback branches", () => {
  test("R4: snapshot fail → state unchanged", async () => {
    h = await makeHarness({});
    const target = await setupTracked(h);
    // Re-create harness with snapshot fault preserving the on-disk state.
    const home = h.home;
    const dotfilesRoot = h.dotfilesRoot;
    const backupRoot = h.backupRoot;
    const realBackupRepo = createBackupRepository({ backupRoot });
    const faulty = {
      ...realBackupRepo,
      snapshot: async () =>
        err<RepoError>({ tag: "IoError", path: "/x", cause: new Error("boom") }),
    };
    const trackedRepo = createTrackedFileRepository({ dotfilesRoot });
    const symlinks = createSymlinkRepository();
    const fs = createFsRepository();
    const jj = fakeJj();
    const service = createTrackService({
      home,
      dotfilesRoot,
      fs,
      symlinks,
      tracked: trackedRepo,
      jj,
      backups: createBackupService({ repo: faulty }),
      now: () => new Date("2026-05-01T16:30:42.123Z"),
    });
    const r = await service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("snapshot");
    expect(await isSymlink(target)).toBe(true);
    expect(await Bun.file(join(dotfilesRoot, ".zshrc")).exists()).toBe(true);
  });

  test("R5: unlink-symlink fail → state unchanged", async () => {
    h = await makeHarness({});
    const target = await setupTracked(h);
    h.jj.callsArr.length = 0;
    // Build a new harness reusing the on-disk state, with symlink unlink faulted.
    const realSymlinks = createSymlinkRepository();
    const symlinks = withFault(realSymlinks, {
      unlink: () => err({ tag: "IoError", path: target, cause: new Error("boom") }),
    });
    const service = createTrackService({
      home: h.home,
      dotfilesRoot: h.dotfilesRoot,
      fs: h.fs,
      symlinks,
      tracked: h.tracked,
      jj: h.jj,
      backups: createBackupService({
        repo: createBackupRepository({ backupRoot: h.backupRoot }),
      }),
      now: () => new Date("2026-05-01T16:30:42.124Z"),
    });
    const r = await service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("unlink-symlink");
    expect(await isSymlink(target)).toBe(true);
  });

  test("R6: copy fail → symlink restored, source intact", async () => {
    h = await makeHarness({});
    const target = await setupTracked(h);
    const realFs = createFsRepository();
    const fs = withFault(realFs, {
      copyFile: () => err({ tag: "IoError", path: "/x", cause: new Error("boom") }),
    });
    const service = createTrackService({
      home: h.home,
      dotfilesRoot: h.dotfilesRoot,
      fs,
      symlinks: h.symlinks,
      tracked: h.tracked,
      jj: h.jj,
      backups: createBackupService({
        repo: createBackupRepository({ backupRoot: h.backupRoot }),
      }),
      now: () => new Date("2026-05-01T16:30:42.125Z"),
    });
    const r = await service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("materialize");
    expect(await isSymlink(target)).toBe(true);
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(true);
  });

  test("R7: remove source fail → target restored to symlink, source intact", async () => {
    h = await makeHarness({});
    const target = await setupTracked(h);
    const realFs = createFsRepository();
    const fs = withFault(realFs, {
      removeFile: () => err({ tag: "IoError", path: "/x", cause: new Error("boom") }),
    });
    const service = createTrackService({
      home: h.home,
      dotfilesRoot: h.dotfilesRoot,
      fs,
      symlinks: h.symlinks,
      tracked: h.tracked,
      jj: h.jj,
      backups: createBackupService({
        repo: createBackupRepository({ backupRoot: h.backupRoot }),
      }),
      now: () => new Date("2026-05-01T16:30:42.126Z"),
    });
    const r = await service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("unlink-source");
    expect(await isSymlink(target)).toBe(true);
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(true);
  });

  test("R8: jj describe fail → fully restored", async () => {
    h = await makeHarness({});
    const target = await setupTracked(h);
    h.jj.callsArr.length = 0;
    const faultyJj = fakeJj({
      describe: { tag: "Spawn", command: ["jj"], exitCode: 1, stderr: "" },
    });
    const service = createTrackService({
      home: h.home,
      dotfilesRoot: h.dotfilesRoot,
      fs: h.fs,
      symlinks: h.symlinks,
      tracked: h.tracked,
      jj: faultyJj,
      backups: createBackupService({
        repo: createBackupRepository({ backupRoot: h.backupRoot }),
      }),
      now: () => new Date("2026-05-01T16:30:42.127Z"),
    });
    const r = await service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("describe");
    expect(await isSymlink(target)).toBe(true);
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(true);
  });

  test("R9: tracked.upsert fail → fully restored, status reverted", async () => {
    h = await makeHarness({});
    const target = await setupTracked(h);
    const realTracked = createTrackedFileRepository({ dotfilesRoot: h.dotfilesRoot });
    // Fault only the second upsert (the status flip), allow revert.
    let calls = 0;
    const tracked: TrackedFileRepository = {
      ...realTracked,
      upsert: async (file) => {
        calls++;
        if (calls === 1) {
          return err({ tag: "IoError", path: "/x", cause: new Error("boom") });
        }
        return realTracked.upsert(file);
      },
    };
    const service = createTrackService({
      home: h.home,
      dotfilesRoot: h.dotfilesRoot,
      fs: h.fs,
      symlinks: h.symlinks,
      tracked,
      jj: h.jj,
      backups: createBackupService({
        repo: createBackupRepository({ backupRoot: h.backupRoot }),
      }),
      now: () => new Date("2026-05-01T16:30:42.128Z"),
    });
    const r = await service.remove(target);
    expect(r.ok).toBe(false);
    if (r.ok || r.error.tag !== "Rollback") return;
    expect(r.error.failedStep).toBe("record");
    expect(await isSymlink(target)).toBe(true);
    expect(await Bun.file(join(h.dotfilesRoot, ".zshrc")).exists()).toBe(true);
    const stored = await realTracked.read(trackedFileId(target));
    expect(stored.ok && stored.value.status).toBe("tracked");
  });
});
