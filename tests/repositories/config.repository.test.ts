import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DEFAULT_CONFIG_TEXT, defaultConfig } from "../../src/domain/config";
import { createConfigRepository, serializeConfig } from "../../src/repositories/config.repository";
import { withTmpDir } from "../test-utils/tmp";

describe("ConfigRepository (TOML)", () => {
  test("serializeConfig(defaultConfig()) === DEFAULT_CONFIG_TEXT", () => {
    expect(serializeConfig(defaultConfig())).toBe(DEFAULT_CONFIG_TEXT);
  });

  test("load() returns NotFound for missing file", async () => {
    await withTmpDir(async ({ path }) => {
      const repo = createConfigRepository(join(path, "config.toml"));
      const r = await repo.load();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe("NotFound");
    });
  });

  test("load() returns ParseError for malformed TOML", async () => {
    await withTmpDir(async ({ path }) => {
      const file = join(path, "config.toml");
      await writeFile(file, "[unterminated\n");
      const repo = createConfigRepository(file);
      const r = await repo.load();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.tag).toBe("ParseError");
    });
  });

  test("load() returns ParseError for schema mismatch", async () => {
    await withTmpDir(async ({ path }) => {
      const file = join(path, "config.toml");
      const bad = DEFAULT_CONFIG_TEXT.replace("auto_track = true", 'auto_track = "yes"');
      await writeFile(file, bad);
      const repo = createConfigRepository(file);
      const r = await repo.load();
      expect(r.ok).toBe(false);
      if (!r.ok && r.error.tag === "ParseError") {
        expect(
          r.error.issues.some((i) => (i.path ?? []).join(".") === "discovery.auto_track"),
        ).toBe(true);
      } else {
        throw new Error("expected ParseError");
      }
    });
  });

  test("save() then load() round-trips defaults", async () => {
    await withTmpDir(async ({ path }) => {
      const file = join(path, "config.toml");
      const repo = createConfigRepository(file);
      const w = await repo.save(defaultConfig());
      expect(w.ok).toBe(true);
      const r = await repo.load();
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual(defaultConfig());
    });
  });

  test("save() creates missing parent directories", async () => {
    await withTmpDir(async ({ path }) => {
      const file = join(path, "nested", "deeper", "config.toml");
      const repo = createConfigRepository(file);
      const w = await repo.save(defaultConfig());
      expect(w.ok).toBe(true);
      expect(await Bun.file(file).exists()).toBe(true);
    });
  });

  test("escapes special characters round-trip", async () => {
    await withTmpDir(async ({ path }) => {
      const file = join(path, "x.toml");
      await mkdir(dirname(file), { recursive: true });
      const repo = createConfigRepository(file);
      const cfg = defaultConfig();
      cfg.path.home = 'a"b\\c\nd';
      const w = await repo.save(cfg);
      expect(w.ok).toBe(true);
      const r = await repo.load();
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.path.home).toBe('a"b\\c\nd');
    });
  });
});
