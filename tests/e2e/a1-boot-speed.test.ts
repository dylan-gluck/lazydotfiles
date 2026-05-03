import { describe, expect, test } from "bun:test";
import { wireServices } from "../../src/composition/services";
import { runCli } from "../../src/cli";
import { withTmpDir } from "../../src/test-utils/tmp";
import { HAS_JJ } from "../test-utils/jj";

/**
 * PRD A1: a user with no prior config runs `ldf`, sees the Status view in <500ms.
 *
 * The TUI renderer creation cost is small and not measurable headlessly.
 * This test takes the cold-path proxy: time `wireServices + bootstrap.run() +
 * runCli(['status'])` against a fresh $HOME, which mirrors what `bin/ldf.ts`
 * does before the renderer mounts. If this is under 500ms, the renderer mount
 * (a synchronous React render) keeps the total under budget on the same
 * machine.
 *
 * Gated on the `jj` binary; bootstrap requires it. In CI (`LDF_REQUIRE_JJ=1`
 * or `CI=true`), absence of `jj` is a hard failure rather than a silent skip.
 */
const BOOT_BUDGET_MS = 500;

describe.if(HAS_JJ)("A1 boot speed", () => {
  test(`cold wireServices + bootstrap + status under ${BOOT_BUDGET_MS}ms`, async () => {
    await withTmpDir(async (dir) => {
      const home = dir.path;
      const t0 = performance.now();

      const services = wireServices({ home });
      const boot = await services.bootstrap.run();
      expect(boot.ok).toBe(true);

      let out = "";
      const code = await runCli(["status"], {
        services,
        io: {
          stdout: (s) => {
            out += s;
          },
          stderr: () => {},
          env: { HOME: home },
          cwd: home,
        },
      });
      const elapsed = performance.now() - t0;

      expect(code).toBe(0);
      expect(out).toContain("tracked: 0 files");

      if (elapsed >= BOOT_BUDGET_MS) {
        throw new Error(`A1 boot budget exceeded: ${elapsed.toFixed(1)}ms >= ${BOOT_BUDGET_MS}ms`);
      }
    });
  }, 30_000);
});

if (!HAS_JJ) {
  describe("A1 boot speed", () => {
    test("skipped: jj binary not on PATH", () => {
      expect(true).toBe(true);
    });
  });
}
