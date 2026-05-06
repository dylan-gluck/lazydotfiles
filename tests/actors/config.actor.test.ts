import { describe, expect, test } from "bun:test";
import {
  CONFIG_ACTOR_ID,
  type ConfigEvent,
  type ConfigMessage,
  configReducer,
  type ConfigState,
  initialConfigState,
  spawnConfigActor,
} from "../../src/actors/config.actor";
import { createActorRuntime } from "../../src/actors/runtime";
import { defaultConfig } from "../../src/domain/config";
import { ok, type Result } from "../../src/lib/result";
import type { Services } from "../../src/composition/services";
import type { ConfigService } from "../../src/services/config.service";
import type { ServiceError } from "../../src/services/types";
import { baseRepoService } from "../test-utils/services-fake";

function fakeConfigService(overrides: Partial<ConfigService> = {}): ConfigService {
  const defaults = defaultConfig();
  let cur = defaults;
  return {
    async loadOrInit() {
      return ok(cur) as Result<typeof cur, ServiceError>;
    },
    current() {
      return cur;
    },
    get() {
      return ok(undefined);
    },
    async set(_o, _v) {
      return ok(cur);
    },
    ...overrides,
  };
}

function makeServices(config: ConfigService): Services {
  return {
    home: "/h",
    config,
    bootstrap: {
      async run() {
        return ok({ config: defaultConfig(), initialized: false });
      },
    },
    repo: baseRepoService(),
    discovery: {
      scan: async () => ok({ queued: [], autoTracked: [] }),
      loadCached: async () => ok(null),
      commitAccept: async () => ok(undefined),
      commitDefer: async () => ok(undefined),
      expandSiblings: async () => ok([]),
      decide: (c) => c,
    },
    backups: {
      snapshot: async () => ok({} as never),
      list: async () => ok([]),
      read: async () => ok({} as never),
      payloadPath: () => "",
    },
    track: {
      add: async () => ok({} as never),
      remove: async () => ok({} as never),
    },
    operation: {
      list: async () => ok([]),
      diff: async () => ok(""),
    },
    restore: {
      restoreToOp: async () => ok({ rematerialized: [] }),
      restoreFromBackup: async () => ok({} as never),
    },
    sync: {
      state: async () => ok({} as never),
      fetch: async () => ok({} as never),
      push: async () => ok({} as never),
      sync: async () => ok({} as never),
      resolve: async () => ok({} as never),
    },
  };
}

describe("configReducer", () => {
  test("load → loading + one effect, no events", () => {
    const r = configReducer(initialConfigState, { kind: "load", payload: undefined });
    expect(r.state.status).toBe("loading");
    expect(r.events).toEqual([]);
    expect(r.effects.length).toBe(1);
  });

  test("loaded → ready + configChanged event", () => {
    const cfg = defaultConfig();
    const r = configReducer(
      { ...initialConfigState, status: "loading" },
      { kind: "loaded", payload: { config: cfg } },
    );
    expect(r.state).toEqual({ status: "ready", config: cfg, error: null });
    expect(r.events).toHaveLength(1);
    expect(r.events[0]!.kind).toBe("configChanged");
  });

  test("loadFailed → error + configFailed event", () => {
    const error: ServiceError = { tag: "NotFound", resource: "Config", id: "x" };
    const r = configReducer(initialConfigState, { kind: "loadFailed", payload: { error } });
    expect(r.state.status).toBe("error");
    expect(r.events[0]!.kind).toBe("configFailed");
  });

  test("set → saving + one effect", () => {
    const r = configReducer(initialConfigState, {
      kind: "set",
      payload: { option: "discovery.auto_track", value: false },
    });
    expect(r.state.status).toBe("saving");
    expect(r.effects.length).toBe(1);
  });

  test("setOk → ready + configChanged", () => {
    const cfg = defaultConfig();
    const r = configReducer(
      { ...initialConfigState, status: "saving" },
      { kind: "setOk", payload: { config: cfg } },
    );
    expect(r.state.status).toBe("ready");
    expect(r.events[0]!.kind).toBe("configChanged");
  });

  test("setFailed retains previous config", () => {
    const cfg = defaultConfig();
    const error: ServiceError = { tag: "Validation", issues: [{ message: "bad" }] };
    const r = configReducer(
      { status: "saving", config: cfg, error: null },
      { kind: "setFailed", payload: { error } },
    );
    expect(r.state.config).toBe(cfg);
    expect(r.state.status).toBe("error");
    expect(r.events[0]!.kind).toBe("configFailed");
  });
});

describe("config actor wiring", () => {
  test("spawnConfigActor + load message reaches ready and emits configChanged", async () => {
    const services = makeServices(fakeConfigService());
    const rt = createActorRuntime({ services });
    spawnConfigActor(rt);
    const seen: ConfigEvent[] = [];
    rt.on<ConfigEvent>("configChanged", (e) => seen.push(e));
    const actor = rt.get<ConfigState, ConfigMessage, ConfigEvent>(CONFIG_ACTOR_ID);
    actor.send({ kind: "load", payload: undefined });
    await new Promise((r) => setTimeout(r, 20));
    expect(actor.getState().status).toBe("ready");
    expect(seen).toHaveLength(1);
  });
});
