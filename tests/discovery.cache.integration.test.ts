import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig, type Config } from "../src/domain/config";
import { createDiscoveryCacheRepository } from "../src/repositories/discovery-cache.repository";
import { createFsScannerRepository } from "../src/repositories/fs-scanner.repository";
import { createDiscoveryService } from "../src/services/discovery.service";
import { makeTmpDir, type TmpDir } from "../src/test-utils/tmp";

let dir: TmpDir;

async function touch(rel: string): Promise<void> {
  const abs = join(dir.path, rel);
  await mkdir(join(abs, ".."), { recursive: true });
  await Bun.write(abs, "");
}

beforeEach(async () => {
  dir = await makeTmpDir("ldf-cache-int-");
});
afterEach(async () => {
  await dir.cleanup();
});

function configFor(home: string): Config {
  return {
    ...defaultConfig(),
    path: {
      home,
      dotfiles: `${home}/dotfiles`,
      backup: `${home}/.bak`,
      cache: `${home}/.cache/lazydotfiles`,
    },
    discovery: {
      auto_track: false,
      include: [".config/**/*"],
      exclude: [],
    },
  };
}

describe("discovery cache + defer (real sqlite + real fs)", () => {
  test("commitDefer hides a path from subsequent scans of the same HOME", async () => {
    await touch(".config/fish/config.fish");
    await touch(".config/fish/sib.fish");
    await touch(".config/git/config");

    const cache = createDiscoveryCacheRepository({
      getDbPath: () => join(dir.path, ".cache/lazydotfiles/cache.db"),
    });
    const svc = createDiscoveryService({
      scanner: createFsScannerRepository(),
      cache,
    });
    const cfg = configFor(dir.path);

    const first = await svc.scan(cfg);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstPaths = first.value.queued.map((c) => c.path).sort();
    expect(firstPaths).toContain(join(dir.path, ".config/fish/config.fish"));
    expect(firstPaths).toContain(join(dir.path, ".config/fish/sib.fish"));
    expect(firstPaths).toContain(join(dir.path, ".config/git/config"));

    const defer = await svc.commitDefer(cfg, join(dir.path, ".config/git/config"));
    expect(defer.ok).toBe(true);

    // commitDefer leaves the cached snapshot trimmed straight away.
    const cached = await svc.loadCached(cfg);
    if (!cached.ok || cached.value === null) throw new Error("expected cached snapshot");
    expect(cached.value.queued.map((c) => c.path)).not.toContain(
      join(dir.path, ".config/git/config"),
    );

    // A fresh scan also skips the deferred path.
    const second = await svc.scan(cfg);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.queued.map((c) => c.path)).not.toContain(
      join(dir.path, ".config/git/config"),
    );

    cache.close();
  });

  test("commitAccept removes the path from the cached snapshot", async () => {
    await touch(".config/fish/config.fish");
    await touch(".config/fish/sib.fish");

    const cache = createDiscoveryCacheRepository({
      getDbPath: () => join(dir.path, ".cache/lazydotfiles/cache.db"),
    });
    const svc = createDiscoveryService({
      scanner: createFsScannerRepository(),
      cache,
    });
    const cfg = configFor(dir.path);

    await svc.scan(cfg);
    const accepted = await svc.commitAccept(cfg, join(dir.path, ".config/fish/config.fish"));
    expect(accepted.ok).toBe(true);

    const cached = await svc.loadCached(cfg);
    if (!cached.ok || cached.value === null) throw new Error("expected cached snapshot");
    expect(cached.value.queued.map((c) => c.path)).not.toContain(
      join(dir.path, ".config/fish/config.fish"),
    );
    expect(cached.value.queued.map((c) => c.path)).toContain(
      join(dir.path, ".config/fish/sib.fish"),
    );

    cache.close();
  });
});
