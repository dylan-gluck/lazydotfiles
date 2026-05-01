import { describe, expect, test } from "bun:test";
import { wireServices } from "../../src/composition/services";
import { withTmpDir } from "../../src/test-utils/tmp";

const HAS_JJ = Bun.which("jj") !== null;

describe.if(HAS_JJ)("wireServices", () => {
  test("bootstrap.run() against a tmp HOME yields expanded paths", async () => {
    await withTmpDir(async ({ path: home }) => {
      const services = wireServices({ home });
      const r = await services.bootstrap.run();
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.config.path.dotfiles).toBe(`${home}/dotfiles`);
      const got = services.config.get("path.backup");
      expect(got.ok && got.value).toBe(`${home}/.dotfiles.bak`);
    });
  });
});

if (!HAS_JJ) {
  describe("wireServices", () => {
    test("skipped: jj binary not on PATH", () => {
      expect(true).toBe(true);
    });
  });
}
