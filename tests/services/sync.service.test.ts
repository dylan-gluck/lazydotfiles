import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SyncState } from "../../src/domain/repo";
import { err, ok } from "../../src/lib/result";
import type { JjRepository } from "../../src/repositories/jj.repository";
import type { RepoError } from "../../src/repositories/types";
import type { EditorRunner } from "../../src/services/sync.editor";
import { createSyncService } from "../../src/services/sync.service";

interface FakeOpts {
  status?: SyncState;
  aheadBehind?: { ahead: number; behind: number };
  conflicts?: readonly string[];
  fetchErr?: RepoError;
  pushErr?: RepoError;
}

interface FakeCalls {
  fetch: number;
  push: number;
  snapshot: number;
  bookmarkSet: number;
}

function fakeJj(opts: FakeOpts, calls: FakeCalls): JjRepository {
  const baseStatus: SyncState = opts.status ?? {
    lastSyncAt: null,
    ahead: 0,
    behind: 0,
    dirty: false,
    remote: "origin",
    conflicts: [],
  };
  return {
    kind: "JjRepository",
    isRepo: async () => ok(true),
    initColocated: async () => ok(undefined),
    describe: async () => ok(undefined),
    snapshot: async () => {
      calls.snapshot++;
      return ok(undefined);
    },
    newChange: async () => ok(undefined),
    opLog: async () => ok([]),
    log: async () => ok([]),
    opRestore: async () => ok(undefined),
    logAtOp: async () => ok(null),
    diffSummaryAtOp: async () => ok([]),
    diffAtOp: async () => ok(""),
    status: async () => ok(baseStatus),
    aheadBehind: async () => ok(opts.aheadBehind ?? { ahead: 0, behind: 0 }),
    listConflicts: async () => ok(opts.conflicts ?? []),
    gitFetch: async () => {
      calls.fetch++;
      return opts.fetchErr ? err(opts.fetchErr) : ok(undefined);
    },
    gitPush: async () => {
      calls.push++;
      return opts.pushErr ? err(opts.pushErr) : ok(undefined);
    },
    gitRemoteSet: async () => ok(undefined),
    gitRemoteList: async () => ok([]),
    bookmarkSet: async () => {
      calls.bookmarkSet++;
      return ok(undefined);
    },
  };
}

const editor: EditorRunner = {
  run: async () => ok(undefined),
};

const NOW = new Date("2026-05-01T12:00:00Z");

describe("syncService.state", () => {
  test("merges status, aheadBehind, listConflicts into SyncState", async () => {
    const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
    const svc = createSyncService({
      jj: fakeJj({ aheadBehind: { ahead: 3, behind: 1 }, conflicts: [".zshrc"] }, calls),
      root: "/d",
      editor,
      now: () => NOW,
    });
    const r = await svc.state();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.ahead).toBe(3);
    expect(r.value.behind).toBe(1);
    expect(r.value.conflicts).toEqual([{ path: ".zshrc", kind: "ours" }]);
  });
});

describe("syncService.fetch", () => {
  test("ok stamps lastSyncAt with injected now()", async () => {
    const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
    const svc = createSyncService({ jj: fakeJj({}, calls), root: "/d", editor, now: () => NOW });
    const r = await svc.fetch();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.state.lastSyncAt).toBe(NOW.toISOString());
    expect(calls.fetch).toBe(1);
    expect(calls.push).toBe(0);
  });

  test("fetch error bubbles as Repository and does not call push", async () => {
    const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
    const svc = createSyncService({
      jj: fakeJj(
        {
          fetchErr: { tag: "Spawn", command: ["jj", "git", "fetch"], exitCode: 1, stderr: "x" },
        },
        calls,
      ),
      root: "/d",
      editor,
      now: () => NOW,
    });
    const r = await svc.fetch();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
    expect(calls.push).toBe(0);
  });
});

describe("syncService.sync", () => {
  test("runs fetch then push when no conflicts", async () => {
    const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
    const svc = createSyncService({ jj: fakeJj({}, calls), root: "/d", editor, now: () => NOW });
    const r = await svc.sync();
    expect(r.ok).toBe(true);
    expect(calls.fetch).toBe(1);
    expect(calls.push).toBe(1);
  });

  test("skips push when fetch produced conflicts", async () => {
    const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
    const svc = createSyncService({
      jj: fakeJj({ conflicts: [".zshrc"] }, calls),
      root: "/d",
      editor,
      now: () => NOW,
    });
    const r = await svc.sync();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.conflicts.length).toBe(1);
    expect(calls.push).toBe(0);
  });

  test("does not call push when fetch fails", async () => {
    const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
    const svc = createSyncService({
      jj: fakeJj(
        {
          fetchErr: { tag: "Spawn", command: ["jj", "git", "fetch"], exitCode: 1, stderr: "x" },
        },
        calls,
      ),
      root: "/d",
      editor,
      now: () => NOW,
    });
    const r = await svc.sync();
    expect(r.ok).toBe(false);
    expect(calls.push).toBe(0);
  });
});

describe("syncService.resolve", () => {
  test("ours rewrites file picking ours side and snapshots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ldf-sync-"));
    try {
      const target = join(dir, "f.txt");
      await Bun.write(
        target,
        ["a", "<<<<<<< ours", "OURS", "=======", "THEIRS", ">>>>>>> theirs", "z"].join("\n"),
      );
      const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
      const svc = createSyncService({ jj: fakeJj({}, calls), root: dir, editor, now: () => NOW });
      const r = await svc.resolve({ path: "f.txt", choice: "ours" });
      expect(r.ok).toBe(true);
      const text = await Bun.file(target).text();
      expect(text).toBe(["a", "OURS", "z"].join("\n"));
      expect(calls.snapshot).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("theirs picks the theirs side", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ldf-sync-"));
    try {
      const target = join(dir, "f.txt");
      await Bun.write(
        target,
        ["a", "<<<<<<< ours", "OURS", "=======", "THEIRS", ">>>>>>> theirs", "z"].join("\n"),
      );
      const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
      const svc = createSyncService({ jj: fakeJj({}, calls), root: dir, editor, now: () => NOW });
      const r = await svc.resolve({ path: "f.txt", choice: "theirs" });
      expect(r.ok).toBe(true);
      const text = await Bun.file(target).text();
      expect(text).toBe(["a", "THEIRS", "z"].join("\n"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("edit invokes editor.run with absolute path", async () => {
    const calls = { fetch: 0, push: 0, snapshot: 0, bookmarkSet: 0 };
    const invoked: { value: string | null } = { value: null };
    const ed: EditorRunner = {
      run: async (p) => {
        invoked.value = p;
        return ok(undefined);
      },
    };
    const svc = createSyncService({
      jj: fakeJj({}, calls),
      root: "/d",
      editor: ed,
      now: () => NOW,
    });
    const r = await svc.resolve({ path: "sub/file.txt", choice: "edit" });
    expect(r.ok).toBe(true);
    expect(invoked.value).toBe("/d/sub/file.txt");
    expect(calls.snapshot).toBe(1);
  });
});
