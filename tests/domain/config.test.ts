import { describe, expect, test } from "bun:test";
import { ConfigSchema, DEFAULT_CONFIG_TEXT, defaultConfig } from "../../src/domain/config";

describe("Config domain schemas", () => {
  test("defaultConfig() validates against ConfigSchema", () => {
    const cfg = defaultConfig();
    const r = ConfigSchema["~standard"].validate(cfg);
    expect(r.issues).toBeUndefined();
    expect(r.value).toEqual(cfg);
  });

  test("DEFAULT_CONFIG_TEXT parses into the same shape as defaultConfig()", () => {
    const parsed = Bun.TOML.parse(DEFAULT_CONFIG_TEXT);
    const r = ConfigSchema["~standard"].validate(parsed);
    expect(r.issues).toBeUndefined();
    expect(r.value).toEqual(defaultConfig());
  });

  test("rejects missing path.home", () => {
    const cfg = defaultConfig() as unknown as Record<string, unknown>;
    const path = { ...(cfg["path"] as Record<string, unknown>) };
    delete path["home"];
    const r = ConfigSchema["~standard"].validate({ ...cfg, path });
    expect(r.issues).toBeDefined();
    expect(r.issues!.some((i) => (i.path ?? []).join(".") === "path.home")).toBe(true);
  });

  test("rejects non-jj vcs", () => {
    const cfg = defaultConfig();
    const broken = {
      ...cfg,
      options: { ...cfg.options, vcs: "git" as unknown as "jj" },
    };
    const r = ConfigSchema["~standard"].validate(broken);
    expect(r.issues).toBeDefined();
  });

  test("rejects non-array discovery.include", () => {
    const cfg = defaultConfig() as unknown as Record<string, unknown>;
    const discovery = { ...(cfg["discovery"] as Record<string, unknown>), include: "x" };
    const r = ConfigSchema["~standard"].validate({ ...cfg, discovery });
    expect(r.issues).toBeDefined();
  });

  test("rejects unknown auto_sync_interval", () => {
    const cfg = defaultConfig();
    const broken = {
      ...cfg,
      options: { ...cfg.options, auto_sync_interval: "yearly" as never },
    };
    const r = ConfigSchema["~standard"].validate(broken);
    expect(r.issues).toBeDefined();
  });

  test("defaultConfig() returns independent instances", () => {
    const a = defaultConfig();
    const b = defaultConfig();
    a.discovery.include.push("MUTATED");
    expect(b.discovery.include).not.toContain("MUTATED");
  });
});
