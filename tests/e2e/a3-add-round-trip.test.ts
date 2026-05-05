import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { trackedFileId } from "../../src/domain/tracked-file";
import { createJjRepository } from "../../src/repositories/jj.repository";
import { isSymlink, readSymlinkTarget } from "../test-utils/fs";
import { HAS_JJ } from "../test-utils/jj";
import { withE2eHome } from "./harness";

/**
 * PRD A3: accepting a candidate produces:
 *   - a backup at $HOME/.dotfiles.bak/<id>/<ts>/
 *   - a moved file under $HOME/dotfiles
 *   - a working symlink at the original location
 *   - a jj change with description `track <relpath>`
 */
describe.if(HAS_JJ)("A3 add round-trip", () => {
  test("ldf add produces backup, source, symlink, and jj track change", async () => {
    await withE2eHome(async ({ home, services, runCli }) => {
      const target = join(home, ".zshrc");
      const original = "export FOO=1\n";
      await writeFile(target, original, { mode: 0o600 });

      const add = await runCli(["add", target]);
      expect(add.code).toBe(0);
      expect(add.out).toContain("tracked .zshrc");

      // (a) backup at <home>/.dotfiles.bak/<id>/<ts>-add/
      const id = trackedFileId(target);
      const list = await services.backups.list(id);
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value.length).toBe(1);
      const record = list.value[0]!;
      expect(record.snapshotPath.startsWith(`${home}/.dotfiles.bak/${id}/`)).toBe(true);
      expect(record.trigger).toBe("add");
      const payloadPath = services.backups.payloadPath(record);
      const payload = await Bun.file(payloadPath).text();
      expect(payload).toBe(original);

      // (b) moved file under <home>/dotfiles
      const source = join(home, "dotfiles", ".zshrc");
      const sourceContent = await Bun.file(source).text();
      expect(sourceContent).toBe(original);

      // (c) working symlink at original location → source
      expect(await isSymlink(target)).toBe(true);
      expect(await readSymlinkTarget(target)).toBe(source);
      // Reading through the symlink yields the same bytes.
      expect(await Bun.file(target).text()).toBe(original);

      // (d) jj change with description `track <relpath>`
      const log = await createJjRepository().log({
        root: `${home}/dotfiles`,
        limit: 50,
      });
      expect(log.ok).toBe(true);
      if (!log.ok) return;
      const descriptions = log.value.map((c) => c.description);
      expect(descriptions).toContain("track .zshrc");
    });
  }, 30_000);
});

if (!HAS_JJ) {
  describe("A3 add round-trip", () => {
    test("skipped: jj binary not on PATH", () => {
      expect(true).toBe(true);
    });
  });
}
