import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeTrackedFile } from "../../src/domain/tracked-file";
import { createTrackedFileRepository } from "../../src/repositories/tracked-file.repository";
import { withTmpDir } from "../../src/test-utils/tmp";

describe("trackedFileRepository", () => {
  test("list() on an empty index returns []", async () => {
    await withTmpDir(async ({ path: dotfilesRoot }) => {
      const repo = createTrackedFileRepository({ dotfilesRoot });
      const r = await repo.list();
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toEqual([]);
    });
  });

  test("upsert + read round-trip", async () => {
    await withTmpDir(async ({ path: dotfilesRoot }) => {
      const repo = createTrackedFileRepository({ dotfilesRoot });
      const tf = makeTrackedFile({
        source: `${dotfilesRoot}/.zshrc`,
        target: "/home/user/.zshrc",
        kind: "file",
        addedAt: "2026-05-01T00:00:00Z",
      });
      const u = await repo.upsert(tf);
      expect(u.ok).toBe(true);
      const r = await repo.read(tf.id);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toEqual(tf);
    });
  });

  test("read() on a missing id returns NotFound", async () => {
    await withTmpDir(async ({ path: dotfilesRoot }) => {
      const repo = createTrackedFileRepository({ dotfilesRoot });
      const r = await repo.read("0".repeat(64));
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.tag).toBe("NotFound");
    });
  });

  test("malformed json in the index causes list() to return ParseError", async () => {
    await withTmpDir(async ({ path: dotfilesRoot }) => {
      const indexDir = join(dotfilesRoot, ".ldf", "tracked");
      await mkdir(indexDir, { recursive: true });
      await writeFile(join(indexDir, "bad.json"), '{"id":"x"}'); // missing required fields
      const repo = createTrackedFileRepository({ dotfilesRoot });
      const r = await repo.list();
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.tag).toBe("ParseError");
    });
  });

  test("remove() then read() returns NotFound", async () => {
    await withTmpDir(async ({ path: dotfilesRoot }) => {
      const repo = createTrackedFileRepository({ dotfilesRoot });
      const tf = makeTrackedFile({
        source: `${dotfilesRoot}/.zshrc`,
        target: "/home/user/.zshrc",
        kind: "file",
        addedAt: "2026-05-01T00:00:00Z",
      });
      await repo.upsert(tf);
      const rm = await repo.remove(tf.id);
      expect(rm.ok).toBe(true);
      const r = await repo.read(tf.id);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.tag).toBe("NotFound");
    });
  });
});
