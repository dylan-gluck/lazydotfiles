import { describe, expect, test } from "bun:test";
import type { Operation } from "../../src/domain/repo";
import type { Services } from "../../src/composition/services";
import { ok } from "../../src/lib/result";
import type { RepoService } from "../../src/services/repo.service";
import {
  initialRepoState,
  repoReducer,
  type RepoEvent,
  type RepoMessage,
  type RepoState,
  spawnRepoActor,
  REPO_ACTOR_ID,
} from "../../src/actors/repo.actor";
import { createActorRuntime } from "../../src/actors/runtime";

const op = (i: number): Operation => ({
  id: `op${i}`,
  parentId: i === 0 ? null : `op${i - 1}`,
  kind: "edit",
  description: `d${i}`,
  at: `2026-05-01T00:00:0${i}Z`,
  filesTouched: [],
});

describe("repoReducer", () => {
  test("refresh transitions to loading and dispatches one effect", () => {
    const out = repoReducer(initialRepoState, { kind: "refresh", payload: undefined });
    expect(out.state.status).toBe("loading");
    expect(out.events).toEqual([]);
    expect(out.effects).toHaveLength(1);
  });

  test("refreshOk emits operationsLoaded + repoDirtyChanged when dirty flips", () => {
    const out = repoReducer(initialRepoState, {
      kind: "refreshOk",
      payload: { tracked: [], operations: [op(1)], dirty: true },
    });
    expect(out.state.status).toBe("ready");
    expect(out.state.dirty).toBe(true);
    expect(out.events.map((e) => e.kind)).toEqual(["operationsLoaded", "repoDirtyChanged"]);
  });

  test("refreshOk emits only operationsLoaded when dirty is unchanged", () => {
    const out = repoReducer(initialRepoState, {
      kind: "refreshOk",
      payload: { tracked: [], operations: [], dirty: false },
    });
    expect(out.events.map((e) => e.kind)).toEqual(["operationsLoaded"]);
  });

  test("refreshFailed records the error without emitting events", () => {
    const out = repoReducer(initialRepoState, {
      kind: "refreshFailed",
      payload: { error: { tag: "NotFound", resource: "x", id: "y" } },
    });
    expect(out.state.status).toBe("error");
    expect(out.state.error).not.toBeNull();
    expect(out.events).toEqual([]);
  });

  test("restoreToOp while idle sets restoring={kind:'op'} and dispatches one effect", () => {
    const out = repoReducer(initialRepoState, {
      kind: "restoreToOp",
      payload: { opId: "opX" },
    });
    expect(out.state.restoring).toEqual({ kind: "op" });
    expect(out.effects).toHaveLength(1);
  });

  test("restoreToOp while already restoring is dropped", () => {
    const out = repoReducer(
      { ...initialRepoState, restoring: { kind: "backup" } },
      { kind: "restoreToOp", payload: { opId: "opX" } },
    );
    expect(out.state.restoring).toEqual({ kind: "backup" });
    expect(out.effects).toEqual([]);
  });

  test("restoreOk emits 'restored' and chains a refresh effect", () => {
    const out = repoReducer(
      { ...initialRepoState, restoring: { kind: "op" } },
      { kind: "restoreOk", payload: { kind: "op" } },
    );
    expect(out.state.restoring).toBeNull();
    expect(out.events.map((e) => e.kind)).toEqual(["restored"]);
    expect(out.effects).toHaveLength(1);
  });

  test("restoreFailed records error, emits 'restoreFailed', clears restoring", () => {
    const out = repoReducer(
      { ...initialRepoState, restoring: { kind: "op" } },
      {
        kind: "restoreFailed",
        payload: { error: { tag: "NotFound", resource: "x", id: "y" } },
      },
    );
    expect(out.state.restoring).toBeNull();
    expect(out.state.error).not.toBeNull();
    expect(out.events.map((e) => e.kind)).toEqual(["restoreFailed"]);
  });
});

