import { describe, expect, test } from "bun:test";
import { makeCandidate } from "../domain/candidate";
import type { Config } from "../domain/config";
import { err, ok, type Result } from "../lib/result";
import type { DiscoveryCacheRepository } from "../repositories/discovery-cache.repository";
import type { FsScannerRepository } from "../repositories/fs-scanner.repository";
import { createDiscoveryService, DEFAULT_SIBLING_DEPTH } from "./discovery.service";
import type { ServiceError } from "./types";

function makeConfig(overrides: Partial<Config["discovery"]> = {}): Config {
  return {
    path: {
      home: "/h",
      dotfiles: "/h/dotfiles",
      backup: "/h/.dotfiles.bak",
      cache: "/h/.cache/lazydotfiles",
    },
    discovery: {
      auto_track: true,
      include: [".zshrc", ".config/**/*"],
      exclude: [],
      ...overrides,
    },
    options: {
      vcs: "jj",
      auto_commit: true,
      auto_sync: true,
      auto_sync_interval: "daily",
      remote: "",
    },
    experimental: { detect_api_keys: false },
  };
}

function fakeScanner(yields: readonly string[]): FsScannerRepository {
  return {
    kind: "FsScannerRepository",
    async *scan() {
      for (const p of yields) yield p;
    },
    async siblings() {
      return ok([] as readonly string[]);
    },
  };
}

describe("discovery.service.scan", () => {
  test("auto-tracks bare-path includes and queues glob matches", async () => {
    const calls: string[] = [];
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.zshrc", "/h/.config/fish/config.fish"]),
      autoTrack: async (p) => {
        calls.push(p);
        return ok(undefined);
      },
    });
    const r = await svc.scan(makeConfig());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.autoTracked).toEqual(["/h/.zshrc"]);
    expect(r.value.queued).toHaveLength(1);
    expect(r.value.queued[0]!.path).toBe("/h/.config/fish/config.fish");
    expect(r.value.queued[0]!.reason).toBe("include");
    expect(calls).toEqual(["/h/.zshrc"]);
  });

  test("queues bare-path includes when auto_track is false", async () => {
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.zshrc"]),
    });
    const r = await svc.scan(makeConfig({ auto_track: false }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.autoTracked).toEqual([]);
    expect(r.value.queued).toHaveLength(1);
  });

  test("propagates autoTrack failure as Repository error", async () => {
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.zshrc"]),
      autoTrack: async () =>
        err<ServiceError>({
          tag: "Repository",
          cause: { tag: "IoError", path: "/h", cause: new Error("x") },
        }),
    });
    const r = await svc.scan(makeConfig());
    expect(r.ok).toBe(false);
  });
});

