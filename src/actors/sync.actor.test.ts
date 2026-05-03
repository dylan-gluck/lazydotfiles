import { describe, expect, test } from "bun:test";
import type { Services } from "../composition/services";
import type { ConflictDescriptor, SyncState } from "../domain/repo";
import { ok } from "../lib/result";
import type { SyncScheduler } from "../services/sync.scheduler";
import type { SyncOutcome, SyncService } from "../services/sync.service";
import {
  cleanState,
  initialSyncState,
  makeSyncReducer,
  spawnSyncActor,
  SYNC_ACTOR_ID,
  type SyncActorState,
  type SyncEvent,
  type SyncMessage,
} from "./sync.actor";
import { createActorRuntime } from "./runtime";

const fakeScheduler = (): SyncScheduler => {
  let running = false;
  return {
    start() {
      running = true;
    },
    stop() {
      running = false;
    },
    isRunning: () => running,
  };
};

const noopReducer = makeSyncReducer(fakeScheduler(), () => {});

describe("syncReducer", () => {
  test("runFetch transitions to fetching, emits syncStarted", () => {
    const out = noopReducer(initialSyncState, { kind: "runFetch", payload: undefined });
    expect(out.state.phase).toBe("fetching");
    expect(out.events.map((e) => e.kind)).toEqual(["syncStarted"]);
    expect(out.effects).toHaveLength(1);
  });

  test("runFetch while fetching is dropped", () => {
    const out = noopReducer(
      { ...initialSyncState, phase: "fetching" },
      { kind: "runFetch", payload: undefined },
    );
    expect(out.effects).toEqual([]);
    expect(out.events).toEqual([]);
  });

  test("opOk{phase:fetching} returns to idle and emits syncCompleted", () => {
    const next: SyncState = { ...cleanState, ahead: 1 };
    const out = noopReducer(
      { ...initialSyncState, phase: "fetching" },
      { kind: "opOk", payload: { phase: "fetching", state: next } },
    );
    expect(out.state.phase).toBe("idle");
    expect(out.state.state.ahead).toBe(1);
    expect(out.events.map((e) => e.kind)).toEqual(["syncCompleted"]);
  });

  test("opOk with non-empty conflicts emits both syncCompleted and syncConflict", () => {
    const conflicts: ConflictDescriptor[] = [{ path: ".zshrc", kind: "ours" }];
    const next: SyncState = { ...cleanState, conflicts };
    const out = noopReducer(
      { ...initialSyncState, phase: "syncing" },
      { kind: "opOk", payload: { phase: "syncing", state: next } },
    );
    expect(out.events.map((e) => e.kind)).toEqual(["syncCompleted", "syncConflict"]);
    expect(out.state.conflicts).toEqual(conflicts);
  });

  test("opOk{phase:refreshing} updates state without emitting syncCompleted", () => {
    const next: SyncState = { ...cleanState, ahead: 5 };
    const out = noopReducer(
      { ...initialSyncState, phase: "refreshing" },
      { kind: "opOk", payload: { phase: "refreshing", state: next } },
    );
    expect(out.state.phase).toBe("idle");
    expect(out.state.state.ahead).toBe(5);
    expect(out.events).toEqual([]);
  });

  test("opFailed transitions to error and emits syncFailed", () => {
    const out = noopReducer(
      { ...initialSyncState, phase: "fetching" },
      {
        kind: "opFailed",
        payload: {
          phase: "fetching",
          error: { tag: "Repository", cause: { tag: "IoError", path: "/", cause: "x" } },
        },
      },
    );
    expect(out.state.phase).toBe("error");
    expect(out.state.error).not.toBeNull();
    expect(out.events.map((e) => e.kind)).toEqual(["syncFailed"]);
  });

  test("cancel from fetching returns to idle", () => {
    const out = noopReducer(
      { ...initialSyncState, phase: "fetching" },
      { kind: "cancel", payload: undefined },
    );
    expect(out.state.phase).toBe("idle");
  });

  test("scheduleStart calls scheduler.start and tracks interval", () => {
    const sched = fakeScheduler();
    const r = makeSyncReducer(sched, () => {});
    const out = r(initialSyncState, { kind: "scheduleStart", payload: { interval: "hourly" } });
    expect(sched.isRunning()).toBe(true);
    expect(out.state.schedule).toEqual({ running: true, interval: "hourly" });
  });

  test("scheduleStop clears schedule", () => {
    const sched = fakeScheduler();
    const r = makeSyncReducer(sched, () => {});
    const before = r(initialSyncState, { kind: "scheduleStart", payload: { interval: "daily" } });
    const after = r(before.state, { kind: "scheduleStop", payload: undefined });
    expect(sched.isRunning()).toBe(false);
    expect(after.state.schedule).toEqual({ running: false, interval: null });
  });
});

describe("syncActor (effect)", () => {
  test("runFetch eventually returns to idle with the fake's state", async () => {
    const next: SyncState = { ...cleanState, ahead: 7 };
    const fakeSync: SyncService = {
      state: async () => ok(cleanState),
      fetch: async () => ok({ state: next, conflicts: next.conflicts } satisfies SyncOutcome),
      push: async () => ok({ state: cleanState, conflicts: [] }),
      sync: async () => ok({ state: cleanState, conflicts: [] }),
      resolve: async () => ok({ state: cleanState, conflicts: [] }),
    };
    const services = { sync: fakeSync } as unknown as Services;
    const runtime = createActorRuntime({ services });
    spawnSyncActor(runtime, { scheduler: fakeScheduler() });
    const actor = runtime.get<SyncActorState, SyncMessage, SyncEvent>(SYNC_ACTOR_ID);
    const events: string[] = [];
    runtime.on<SyncEvent>("syncStarted", () => events.push("syncStarted"));
    runtime.on<SyncEvent>("syncCompleted", () => events.push("syncCompleted"));
    actor.send({ kind: "runFetch", payload: undefined });
    for (let i = 0; i < 30 && actor.getState().phase !== "idle"; i++) {
      await Promise.resolve();
    }
    expect(actor.getState().phase).toBe("idle");
    expect(actor.getState().state.ahead).toBe(7);
    expect(events).toEqual(["syncStarted", "syncCompleted"]);
    runtime.dispose();
  });
});
