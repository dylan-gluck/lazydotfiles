import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createFsScannerRepository } from "../../src/repositories/fs-scanner.repository";
import { makeTmpDir, type TmpDir } from "../test-utils/tmp";

let dir: TmpDir;

async function touch(rel: string): Promise<string> {
  const abs = join(dir.path, rel);
  await mkdir(join(abs, ".."), { recursive: true });
  await Bun.write(abs, "");
  return abs;
}

beforeEach(async () => {
  dir = await makeTmpDir("ldf-scan-");
});

afterEach(async () => {
  await dir.cleanup();
});

describe("FsScannerRepository.scan", () => {
  test("yields includes minus excludes with negation re-include", async () => {
    await touch(".zshrc");
    await touch(".config/fish/config.fish");
    await touch(".env");
    await touch(".env.example");
    const scanner = createFsScannerRepository();
    const out: string[] = [];
    for await (const e of scanner.scan({
      home: dir.path,
      include: [".zshrc", ".config/**/*", ".env*"],
      exclude: [".env*", "!.env.example"],
    })) {
      if (e.isDir) continue;
      out.push(e.path);
    }
    const rel = out.map((p) => p.slice(dir.path.length + 1)).sort();
    expect(rel).toEqual([".config/fish/config.fish", ".env.example", ".zshrc"]);
  });

  test("yields directories that match include rules", async () => {
    await touch(".claude/settings.json");
    await touch(".bashrc");
    const scanner = createFsScannerRepository();
    const dirs: string[] = [];
    const files: string[] = [];
    for await (const e of scanner.scan({
      home: dir.path,
      include: [".*"],
      exclude: [],
    })) {
      const rel = e.path.slice(dir.path.length + 1);
      if (e.isDir) dirs.push(rel);
      else files.push(rel);
    }
    expect(dirs).toContain(".claude");
    expect(files).toContain(".bashrc");
    // `.*` must not cross slashes — so `.claude/settings.json` is not yielded.
    expect(files).not.toContain(".claude/settings.json");
  });

  test("skips .git and node_modules", async () => {
    await touch(".zshrc");
    await touch(".git/HEAD");
    await touch("node_modules/foo/index.js");
    const scanner = createFsScannerRepository();
    const out: string[] = [];
    for await (const e of scanner.scan({
      home: dir.path,
      include: ["**/*"],
      exclude: [],
    })) {
      if (e.isDir) continue;
      out.push(e.path);
    }
    const rel = out.map((p) => p.slice(dir.path.length + 1));
    expect(rel).toContain(".zshrc");
    expect(rel.find((r) => r.startsWith(".git"))).toBeUndefined();
    expect(rel.find((r) => r.startsWith("node_modules"))).toBeUndefined();
  });
});

describe("FsScannerRepository.siblings", () => {
  test("returns siblings under parent dir excluding the input file", async () => {
    const target = await touch(".config/fish/config.fish");
    await touch(".config/fish/functions/greet.fish");
    await touch(".config/fish/conf.d/aliases.fish");
    const scanner = createFsScannerRepository();
    const r = await scanner.siblings({ path: target, depth: 4 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rel = [...r.value].map((p) => p.slice(dir.path.length + 1)).sort();
    expect(rel).toEqual([".config/fish/conf.d/aliases.fish", ".config/fish/functions/greet.fish"]);
  });

  test("returns IoError when parent dir does not exist", async () => {
    const scanner = createFsScannerRepository();
    const r = await scanner.siblings({
      path: join(dir.path, "nope/here.txt"),
      depth: 4,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("IoError");
  });
});
