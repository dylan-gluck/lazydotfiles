import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wireServices } from "../../src/composition/services";
import { createJjRepository } from "../../src/repositories/jj.repository";
import { fileExists, isSymlink, readSymlinkTarget } from "../test-utils/fs";
import { withTmpDir } from "../test-utils/tmp";

describe("track→untrack preserves jj history (A4)", () => {
  test("file restored at original location; jj log retains track + untrack", async () => {
    await withTmpDir(async (home) => {
      const target = join(home.path, ".zshrc");
      await writeFile(target, "alias g=jj\n", { mode: 0o600 });

      const services = wireServices({ home: home.path });
      const boot = await services.bootstrap.run();
      expect(boot.ok).toBe(true);

      const added = await services.track.add(target);
      expect(added.ok).toBe(true);
      expect(await isSymlink(target)).toBe(true);
      const linkTarget = await readSymlinkTarget(target);
      expect(linkTarget).toBe(`${home.path}/dotfiles/.zshrc`);

      const removed = await services.track.remove(target);
      expect(removed.ok).toBe(true);

      // A4.1 target is now a regular file with the original content.
      expect(await isSymlink(target)).toBe(false);
      expect(await Bun.file(target).text()).toBe("alias g=jj\n");

      // A4.2 jj log retains both changes.
      const log = await createJjRepository().log({
        root: `${home.path}/dotfiles`,
        limit: 50,
      });
      expect(log.ok).toBe(true);
      if (!log.ok) return;
      const descriptions = log.value.map((op) => op.description);
      expect(descriptions).toContain("track .zshrc");
      expect(descriptions).toContain("untrack .zshrc");

      // A4.3 source removed from working copy.
      expect(await fileExists(`${home.path}/dotfiles/.zshrc`)).toBe(false);
    });
  }, 30_000);
});
