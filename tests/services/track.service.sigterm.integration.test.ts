import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wireServices } from "../../src/composition/services";
import { classifyFs, isSymlink } from "../test-utils/fs";
import { withTmpDir } from "../test-utils/tmp";

describe("SIGTERM mid-add leaves a recoverable filesystem (A5)", () => {
  for (let trial = 0; trial < 5; trial++) {
    test(`trial ${trial}`, async () => {
      await withTmpDir(async (home) => {
        const target = join(home.path, ".zshrc");
        const original = "alias g=jj\n";
        await writeFile(target, original, { mode: 0o600 });

        // Bootstrap so jj repo + backup dir exist before the child runs.
        const services = wireServices({ home: home.path });
        const boot = await services.bootstrap.run();
        expect(boot.ok).toBe(true);

        const proc = Bun.spawn(["bun", "scripts/track-add-once.ts"], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            LDF_TEST_HOME: home.path,
            LDF_TEST_TARGET: target,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        const delayMs = 5 + Math.floor(Math.random() * 76);
        const killTimer = setTimeout(() => proc.kill("SIGTERM"), delayMs);
        await proc.exited;
        clearTimeout(killTimer);

        const source = `${home.path}/dotfiles/.zshrc`;
        // Classify BEFORE recovery so we know which branch we're on.
        const initial = await classifyFs({ target, source, original });
        const recover = await services.track
          .add(target)
          .catch((e) => ({ ok: false as const, error: e }));

        if (initial === "fully-tracked") {
          expect(
            recover.ok === false &&
              "tag" in recover.error &&
              recover.error.tag === "InvalidTarget" &&
              recover.error.reason === "already-symlinked",
          ).toBe(true);
        } else if (initial === "fully-restored") {
          // Recovery should have succeeded → now fully tracked.
          expect(recover.ok).toBe(true);
          const after = await classifyFs({ target, source, original });
          expect(after).toBe("fully-tracked");
        } else {
          // Broken: dump diagnostic state.
          const diag = {
            initial,
            target,
            targetIsSymlink: await isSymlink(target),
            sourceExists: await Bun.file(source).exists(),
            recover,
          };
          throw new Error(`broken FS state: ${JSON.stringify(diag)}`);
        }
      });
    }, 30_000);
  }
});
