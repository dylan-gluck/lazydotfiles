import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { makeTmpDir, withTmpDir } from "../../src/test-utils/tmp";

describe("tmp", () => {
  test("makeTmpDir creates a directory and cleanup removes it", async () => {
    const dir = await makeTmpDir();
    const s = await stat(dir.path);
    expect(s.isDirectory()).toBe(true);
    await dir.cleanup();
    await expect(stat(dir.path)).rejects.toBeDefined();
  });

  test("withTmpDir cleans up on success", async () => {
    let captured = "";
    const result = await withTmpDir(async (dir) => {
      captured = dir.path;
      return 42;
    });
    expect(result).toBe(42);
    await expect(stat(captured)).rejects.toBeDefined();
  });

  test("withTmpDir cleans up on thrown error", async () => {
    let captured = "";
    await expect(
      withTmpDir(async (dir) => {
        captured = dir.path;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(stat(captured)).rejects.toBeDefined();
  });
});
