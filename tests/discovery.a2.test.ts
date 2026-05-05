import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig } from "../src/domain/config";
import { ok, type Result } from "../src/lib/result";
import { createFsScannerRepository } from "../src/repositories/fs-scanner.repository";
import { createDiscoveryService } from "../src/services/discovery.service";
import type { ServiceError } from "../src/services/types";
import { makeTmpDir, type TmpDir } from "../src/test-utils/tmp";

let dir: TmpDir;

async function touch(rel: string): Promise<void> {
  const abs = join(dir.path, rel);
  await mkdir(join(abs, ".."), { recursive: true });
  await Bun.write(abs, "");
}

beforeEach(async () => {
  dir = await makeTmpDir("ldf-a2-");
});
afterEach(async () => {
  await dir.cleanup();
});

describe("PRD A2 — discovery surfaces .zshrc, fish config, and auto-tracks non-glob include", () => {
  test("end-to-end scan against a real tmp HOME", async () => {
    await touch(".zshrc");
    await touch(".config/fish/config.fish");
    await touch(".config/fish/functions/greet.fish");

    const cfg = {
      ...defaultConfig(),
      path: {
        home: dir.path,
        dotfiles: `${dir.path}/dotfiles`,
        backup: `${dir.path}/.bak`,
        cache: `${dir.path}/.cache`,
      },
      discovery: {
        auto_track: true,
        include: [".zshrc", ".config/**/*"],
        exclude: [],
      },
    };

    const autoTracked: string[] = [];
    const svc = createDiscoveryService({
      scanner: createFsScannerRepository(),
      autoTrack: async (p): Promise<Result<void, ServiceError>> => {
        autoTracked.push(p);
        return ok(undefined);
      },
    });

    const r = await svc.scan(cfg);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // A2: .zshrc auto-tracks via non-glob include (no queue entry).
    expect(autoTracked).toEqual([join(dir.path, ".zshrc")]);
    expect(r.value.queued.find((c) => c.path.endsWith(".zshrc"))).toBeUndefined();

    // A2: glob include surfaces fish config and its siblings into the queue.
    const queuedPaths = r.value.queued.map((c) => c.path).sort();
    expect(queuedPaths).toContain(join(dir.path, ".config/fish/config.fish"));
    expect(queuedPaths).toContain(join(dir.path, ".config/fish/functions/greet.fish"));

    // A2: sibling expansion against the accepted file surfaces other entries.
    const sibs = await svc.expandSiblings(join(dir.path, ".config/fish/config.fish"));
    expect(sibs.ok).toBe(true);
    if (!sibs.ok) return;
    const sibPaths = sibs.value.map((c) => c.path);
    expect(sibPaths).toContain(join(dir.path, ".config/fish/functions/greet.fish"));
    for (const c of sibs.value) expect(c.reason).toBe("sibling-of");
  });
});
