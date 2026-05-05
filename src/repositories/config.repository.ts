import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type Config, ConfigSchema } from "../domain/config";
import { err, ok, type Result } from "../lib/result";
import type { ConfigRepository, RepoError } from "./types";

const SECTION_ORDER = ["path", "discovery", "options", "experimental"] as const;
const KEY_ORDER: Record<(typeof SECTION_ORDER)[number], readonly string[]> = {
  path: ["home", "dotfiles", "backup"],
  discovery: ["auto_track", "include", "exclude"],
  options: ["vcs", "auto_commit", "auto_sync", "auto_sync_interval", "remote"],
  experimental: ["detect_api_keys"],
};

function escapeString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function formatValue(v: unknown): string {
  if (typeof v === "string") return `"${escapeString(v)}"`;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "0";
  if (Array.isArray(v)) {
    const parts = v.map((x) => formatValue(x));
    return `[${parts.join(", ")}]`;
  }
  // Defensive: caller is constrained by ConfigSchema, so this branch is unreachable
  // for a validated Config. Preserve truth: emit an empty array rather than guess.
  return JSON.stringify(v);
}

export function serializeConfig(config: Config): string {
  const lines: string[] = [];
  for (let i = 0; i < SECTION_ORDER.length; i++) {
    const section = SECTION_ORDER[i]!;
    if (i > 0) lines.push("");
    lines.push(`[${section}]`);
    const keys = KEY_ORDER[section];
    const obj = config[section] as Record<string, unknown>;
    for (const key of keys) {
      const value = obj[key];
      if (value === undefined) continue;
      lines.push(`${key} = ${formatValue(value)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function createConfigRepository(path: string): ConfigRepository {
  return {
    kind: "ConfigRepository",
    path,
    async load(): Promise<Result<Config, RepoError>> {
      const file = Bun.file(path);
      if (!(await file.exists())) {
        return err({ tag: "NotFound", path });
      }
      let text: string;
      try {
        text = await file.text();
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
      let raw: unknown;
      try {
        raw = Bun.TOML.parse(text);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return err({ tag: "ParseError", path, issues: [{ message }] });
      }
      const parsed = ConfigSchema["~standard"].validate(raw);
      if (parsed.issues !== undefined) {
        return err({ tag: "ParseError", path, issues: parsed.issues });
      }
      return ok(parsed.value);
    },
    async save(config): Promise<Result<void, RepoError>> {
      const text = serializeConfig(config);
      try {
        await mkdir(dirname(path), { recursive: true });
        await Bun.write(path, text);
        return ok(undefined);
      } catch (cause) {
        return err({ tag: "IoError", path, cause });
      }
    },
  };
}
