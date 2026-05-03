import { describe, expect, test } from "bun:test";
import type { Config } from "../domain/config";
import { err, ok, type Result } from "../lib/result";
import type { FsScannerRepository } from "../repositories/fs-scanner.repository";
import { createDiscoveryService, DEFAULT_SIBLING_DEPTH } from "./discovery.service";
import type { ServiceError } from "./types";

function makeConfig(overrides: Partial<Config["discovery"]> = {}): Config {
  return {
    path: { home: "/h", dotfiles: "/h/dotfiles", backup: "/h/.dotfiles.bak" },
    discovery: {
      auto_track: true,
      include: [".zshrc", ".config/**/*"],
      exclude: [],
      ...overrides,
    },
    options: { vcs: "jj", auto_commit: true, auto_sync: true, auto_sync_interval: "daily" },
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
