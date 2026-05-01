import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeTmpDir, type TmpDir } from "../test-utils/tmp";
import { createFsRepository } from "./fs.repository";

let tmp: TmpDir;
const repo = createFsRepository();

beforeEach(async () => {
  tmp = await makeTmpDir("ldf-fs-");
});

afterEach(async () => {
  await tmp.cleanup();
});

describe("FsRepository.move", () => {
  test("renames within a device and preserves mode", async () => {
    const src = join(tmp.path, "a");
    await writeFile(src, "data");
    await chmod(src, 0o600);
    const dst = join(tmp.path, "sub", "b");
    const r = await repo.move({ src, dst });
    expect(r.ok).toBe(true);
    const s = await stat(dst);
    expect(s.mode & 0o777).toBe(0o600);
    expect(await Bun.file(dst).text()).toBe("data");
  });

  test("refuses to overwrite an existing dst", async () => {
    const src = join(tmp.path, "a");
    const dst = join(tmp.path, "b");
    await writeFile(src, "x");
    await writeFile(dst, "y");
    const r = await repo.move({ src, dst });
    expect(r.ok).toBe(false);
    expect(await Bun.file(dst).text()).toBe("y");
  });
});

describe("FsRepository.copyFile", () => {
  test("preserves mode and refuses overwrite", async () => {
    const src = join(tmp.path, "src");
    const dst = join(tmp.path, "dst");
    await writeFile(src, "data");
    await chmod(src, 0o755);
    const r = await repo.copyFile({ src, dst });
    expect(r.ok).toBe(true);
    expect((await stat(dst)).mode & 0o777).toBe(0o755);
    const r2 = await repo.copyFile({ src, dst });
    expect(r2.ok).toBe(false);
  });
});

describe("FsRepository.removeFile", () => {
  test("idempotent on ENOENT", async () => {
    const r = await repo.removeFile(join(tmp.path, "nope"));
    expect(r.ok).toBe(true);
  });
  test("removes regular files", async () => {
    const path = join(tmp.path, "x");
    await writeFile(path, "");
    const r = await repo.removeFile(path);
    expect(r.ok).toBe(true);
    expect(await Bun.file(path).exists()).toBe(false);
  });
});

describe("FsRepository.ensureDir", () => {
  test("creates new and reports created=true", async () => {
    const r = await repo.ensureDir(join(tmp.path, "new"));
    expect(r.ok && r.value.created).toBe(true);
  });
  test("idempotent on existing dir", async () => {
    const path = join(tmp.path, "existing");
    await mkdir(path);
    const r = await repo.ensureDir(path);
    expect(r.ok && r.value.created).toBe(false);
  });
});
