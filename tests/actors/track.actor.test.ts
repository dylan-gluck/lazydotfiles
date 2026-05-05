import { describe, expect, test } from "bun:test";
import type { Services } from "../../src/composition/services";
import type { TrackedFile } from "../../src/domain/tracked-file";
import { err, ok } from "../../src/lib/result";
import type { TrackService } from "../../src/services/track.service";
import { initialRepoState, REPO_ACTOR_ID, repoReducer } from "../../src/actors/repo.actor";
import { createActorRuntime } from "../../src/actors/runtime";
import {
  initialTrackState,
  spawnTrackActor,
  TRACK_ACTOR_ID,
  trackReducer,
  type TrackEvent,
  type TrackMessage,
  type TrackState,
} from "../../src/actors/track.actor";

const file: TrackedFile = {
  id: "abc",
  source: "/d/.zshrc",
  target: "/h/.zshrc",
  kind: "file",
  addedAt: "2026-05-01T16:30:42.123Z",
  status: "tracked",
};

describe("trackReducer", () => {
  test("add from idle: inFlight set, no events, one effect", () => {
    const out = trackReducer(initialTrackState, {
      kind: "add",
      payload: { path: "/h/.zshrc" },
    });
    expect(out.state.inFlight).toEqual({ kind: "add", path: "/h/.zshrc" });
    expect(out.events).toEqual([]);
    expect(out.effects).toHaveLength(1);
  });

  test("add while inFlight queues, no event, no effect", () => {
    const busy: TrackState = {
      inFlight: { kind: "add", path: "/x" },
      pending: [],
      lastError: null,
    };
    const out = trackReducer(busy, { kind: "add", payload: { path: "/y" } });
    expect(out.state.inFlight).toEqual({ kind: "add", path: "/x" });
    expect(out.state.pending).toEqual([{ kind: "add", path: "/y" }]);
    expect(out.events).toEqual([]);
    expect(out.effects).toEqual([]);
  });

  test("addOk drains the queue: emits tracked + dispatches next effect", () => {
    const queued: TrackState = {
      inFlight: { kind: "add", path: "/h/.zshrc" },
      pending: [{ kind: "add", path: "/h/.config/git/config" }],
      lastError: null,
    };
    const out = trackReducer(queued, { kind: "addOk", payload: { file } });
    expect(out.state.inFlight).toEqual({ kind: "add", path: "/h/.config/git/config" });
    expect(out.state.pending).toEqual([]);
    expect(out.events.map((e) => e.kind)).toEqual(["tracked"]);
    expect(out.effects).toHaveLength(1);
  });

  test("addOk clears inFlight when queue is empty", () => {
    const out = trackReducer(
      { inFlight: { kind: "add", path: "/h/.zshrc" }, pending: [], lastError: null },
      { kind: "addOk", payload: { file } },
    );
    expect(out.state.inFlight).toBeNull();
    expect(out.state.pending).toEqual([]);
    expect(out.events.map((e) => e.kind)).toEqual(["tracked"]);
    expect(out.effects).toEqual([]);
  });

  test("addFailed records error and emits addFailed", () => {
    const out = trackReducer(
      { inFlight: { kind: "add", path: "/h/.zshrc" }, pending: [], lastError: null },
      {
        kind: "addFailed",
        payload: { path: "/h/.zshrc", error: { tag: "NotFound", resource: "x", id: "y" } },
      },
    );
    expect(out.state.inFlight).toBeNull();
    expect(out.state.lastError?.tag).toBe("NotFound");
    expect(out.events.map((e) => e.kind)).toEqual(["addFailed"]);
  });

  test("remove → removeOk emits untracked", () => {
    const a = trackReducer(initialTrackState, { kind: "remove", payload: { path: "/h/.zshrc" } });
    expect(a.state.inFlight?.kind).toBe("remove");
    const b = trackReducer(a.state, { kind: "removeOk", payload: { file } });
    expect(b.state.inFlight).toBeNull();
    expect(b.events.map((e) => e.kind)).toEqual(["untracked"]);
  });

  test("removeFailed emits removeFailed", () => {
    const out = trackReducer(
      { inFlight: { kind: "remove", path: "/x" }, pending: [], lastError: null },
      {
        kind: "removeFailed",
        payload: { path: "/x", error: { tag: "NotFound", resource: "a", id: "b" } },
      },
    );
    expect(out.events.map((e) => e.kind)).toEqual(["removeFailed"]);
  });
});

describe("trackActor effect dispatch", () => {
  test("send(add) drives actor to idle and emits tracked", async () => {
    const fakeTrack: TrackService = {
      add: async () => ok(file),
      remove: async () => ok(file),
    };
    const services = { track: fakeTrack } as unknown as Services;
    const runtime = createActorRuntime({ services });
    runtime.spawn({ id: REPO_ACTOR_ID, initial: initialRepoState, reducer: repoReducer });
    spawnTrackActor(runtime);
    const actor = runtime.get<TrackState, TrackMessage, TrackEvent>(TRACK_ACTOR_ID);
    const events: string[] = [];
    runtime.on<TrackEvent>("tracked", () => events.push("tracked"));
    actor.send({ kind: "add", payload: { path: "/h/.zshrc" } });
    for (let i = 0; i < 20 && actor.getState().inFlight !== null; i++) {
      await Promise.resolve();
    }
    expect(actor.getState().inFlight).toBeNull();
    expect(events).toEqual(["tracked"]);
    runtime.dispose();
  });

  test("add failure routes to addFailed event with error", async () => {
    const fakeTrack: TrackService = {
      add: async () => err({ tag: "InvalidTarget", reason: "missing", path: "/x" }),
      remove: async () => ok(file),
    };
    const services = { track: fakeTrack } as unknown as Services;
    const runtime = createActorRuntime({ services });
    runtime.spawn({ id: REPO_ACTOR_ID, initial: initialRepoState, reducer: repoReducer });
    spawnTrackActor(runtime);
    const actor = runtime.get<TrackState, TrackMessage, TrackEvent>(TRACK_ACTOR_ID);
    const events: string[] = [];
    runtime.on<TrackEvent>("addFailed", () => events.push("addFailed"));
    actor.send({ kind: "add", payload: { path: "/x" } });
    for (let i = 0; i < 20 && actor.getState().inFlight !== null; i++) {
      await Promise.resolve();
    }
    expect(actor.getState().lastError?.tag).toBe("InvalidTarget");
    expect(events).toEqual(["addFailed"]);
    runtime.dispose();
  });
});
