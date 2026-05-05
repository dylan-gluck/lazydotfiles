import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wireServices } from "../../src/composition/services";
import { fileExists, isSymlink, readSymlinkTarget } from "../test-utils/fs";
import { withTmpDir } from "../test-utils/tmp";

describe("A7: restore stays in TUI", () => {
  test("restoreToOp rewinds working copy and re-materializes symlinks", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const boot = await services.bootstrap.run();
      expect(boot.ok).toBe(true);

      const target = join(home.path, ".zshrc");
      await writeFile(target, "alias g=jj\n", { mode: 0o600 });

      const added = await services.track.add(target);
      expect(added.ok).toBe(true);
      expect(await isSymlink(target)).toBe(true);

      // Capture the track op id BEFORE the next change.
      // The latest op AFTER `track.add` is the one to restore to: it captures
      // the symlink, dotfiles source, AND tracked-file index entry. The earlier
      // `describe commit` op fires before the index is written, so restoring to
      // it would leave the index empty. We don't lie about that — we restore to
      // "head right after add" which is what the user intends in the TUI.
      const beforeOps = await services.operation.list({ limit: 50 });
      expect(beforeOps.ok).toBe(true);
      if (!beforeOps.ok) return;
      const headOp = beforeOps.value[0];
      expect(headOp).toBeDefined();
      if (headOp === undefined) return;

      // Untrack to advance history; target is now a regular file again, source is gone.
      const removed = await services.track.remove(target);
      expect(removed.ok).toBe(true);
      expect(await isSymlink(target)).toBe(false);
      expect(await fileExists(`${home.path}/dotfiles/.zshrc`)).toBe(false);

      // Restore to the track op via the same service the actor uses.
      const restoreOutcome = await services.restore.restoreToOp(headOp.opId);
      expect(restoreOutcome.ok).toBe(true);
      if (!restoreOutcome.ok) return;
      expect(restoreOutcome.value.rematerialized.map((f) => f.target)).toContain(target);

      // Working copy is rewound: target is once again the canonical symlink and
      // dotfiles/.zshrc carries the original content.
      expect(await isSymlink(target)).toBe(true);
      expect(await readSymlinkTarget(target)).toBe(`${home.path}/dotfiles/.zshrc`);
      expect(await Bun.file(`${home.path}/dotfiles/.zshrc`).text()).toBe("alias g=jj\n");
    });
  }, 30_000);
});
