import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { defaultConfig } from "../../src/domain/config";
import { expandPaths } from "../../src/lib/path";
import { createConfigRepository } from "../../src/repositories/config.repository";
import { createFsRepository } from "../../src/repositories/fs.repository";
import { createJjRepository } from "../../src/repositories/jj.repository";
import { createBootstrapService } from "../../src/services/bootstrap.service";
import { createConfigService } from "../../src/services/config.service";
import { withTmpDir } from "../../src/test-utils/tmp";
import { HAS_JJ } from "../test-utils/jj";

function wireForHome(home: string) {
  const configRepo = createConfigRepository(`${home}/.config/lazydotfiles/config.toml`);
  const config = createConfigService({
    repo: configRepo,
    defaults: () => {
      const base = defaultConfig();
      return { ...base, path: expandPaths(base.path, home) };
    },
  });
  const bootstrap = createBootstrapService({
    config,
    jj: createJjRepository(),
    fs: createFsRepository(),
  });
  return { config, bootstrap };
}

describe.if(HAS_JJ)("BootstrapService", () => {
  test("clean tmp HOME → writes config, inits jj repo, creates backup dir", async () => {
    await withTmpDir(async ({ path: home }) => {
      const { bootstrap } = wireForHome(home);
      const r = await bootstrap.run();
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.initialized).toBe(true);
      expect(r.value.config.path.home).toBe(home);
      expect(await Bun.file(join(home, ".config/lazydotfiles/config.toml")).exists()).toBe(true);
      expect((await stat(join(home, "dotfiles", ".jj"))).isDirectory()).toBe(true);
      expect((await stat(join(home, ".dotfiles.bak"))).isDirectory()).toBe(true);
    });
  });

  test("second run on a healthy install is a no-op", async () => {
    await withTmpDir(async ({ path: home }) => {
      const { bootstrap } = wireForHome(home);
      const first = await bootstrap.run();
      expect(first.ok).toBe(true);
      const cfgPath = join(home, ".config/lazydotfiles/config.toml");
      const cfgMtime = (await stat(cfgPath)).mtimeMs;
      const jjMtime = (await stat(join(home, "dotfiles", ".jj"))).mtimeMs;

      const second = await bootstrap.run();
      expect(second.ok).toBe(true);
      if (second.ok) expect(second.value.initialized).toBe(false);
      expect((await stat(cfgPath)).mtimeMs).toBe(cfgMtime);
      expect((await stat(join(home, "dotfiles", ".jj"))).mtimeMs).toBe(jjMtime);
    });
  });
});

if (!HAS_JJ) {
  describe("BootstrapService", () => {
    test("skipped: jj binary not on PATH", () => {
      expect(true).toBe(true);
    });
  });
}
