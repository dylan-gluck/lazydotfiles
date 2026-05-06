import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { defaultConfig, type Config } from "../../src/domain/config";
import { createDiscoveryCacheRepository } from "../../src/repositories/discovery-cache.repository";
import { createFsScannerRepository } from "../../src/repositories/fs-scanner.repository";
import { createDiscoveryService } from "../../src/services/discovery.service";
import { useTmpDir } from "../test-utils/tmp";

const ctx = useTmpDir("ldf-cache-int-");
const touch = (rel: string) => ctx.touch(rel);
const dir = () => ctx.dir();

function buildSvc() {
  const cache = createDiscoveryCacheRepository({
    getDbPath: () => join(dir().path, ".cache/lazydotfiles/cache.db"),
  });
  const svc = createDiscoveryService({
    scanner: createFsScannerRepository(),
    cache,
  });
  return { cache, svc, cfg: configFor(dir().path) };
}

async function loadedSnapshot(
  svc: ReturnType<typeof createDiscoveryService>,
  cfg: Config,
): Promise<{ queued: readonly { path: string }[] }> {
  const r = await svc.loadCached(cfg);
  if (!r.ok || r.value === null) throw new Error("expected cached snapshot");
  return r.value;
}

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

    const { cache, svc, cfg } = buildSvc();

    const first = await svc.scan(cfg);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const firstPaths = first.value.queued.map((c) => c.path).sort();
    expect(firstPaths).toContain(join(dir().path, ".config/fish/config.fish"));
    expect(firstPaths).toContain(join(dir().path, ".config/fish/sib.fish"));
    expect(firstPaths).toContain(join(dir().path, ".config/git/config"));

    const defer = await svc.commitDefer(cfg, join(dir().path, ".config/git/config"));
    expect(defer.ok).toBe(true);

    // commitDefer leaves the cached snapshot trimmed straight away.
    const cached = await loadedSnapshot(svc, cfg);
    expect(cached.queued.map((c) => c.path)).not.toContain(join(dir().path, ".config/git/config"));

    // A fresh scan also skips the deferred path.
    const second = await svc.scan(cfg);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.queued.map((c) => c.path)).not.toContain(
      join(dir().path, ".config/git/config"),
    );

    cache.close();
  });

  test("commitAccept removes the path from the cached snapshot", async () => {
    await touch(".config/fish/config.fish");
    await touch(".config/fish/sib.fish");

    const { cache, svc, cfg } = buildSvc();

    await svc.scan(cfg);
    const accepted = await svc.commitAccept(cfg, join(dir().path, ".config/fish/config.fish"));
    expect(accepted.ok).toBe(true);

    const cached = await loadedSnapshot(svc, cfg);
    const paths = cached.queued.map((c) => c.path);
    expect(paths).not.toContain(join(dir().path, ".config/fish/config.fish"));
    expect(paths).toContain(join(dir().path, ".config/fish/sib.fish"));

    cache.close();
  });
});
