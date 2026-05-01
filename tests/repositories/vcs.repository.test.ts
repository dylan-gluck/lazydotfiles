import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createJjRepository } from "../../src/repositories/vcs.repository";
import { withTmpDir } from "../../src/test-utils/tmp";

const HAS_JJ = Bun.which("jj") !== null;

describe.if(HAS_JJ)("JjRepository", () => {
  test("isRepo returns false on a non-repo dir", async () => {
    await withTmpDir(async ({ path }) => {
      const r = await createJjRepository().isRepo(path);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(false);
    });
  });

  test("initColocated creates a .jj directory", async () => {
    await withTmpDir(async ({ path }) => {
      const target = join(path, "dotfiles");
      const jj = createJjRepository();
      const init = await jj.initColocated(target);
      expect(init.ok).toBe(true);
      const r = await jj.isRepo(target);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(true);
    });
  });
});

if (!HAS_JJ) {
  describe("JjRepository", () => {
    test("skipped: jj binary not on PATH", () => {
      expect(true).toBe(true);
    });
  });
}