describe("discovery.service cache integration", () => {
  function memCache(initialDeferred: readonly string[] = []): {
    repo: DiscoveryCacheRepository;
    saved: Array<{ hash: string; queued: number; auto: number }>;
    removed: Array<{ hash: string; path: string }>;
    deferred: Set<string>;
  } {
    const saved: Array<{ hash: string; queued: number; auto: number }> = [];
    const removed: Array<{ hash: string; path: string }> = [];
    const deferred = new Set<string>(initialDeferred);
    let stored: { hash: string; queued: readonly { path: string }[]; auto: readonly string[] } | null =
      null;
    const repo: DiscoveryCacheRepository = {
      kind: "DiscoveryCacheRepository",
      async load(hash) {
        if (stored === null || stored.hash !== hash) return ok(null);
        return ok({
          queued: stored.queued.map((c) =>
            makeCandidate({ path: c.path, kind: "file", reason: "include" }),
          ),
          autoTracked: stored.auto,
          scannedAt: "2026-05-01T00:00:00.000Z",
        });
      },
      async save(hash, snap) {
        stored = { hash, queued: snap.queued, auto: snap.autoTracked };
        saved.push({ hash, queued: snap.queued.length, auto: snap.autoTracked.length });
        return ok(undefined);
      },
      async removePath(hash, path) {
        removed.push({ hash, path });
        if (stored === null || stored.hash !== hash) return ok(undefined);
        stored = {
          hash,
          queued: stored.queued.filter((c) => c.path !== path),
          auto: stored.auto.filter((p) => p !== path),
        };
        return ok(undefined);
      },
      async markDeferred(path) {
        deferred.add(path);
        return ok(undefined);
      },
      async unmarkDeferred(path) {
        deferred.delete(path);
        return ok(undefined);
      },
      async loadDeferred() {
        return ok([...deferred].sort());
      },
      close() {},
    };
    return { repo, saved, removed, deferred };
  }

  test("scan() writes a snapshot through the cache repo", async () => {
    const { repo, saved } = memCache();
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.config/fish/config.fish"]),
      cache: repo,
    });
    const r = await svc.scan(makeConfig({ auto_track: false }));
    expect(r.ok).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.queued).toBe(1);
  });

  test("loadCached() returns null on cold cache, hits after a scan", async () => {
    const { repo } = memCache();
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.config/fish/config.fish"]),
      cache: repo,
    });
    const cfg = makeConfig({ auto_track: false });
    const cold = await svc.loadCached(cfg);
    expect(cold.ok && cold.value === null).toBe(true);

    await svc.scan(cfg);

    const warm = await svc.loadCached(cfg);
    expect(warm.ok).toBe(true);
    if (!warm.ok || warm.value === null) throw new Error("expected snapshot");
    expect(warm.value.queued).toHaveLength(1);
  });

  test("loadCached() returns null when discovery config slice changed", async () => {
    const { repo } = memCache();
    const svc = createDiscoveryService({ scanner: fakeScanner(["/h/.zshrc"]), cache: repo });
    await svc.scan(makeConfig({ include: [".zshrc"], auto_track: false }));
    const next = await svc.loadCached(
      makeConfig({ include: [".bashrc"], auto_track: false }),
    );
    expect(next.ok && next.value === null).toBe(true);
  });

  test("loadCached() returns null when no cache repo is wired", async () => {
    const svc = createDiscoveryService({ scanner: fakeScanner([]) });
    const r = await svc.loadCached(makeConfig());
    expect(r.ok && r.value === null).toBe(true);
  });

  test("scan() filters deferred paths from the queue", async () => {
    const { repo } = memCache(["/h/.config/git/config"]);
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.config/fish/config.fish", "/h/.config/git/config"]),
      cache: repo,
    });
    const r = await svc.scan(makeConfig({ auto_track: false }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.queued.map((c) => c.path)).toEqual(["/h/.config/fish/config.fish"]);
  });

  test("commitAccept() removes the path from the cached snapshot", async () => {
    const { repo, removed } = memCache();
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.config/fish/config.fish"]),
      cache: repo,
    });
    const cfg = makeConfig({ auto_track: false });
    await svc.scan(cfg);
    const r = await svc.commitAccept(cfg, "/h/.config/fish/config.fish");
    expect(r.ok).toBe(true);
    expect(removed).toEqual([
      { hash: removed[0]!.hash, path: "/h/.config/fish/config.fish" },
    ]);
    const cached = await svc.loadCached(cfg);
    if (!cached.ok || cached.value === null) throw new Error("expected snapshot");
    expect(cached.value.queued).toHaveLength(0);
  });

  test("commitDefer() removes from snapshot and persists in deferred set", async () => {
    const { repo, deferred } = memCache();
    const svc = createDiscoveryService({
      scanner: fakeScanner(["/h/.config/fish/config.fish"]),
      cache: repo,
    });
    const cfg = makeConfig({ auto_track: false });
    await svc.scan(cfg);
    const r = await svc.commitDefer(cfg, "/h/.config/fish/config.fish");
    expect(r.ok).toBe(true);
    expect(deferred.has("/h/.config/fish/config.fish")).toBe(true);
    // Subsequent scan should now skip the deferred path.
    const next = await svc.scan(cfg);
    expect(next.ok && next.value.queued).toEqual([]);
  });

  test("commitAccept/commitDefer are no-ops without a cache", async () => {
    const svc = createDiscoveryService({ scanner: fakeScanner([]) });
    expect((await svc.commitAccept(makeConfig(), "/h/x")).ok).toBe(true);
    expect((await svc.commitDefer(makeConfig(), "/h/x")).ok).toBe(true);
  });
});

describe("discovery.service.expandSiblings", () => {
  test("defaults depth to 4 and tags candidates with reason=sibling-of", async () => {
    let observed = -1;
    const svc = createDiscoveryService({
      scanner: {
        kind: "FsScannerRepository",
        async *scan() {},
        async siblings({ depth }) {
          observed = depth;
          return ok(["/h/.config/fish/functions/greet.fish"]);
        },
      },
    });
    const r = await svc.expandSiblings("/h/.config/fish/config.fish");
    expect(observed).toBe(DEFAULT_SIBLING_DEPTH);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(1);
    expect(r.value[0]!.reason).toBe("sibling-of");
  });

  test("propagates IO error as Repository ServiceError", async () => {
    const svc = createDiscoveryService({
      scanner: {
        kind: "FsScannerRepository",
        async *scan() {},
        async siblings(): Promise<
          Result<readonly string[], import("../repositories/types").RepoError>
        > {
          return err({ tag: "IoError", path: "/h", cause: new Error("nope") });
        },
      },
    });
    const r = await svc.expandSiblings("/h/x", 2);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
  });
});

describe("discovery.service.decide", () => {
  test("maps each decision to the corresponding status", () => {
    const svc = createDiscoveryService({ scanner: fakeScanner([]) });
    const c = {
      id: "x",
      path: "/p",
      kind: "file" as const,
      reason: "include" as const,
      siblings: [],
      status: "pending" as const,
    };
    expect(svc.decide(c, "accept").status).toBe("accepted");
    expect(svc.decide(c, "reject").status).toBe("rejected");
    expect(svc.decide(c, "defer").status).toBe("deferred");
    // Input is not mutated.
    expect(c.status).toBe("pending");
  });
});
