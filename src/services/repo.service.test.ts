import { describe, expect, test } from "bun:test";
import type { Operation, SyncState } from "../domain/repo";
import { makeTrackedFile, type TrackedFile } from "../domain/tracked-file";
import { err, ok, type Result } from "../lib/result";
import type { JjRepository } from "../repositories/jj.repository";
import type { TrackedFileRepository } from "../repositories/tracked-file.repository";
import type { RepoError } from "../repositories/types";
import { createRepoService } from "./repo.service";

interface FakeOpts {
  ops?: readonly Operation[];
  status?: SyncState;
  tracked?: readonly TrackedFile[];
  failOpLog?: RepoError;
  failStatus?: RepoError;
}

interface FakeState {
  restored: string[];
}

function fakeJj(opts: FakeOpts, state: FakeState): JjRepository {
  return {
    kind: "JjRepository",
    isRepo: async () => ok(false),
    initColocated: async () => ok(undefined),
    describe: async () => ok(undefined),
    snapshot: async () => ok(undefined),
    newChange: async () => ok(undefined),
    log: async () => ok([]),
    gitFetch: async () => ok(undefined),
    gitPush: async () => ok(undefined),
    opLog: async ({ limit }): Promise<Result<readonly Operation[], RepoError>> => {
      if (opts.failOpLog) return err(opts.failOpLog);
      const all = opts.ops ?? [];
      const sliced = limit === undefined ? all : all.slice(0, limit);
      return ok(sliced);
    },
    status: async (): Promise<Result<SyncState, RepoError>> => {
      if (opts.failStatus) return err(opts.failStatus);
      return ok(
        opts.status ?? { lastSyncAt: null, ahead: 0, behind: 0, dirty: false, remote: null },
      );
    },
    opRestore: async ({ opId }) => {
      state.restored.push(opId);
      return ok(undefined);
    },
  };
}

function fakeTracked(opts: FakeOpts): TrackedFileRepository {
  const map = new Map<string, TrackedFile>();
  for (const tf of opts.tracked ?? []) map.set(tf.id, tf);
  return {
    kind: "TrackedFileRepository",
    list: async () => ok(Array.from(map.values())),
    read: async (id) => {
      const got = map.get(id);
      return got === undefined ? err({ tag: "NotFound", path: id }) : ok(got);
    },
    upsert: async (file) => {
      map.set(file.id, file);
      return ok(undefined);
    },
    remove: async (id) => {
      map.delete(id);
      return ok(undefined);
    },
  };
}

const ROOT = "/tmp/dotfiles";
const op = (i: number, kind: Operation["kind"] = "edit"): Operation => ({
  id: `op${i}`,
  parentId: i === 0 ? null : `op${i - 1}`,
  kind,
  description: `desc ${i}`,
  at: `2026-05-01T00:00:0${i}Z`,
  filesTouched: [],
});

describe("repoService", () => {
  test("head() returns the first op when the log is non-empty", async () => {
    const state = { restored: [] as string[] };
    const svc = createRepoService({
      jj: fakeJj({ ops: [op(2, "track"), op(1)] }, state),
      tracked: fakeTracked({}),
      root: ROOT,
    });
    const r = await svc.head();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).toBe("op2");
  });

  test("head() returns NotFound on empty op log", async () => {
    const state = { restored: [] };
    const svc = createRepoService({
      jj: fakeJj({ ops: [] }, state),
      tracked: fakeTracked({}),
      root: ROOT,
    });
    const r = await svc.head();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("NotFound");
  });

  test("operations({limit}) forwards limit to the repository", async () => {
    const state = { restored: [] };
    const svc = createRepoService({
      jj: fakeJj({ ops: [op(3), op(2), op(1)] }, state),
      tracked: fakeTracked({}),
      root: ROOT,
    });
    const r = await svc.operations({ limit: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(2);
  });

  test("dirty() reflects status.dirty", async () => {
    const state = { restored: [] };
    const svc = createRepoService({
      jj: fakeJj(
        { status: { lastSyncAt: null, ahead: 0, behind: 0, dirty: true, remote: null } },
        state,
      ),
      tracked: fakeTracked({}),
      root: ROOT,
    });
    const r = await svc.dirty();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(true);
  });

  test("syncState() lifts RepoError to ServiceError.Repository", async () => {
    const state = { restored: [] };
    const svc = createRepoService({
      jj: fakeJj(
        { failStatus: { tag: "Spawn", command: ["jj", "status"], exitCode: 1, stderr: "x" } },
        state,
      ),
      tracked: fakeTracked({}),
      root: ROOT,
    });
    const r = await svc.syncState();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
  });

  test("restoreOp forwards opId to the underlying repo", async () => {
    const state = { restored: [] as string[] };
    const svc = createRepoService({ jj: fakeJj({}, state), tracked: fakeTracked({}), root: ROOT });
    await svc.restoreOp("abc");
    expect(state.restored).toEqual(["abc"]);
  });

  test("trackedFiles() returns the union of upserts", async () => {
    const tf = makeTrackedFile({
      source: "/d/.zshrc",
      target: "/h/.zshrc",
      kind: "file",
      addedAt: "x",
    });
    const tracked = fakeTracked({ tracked: [tf] });
    const state = { restored: [] };
    const svc = createRepoService({ jj: fakeJj({}, state), tracked, root: ROOT });
    const r = await svc.trackedFiles();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual([tf]);
  });
});
