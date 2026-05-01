import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeTmpDir, type TmpDir } from "../test-utils/tmp";
import { createSymlinkRepository } from "./symlink.repository";

let tmp: TmpDir;
let dotfiles: string;
const repo = createSymlinkRepository();

beforeEach(async () => {
  tmp = await makeTmpDir("ldf-symlink-");
  dotfiles = join(tmp.path, "dotfiles");
  await mkdir(dotfiles, { recursive: true });
});

afterEach(async () => {
  await tmp.cleanup();
});

describe("SymlinkRepository", () => {
  test("materialize creates a link; read returns the target", async () => {
    const target = join(dotfiles, ".zshrc");
    await writeFile(target, "x");
    const link = join(tmp.path, ".zshrc");
    const r = await repo.materialize({ target, link });
    expect(r.ok).toBe(true);
    const info = await repo.read(link);
    expect(info.ok).toBe(true);
    if (info.ok) expect(info.value.target).toBe(target);
  });

  test("materialize refuses to overwrite existing path", async () => {
    const link = join(tmp.path, "exists");
    await writeFile(link, "");
    const r = await repo.materialize({ target: dotfiles, link });
    expect(r.ok).toBe(false);
  });

  test("unlink removes a symlink", async () => {
    const link = join(tmp.path, "a");
    await symlink(dotfiles, link);
    const r = await repo.unlink(link);
    expect(r.ok).toBe(true);
    const after = await repo.read(link);
    expect(after.ok).toBe(false);
  });

  test("unlink refuses to delete a regular file", async () => {
    const path = join(tmp.path, "real");
    await writeFile(path, "data");
    const r = await repo.unlink(path);
    expect(r.ok).toBe(false);
    const exists = Bun.file(path);
    expect(await exists.exists()).toBe(true);
  });

  test("unlink is idempotent on missing path", async () => {
    const r = await repo.unlink(join(tmp.path, "nope"));
    expect(r.ok).toBe(true);
  });

  test("read errors on non-symlink", async () => {
    const path = join(tmp.path, "f");
    await writeFile(path, "");
    const r = await repo.read(path);
    expect(r.ok).toBe(false);
  });

  test("isLdfSymlink true for link into dotfilesRoot", async () => {
    const target = join(dotfiles, "a");
    await writeFile(target, "");
    const link = join(tmp.path, "l");
    await symlink(target, link);
    const r = await repo.isLdfSymlink({ path: link, dotfilesRoot: dotfiles });
    expect(r.ok && r.value).toBe(true);
  });

  test("isLdfSymlink false for link outside dotfilesRoot", async () => {
    const outside = join(tmp.path, "outside");
    await writeFile(outside, "");
    const link = join(tmp.path, "l");
    await symlink(outside, link);
    const r = await repo.isLdfSymlink({ path: link, dotfilesRoot: dotfiles });
    expect(r.ok && r.value).toBe(false);
  });

  test("isLdfSymlink false for missing path", async () => {
    const r = await repo.isLdfSymlink({
      path: join(tmp.path, "nope"),
      dotfilesRoot: dotfiles,
    });
    expect(r.ok && r.value).toBe(false);
  });

  test("isLdfSymlink false for regular file", async () => {
    const path = join(tmp.path, "f");
    await writeFile(path, "");
    const r = await repo.isLdfSymlink({ path, dotfilesRoot: dotfiles });
    expect(r.ok && r.value).toBe(false);
  });

  test("isLdfSymlink resolves relative link targets", async () => {
    const sub = join(dotfiles, "sub");
    await mkdir(sub);
    const target = join(sub, "f");
    await writeFile(target, "");
    const link = join(tmp.path, "rel");
    // relative link from tmp.path to dotfiles/sub/f
    await symlink("./dotfiles/sub/f", link);
    const r = await repo.isLdfSymlink({ path: link, dotfilesRoot: dotfiles });
    expect(r.ok && r.value).toBe(true);
  });
});
