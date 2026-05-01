import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isSymlink } from "../test-utils/fs";
import { withTmpDir } from "../test-utils/tmp";

interface Spawned {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function spawnCli(home: string, args: readonly string[]): Promise<Spawned> {
  const proc = Bun.spawn(["bun", "run", "bin/ldf.ts", ...args], {
    env: { ...process.env, HOME: home, EDITOR: "true" },
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

describe("ldf cli smoke", () => {
  test("status on cold $HOME", async () => {
    await withTmpDir(async (home) => {
      const r = await spawnCli(home.path, ["status"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toContain("tracked: 0 files");
    });
  }, 30_000);

  test("unknown command → exit 1", async () => {
    await withTmpDir(async (home) => {
      const r = await spawnCli(home.path, ["bogus"]);
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toContain("unknown command");
    });
  }, 30_000);

  test("add + rm round-trip via real binary", async () => {
    await withTmpDir(async (home) => {
      const target = join(home.path, ".zshrc");
      await writeFile(target, "export FOO=1\n", { mode: 0o600 });

      const add = await spawnCli(home.path, ["add", target]);
      expect(add.exitCode).toBe(0);
      expect(add.stdout).toContain("tracked .zshrc");
      expect(await isSymlink(target)).toBe(true);

      const rm = await spawnCli(home.path, ["rm", target]);
      expect(rm.exitCode).toBe(0);
      expect(rm.stdout).toContain("untracked .zshrc");
      expect(await isSymlink(target)).toBe(false);
    });
  }, 60_000);

  test("config get default", async () => {
    await withTmpDir(async (home) => {
      const r = await spawnCli(home.path, ["config", "discovery.auto_track"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdout.trim()).toBe("true");
    });
  }, 30_000);
});
