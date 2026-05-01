import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createFsRepository } from "../../src/repositories/fs.repository";
import { withTmpDir } from "../../src/test-utils/tmp";

describe("FsRepository", () => {
  test("exists returns false for missing path", async () => {
    await withTmpDir(async ({ path }) => {
      const r = await createFsRepository().exists(join(path, "missing"));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(false);
    });
  });

  test("exists returns true for present file", async () => {
    await withTmpDir(async ({ path }) => {
      const f = join(path, "f");
      await writeFile(f, "hi");
      const r = await createFsRepository().exists(f);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(true);
    });
  });

  test("ensureDir creates a new directory", async () => {
    await withTmpDir(async ({ path }) => {
      const fs = createFsRepository();
      const target = join(path, "a", "b", "c");
      const r = await fs.ensureDir(target);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.created).toBe(true);
      const e = await fs.exists(target);
      expect(e.ok && e.value).toBe(true);
    });
  });

  test("ensureDir is idempotent (created=false on second call)", async () => {
    await withTmpDir(async ({ path }) => {
      const fs = createFsRepository();
      const target = join(path, "x");
      const a = await fs.ensureDir(target);
      const b = await fs.ensureDir(target);
      expect(a.ok && a.value.created).toBe(true);
      expect(b.ok && b.value.created).toBe(false);
    });
  });

  test("ensureDir refuses to clobber a file at the target path", async () => {
    await withTmpDir(async ({ path }) => {
      const fs = createFsRepository();
      const target = join(path, "f");
      await writeFile(target, "hi");
      const r = await fs.ensureDir(target);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe("IoError");
    });
  });
});