describe("repoActor (effect)", () => {
  test("send(refresh) eventually moves the actor to ready with the fake's data", async () => {
    const ops: Operation[] = [op(2), op(1)];
    const fakeRepo: RepoService = {
      head: async () => ok(ops[0]!),
      operations: async () => ok(ops),
      syncState: async () =>
        ok({ lastSyncAt: null, ahead: 0, behind: 0, dirty: true, remote: null, conflicts: [] }),
      dirty: async () => ok(true),
      restoreOp: async () => ok(undefined),
      trackedFiles: async () => ok([]),
      setRemote: async () => ok(undefined),
    };
    const services = {
      home: "/h",
      config: {},
      bootstrap: {},
      repo: fakeRepo,
      restore: {
        restoreToOp: async () => ok({ rematerialized: [] }),
        restoreFromBackup: async () =>
          ok({
            id: "x",
            trackedFileId: "x",
            snapshotPath: "/p",
            createdAt: "2026-05-01T00:00:00Z",
            trigger: "restore" as const,
          }),
      },
    } as unknown as Services;
    const runtime = createActorRuntime({ services });
    spawnRepoActor(runtime);
    const actor = runtime.get<RepoState, RepoMessage, RepoEvent>(REPO_ACTOR_ID);

    const events: string[] = [];
    runtime.on<RepoEvent>("operationsLoaded", () => events.push("operationsLoaded"));
    runtime.on<RepoEvent>("repoDirtyChanged", () => events.push("repoDirtyChanged"));

    actor.send({ kind: "refresh", payload: undefined });
    // Drain microtasks until the actor reports ready.
    for (let i = 0; i < 20 && actor.getState().status !== "ready"; i++) {
      await Promise.resolve();
    }
    expect(actor.getState().status).toBe("ready");
    expect(actor.getState().operations).toHaveLength(2);
    expect(actor.getState().dirty).toBe(true);
    expect(events).toContain("operationsLoaded");
    expect(events).toContain("repoDirtyChanged");
    runtime.dispose();
  });

  test("send(restoreToOp) emits 'restored' and chains a refresh", async () => {
    const fakeRepo: RepoService = {
      head: async () => ok(op(0)),
      operations: async () => ok([]),
      syncState: async () =>
        ok({ lastSyncAt: null, ahead: 0, behind: 0, dirty: false, remote: null, conflicts: [] }),
      dirty: async () => ok(false),
      restoreOp: async () => ok(undefined),
      trackedFiles: async () => ok([]),
      setRemote: async () => ok(undefined),
    };
    const fakeRestore = {
      restoreToOp: async () => ok({ rematerialized: [] }),
      restoreFromBackup: async () =>
        ok({
          id: "x",
          trackedFileId: "x",
          snapshotPath: "/p",
          createdAt: "2026-05-01T00:00:00Z",
          trigger: "restore" as const,
        }),
    };
    const services = {
      home: "/h",
      repo: fakeRepo,
      restore: fakeRestore,
    } as unknown as Services;
    const runtime = createActorRuntime({ services });
    spawnRepoActor(runtime);
    const actor = runtime.get<RepoState, RepoMessage, RepoEvent>(REPO_ACTOR_ID);
    const events: string[] = [];
    runtime.on<RepoEvent>("restored", () => events.push("restored"));
    runtime.on<RepoEvent>("operationsLoaded", () => events.push("operationsLoaded"));
    actor.send({ kind: "restoreToOp", payload: { opId: "opX" } });
    for (let i = 0; i < 30 && actor.getState().status !== "ready"; i++) {
      await Promise.resolve();
    }
    expect(actor.getState().status).toBe("ready");
    expect(actor.getState().restoring).toBeNull();
    expect(events).toContain("restored");
    expect(events).toContain("operationsLoaded");
    runtime.dispose();
  });
});
