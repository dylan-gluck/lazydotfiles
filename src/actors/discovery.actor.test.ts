import { describe, expect, test } from "bun:test";
import { makeCandidate } from "../domain/candidate";
import type { Services } from "../composition/services";
import { ok } from "../lib/result";
import type { DiscoveryService } from "../services/discovery.service";
import {
  DISCOVERY_ACTOR_ID,
  type DiscoveryEvent,
  type DiscoveryMessage,
  type DiscoveryState,
  discoveryReducer,
  initialDiscoveryState,
  spawnDiscoveryActor,
} from "./discovery.actor";
import { createActorRuntime } from "./runtime";

const c1 = makeCandidate({ path: "/h/.config/fish/config.fish", kind: "file", reason: "include" });
const c2 = makeCandidate({ path: "/h/.config/git/config", kind: "file", reason: "include" });

describe("discoveryReducer", () => {
  test("rescan transitions to scanning, emits progress, dispatches one effect", () => {
    const out = discoveryReducer(initialDiscoveryState, { kind: "rescan", payload: undefined });
    expect(out.state.status).toBe("scanning");
    expect(out.events.map((e) => e.kind)).toEqual(["scanProgress"]);
    expect(out.effects).toHaveLength(1);
  });

  test("scanOk replaces queue, emits scanProgress and candidateAdded include", () => {
    const out = discoveryReducer(initialDiscoveryState, {
      kind: "scanOk",
      payload: { queued: [c1, c2], autoTracked: [] },
    });
    expect(out.state.status).toBe("ready");
    expect(out.state.queue).toHaveLength(2);
    expect(out.events.map((e) => e.kind)).toEqual(["scanProgress", "candidateAdded"]);
  });

  test("scanOk emits candidateAdded auto for auto-tracked paths", () => {
    const out = discoveryReducer(initialDiscoveryState, {
      kind: "scanOk",
      payload: { queued: [], autoTracked: ["/h/.zshrc"] },
    });
    const reasons = out.events
      .filter(
        (e): e is Extract<DiscoveryEvent, { kind: "candidateAdded" }> =>
          e.kind === "candidateAdded",
      )
      .map((e) => e.payload.reason);
    expect(reasons).toEqual(["auto"]);
  });

  test("scanFailed records error and emits scanProgress error", () => {
    const out = discoveryReducer(initialDiscoveryState, {
      kind: "scanFailed",
      payload: { error: { tag: "NotFound", resource: "Config", id: "/x" } },
    });
    expect(out.state.status).toBe("error");
    expect(out.state.error).not.toBeNull();
    expect(out.events.map((e) => e.kind)).toEqual(["scanProgress"]);
  });

  test("expandOk dedupes siblings already in queue", () => {
    const startState: DiscoveryState = { ...initialDiscoveryState, queue: [c1] };
    const out = discoveryReducer(startState, {
      kind: "expandOk",
      payload: { siblings: [c1, c2] },
    });
    expect(out.state.queue).toHaveLength(2);
    expect(out.events).toHaveLength(1);
    const ev = out.events[0]! as Extract<DiscoveryEvent, { kind: "candidateAdded" }>;
    expect(ev.payload.count).toBe(1);
  });

  test("accept/reject/defer flips the targeted candidate's status", () => {
    const startState: DiscoveryState = { ...initialDiscoveryState, queue: [c1] };
    const accepted = discoveryReducer(startState, { kind: "accept", payload: { id: c1.id } });
    expect(accepted.state.queue[0]!.status).toBe("accepted");
    const rejected = discoveryReducer(startState, { kind: "reject", payload: { id: c1.id } });
    expect(rejected.state.queue[0]!.status).toBe("rejected");
    const deferred = discoveryReducer(startState, { kind: "defer", payload: { id: c1.id } });
    expect(deferred.state.queue[0]!.status).toBe("deferred");
  });

  test("accept on missing id is a no-op", () => {
    const out = discoveryReducer(initialDiscoveryState, {
      kind: "accept",
      payload: { id: "nope" },
    });
    expect(out.state).toBe(initialDiscoveryState);
    expect(out.events).toEqual([]);
  });
});

describe("discovery actor (effect)", () => {
  test("rescan eventually moves to ready with the fake's queue", async () => {
    const fakeDiscovery: DiscoveryService = {
      scan: async () => ok({ queued: [c1, c2], autoTracked: [] }),
      expandSiblings: async () => ok([]),
      decide: (c, d) => ({ ...c, status: d === "accept" ? "accepted" : "pending" }),
    };
    const fakeConfig = {
      loadOrInit: async () =>
        ok({
          path: { home: "/h", dotfiles: "/h/d", backup: "/h/b" },
          discovery: { auto_track: false, include: [], exclude: [] },
          options: {
            vcs: "jj" as const,
            auto_commit: true,
            auto_sync: false,
            auto_sync_interval: "daily" as const,
          },
          experimental: { detect_api_keys: false },
        }),
    };
    const services = {
      home: "/h",
      config: fakeConfig,
      bootstrap: {},
      repo: {},
      discovery: fakeDiscovery,
    } as unknown as Services;
    const runtime = createActorRuntime({ services });
    spawnDiscoveryActor(runtime);
    const actor = runtime.get<DiscoveryState, DiscoveryMessage, DiscoveryEvent>(DISCOVERY_ACTOR_ID);

    const seen: string[] = [];
    type ProgressEvent = Extract<DiscoveryEvent, { kind: "scanProgress" }>;
    type AddedEvent = Extract<DiscoveryEvent, { kind: "candidateAdded" }>;
    runtime.on<ProgressEvent>("scanProgress", (e) => seen.push(`progress:${e.payload.status}`));
    runtime.on<AddedEvent>("candidateAdded", (e) =>
      seen.push(`added:${e.payload.reason}:${e.payload.count}`),
    );

    actor.send({ kind: "rescan", payload: undefined });
    for (let i = 0; i < 30 && actor.getState().status !== "ready"; i++) {
      await Promise.resolve();
    }
    expect(actor.getState().status).toBe("ready");
    expect(actor.getState().queue).toHaveLength(2);
    expect(seen).toContain("progress:scanning");
    expect(seen).toContain("progress:ready");
    expect(seen).toContain("added:include:2");
    runtime.dispose();
  });
});
