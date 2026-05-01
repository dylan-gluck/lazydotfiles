import { describe, expect, test } from "bun:test";
import { type Config, defaultConfig } from "../../src/domain/config";
import { err, ok, type Result } from "../../src/lib/result";
import type { ConfigRepository, RepoError } from "../../src/repositories/types";
import { createConfigService } from "../../src/services/config.service";

interface FakeRepo extends ConfigRepository {
  loaded: Config | null;
  setLoadResult(r: Result<Config, RepoError>): void;
  saveCount: number;
}

function makeFakeRepo(initial: Result<Config, RepoError>): FakeRepo {
  let loadResult: Result<Config, RepoError> = initial;
  let stored: Config | null = loadResult.ok ? loadResult.value : null;
  return {
    kind: "ConfigRepository",
    path: "/fake/config.toml",
    loaded: stored,
    saveCount: 0,
    setLoadResult(r) {
      loadResult = r;
      if (r.ok) stored = r.value;
    },
    async load() {
      if (loadResult.ok && stored !== null) return ok(stored);
      return loadResult;
    },
    async save(cfg) {
      this.saveCount++;
      stored = cfg;
      this.loaded = cfg;
      loadResult = ok(cfg);
      return ok(undefined);
    },
  };
}

describe("ConfigService", () => {
  test("loadOrInit writes defaults when repo reports NotFound", async () => {
    const repo = makeFakeRepo(err({ tag: "NotFound", path: "/x" }));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    const r = await svc.loadOrInit();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(defaultConfig());
    expect(repo.saveCount).toBe(1);
  });

  test("loadOrInit returns existing config without saving", async () => {
    const cfg = defaultConfig();
    cfg.options.auto_commit = false;
    const repo = makeFakeRepo(ok(cfg));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    const r = await svc.loadOrInit();
    expect(r.ok && r.value.options.auto_commit).toBe(false);
    expect(repo.saveCount).toBe(0);
  });

  test("loadOrInit surfaces ParseError as Repository error and does not overwrite", async () => {
    const repo = makeFakeRepo(
      err({ tag: "ParseError", path: "/x", issues: [{ message: "boom" }] }),
    );
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    const r = await svc.loadOrInit();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe("Repository");
    expect(repo.saveCount).toBe(0);
  });

  test("current() reflects last loaded value", async () => {
    const repo = makeFakeRepo(ok(defaultConfig()));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    expect(svc.current()).toBeNull();
    await svc.loadOrInit();
    expect(svc.current()).toEqual(defaultConfig());
  });

  test("get() reads dotted paths and rejects unknown ones", async () => {
    const repo = makeFakeRepo(ok(defaultConfig()));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    await svc.loadOrInit();
    const a = svc.get("discovery.auto_track");
    expect(a.ok && a.value).toBe(true);
    const b = svc.get("nope.x");
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.error.tag).toBe("NotFound");
  });

  test("get() before load returns NotFound", () => {
    const repo = makeFakeRepo(ok(defaultConfig()));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    const r = svc.get("discovery.auto_track");
    expect(r.ok).toBe(false);
  });

  test("set() persists a valid value and updates cache", async () => {
    const repo = makeFakeRepo(ok(defaultConfig()));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    await svc.loadOrInit();
    const r = await svc.set("discovery.auto_track", false);
    expect(r.ok).toBe(true);
    const g = svc.get("discovery.auto_track");
    expect(g.ok && g.value).toBe(false);
    expect(repo.saveCount).toBe(1);
  });

  test("set() rejects wrong types via Validation and leaves state untouched", async () => {
    const repo = makeFakeRepo(ok(defaultConfig()));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    await svc.loadOrInit();
    const r = await svc.set("discovery.auto_track", "yes");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe("Validation");
    expect(repo.saveCount).toBe(0);
    const g = svc.get("discovery.auto_track");
    expect(g.ok && g.value).toBe(true);
  });

  test("set() rejects unknown option paths with NotFound", async () => {
    const repo = makeFakeRepo(ok(defaultConfig()));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    await svc.loadOrInit();
    const r = await svc.set("nope.x", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.tag).toBe("NotFound");
    expect(repo.saveCount).toBe(0);
  });

  test("set() before load returns NotFound", async () => {
    const repo = makeFakeRepo(ok(defaultConfig()));
    const svc = createConfigService({ repo, defaults: () => defaultConfig() });
    const r = await svc.set("discovery.auto_track", false);
    expect(r.ok).toBe(false);
  });
});
