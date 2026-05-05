import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { makeCandidate } from "../domain/candidate";
import type { Config } from "../domain/config";
import { withTmpDir } from "../test-utils/tmp";
import {
  createDiscoveryCacheRepository,
  discoveryConfigHash,
} from "./discovery-cache.repository";

function makeConfig(overrides: Partial<Config["discovery"]> = {}): Config {
  return {
    path: { home: "/h", dotfiles: "/h/d", backup: "/h/b", cache: "/h/c" },
    discovery: { auto_track: true, include: [".zshrc"], exclude: [], ...overrides },
    options: {
      vcs: "jj",
      auto_commit: true,
      auto_sync: false,
      auto_sync_interval: "daily",
      remote: undefined,
    },
    experimental: { detect_api_keys: false },
  };
}

const c1 = makeCandidate({ path: "/h/.config/fish/config.fish", kind: "file", reason: "include" });
const c2 = makeCandidate({ path: "/h/.config/git/config", kind: "file", reason: "include" });

describe("discoveryConfigHash", () => {
  test("stable across argument order in objects, sensitive to include/exclude/home/auto_track", () => {
    const a = discoveryConfigHash(makeConfig());
    const b = discoveryConfigHash(makeConfig());
    expect(a).toBe(b);

    const c = discoveryConfigHash(makeConfig({ include: [".bashrc"] }));
    expect(c).not.toBe(a);

    const d = discoveryConfigHash(makeConfig({ auto_track: false }));
    expect(d).not.toBe(a);
  });

  test("ignores fields outside the discovery slice", () => {
    const base = discoveryConfigHash(makeConfig());
    const cfg = makeConfig();
    const tweaked: Config = {
      ...cfg,
      options: { ...cfg.options, remote: "git@host:repo" },
    };
    expect(discoveryConfigHash(tweaked)).toBe(base);
  });
});

describe("DiscoveryCacheRepository", () => {
  test("load() returns null when cache file is empty", async () => {
    await withTmpDir(async (dir) => {
      const repo = createDiscoveryCacheRepository({
        getDbPath: () => join(dir.path, "cache.db"),
      });
      const r = await repo.load(discoveryConfigHash(makeConfig()));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toBeNull();
      repo.close();
    });
  });

  test("save() then load() round-trips the snapshot under matching hash", async () => {
    await withTmpDir(async (dir) => {
      const repo = createDiscoveryCacheRepository({
        getDbPath: () => join(dir.path, "cache.db"),
      });
      const cfg = makeConfig();
      const hash = discoveryConfigHash(cfg);
      const w = await repo.save(hash, { queued: [c1, c2], autoTracked: ["/h/.zshrc"] });
      expect(w.ok).toBe(true);
      const r = await repo.load(hash);
      expect(r.ok).toBe(true);
      if (!r.ok || r.value === null) throw new Error("expected snapshot");
      expect(r.value.queued.map((c) => c.path)).toEqual([c1.path, c2.path]);
      expect(r.value.autoTracked).toEqual(["/h/.zshrc"]);
      expect(typeof r.value.scannedAt).toBe("string");
      repo.close();
    });
  });

  test("load() with mismatched hash returns null (treated as miss)", async () => {
    await withTmpDir(async (dir) => {
      const repo = createDiscoveryCacheRepository({
        getDbPath: () => join(dir.path, "cache.db"),
      });
      const cfg = makeConfig();
      await repo.save(discoveryConfigHash(cfg), { queued: [c1], autoTracked: [] });
      const r = await repo.load(discoveryConfigHash(makeConfig({ include: [".bashrc"] })));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toBeNull();
      repo.close();
    });
  });

  test("save() creates parent directories", async () => {
    await withTmpDir(async (dir) => {
      const path = join(dir.path, "nested", "deeper", "cache.db");
      const repo = createDiscoveryCacheRepository({ getDbPath: () => path });
      const w = await repo.save(discoveryConfigHash(makeConfig()), {
        queued: [],
        autoTracked: [],
      });
      expect(w.ok).toBe(true);
      expect(await Bun.file(path).exists()).toBe(true);
      repo.close();
    });
  });

  test("survives a re-open of the same path", async () => {
    await withTmpDir(async (dir) => {
      const path = join(dir.path, "cache.db");
      const cfg = makeConfig();
      const hash = discoveryConfigHash(cfg);
      const a = createDiscoveryCacheRepository({ getDbPath: () => path });
      await a.save(hash, { queued: [c1], autoTracked: [] });
      a.close();
      const b = createDiscoveryCacheRepository({ getDbPath: () => path });
      const r = await b.load(hash);
      expect(r.ok).toBe(true);
      if (!r.ok || r.value === null) throw new Error("expected snapshot");
      expect(r.value.queued).toHaveLength(1);
      b.close();
    });
  });
});
