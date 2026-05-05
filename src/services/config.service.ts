import { type Config, ConfigSchema } from "../domain/config";
import { err, ok, type Result } from "../lib/result";
import type { ConfigRepository } from "../repositories/types";
import type { ServiceError } from "./types";

export const KNOWN_OPTIONS: ReadonlySet<string> = new Set([
  "path.home",
  "path.dotfiles",
  "path.backup",
  "path.cache",
  "discovery.auto_track",
  "discovery.include",
  "discovery.exclude",
  "options.vcs",
  "options.auto_commit",
  "options.auto_sync",
  "options.auto_sync_interval",
  "options.remote",
  "experimental.detect_api_keys",
]);

export interface ConfigService {
  loadOrInit(): Promise<Result<Config, ServiceError>>;
  current(): Config | null;
  get(option: string): Result<unknown, ServiceError>;
  set(option: string, value: unknown): Promise<Result<Config, ServiceError>>;
}

export function createConfigService(deps: {
  repo: ConfigRepository;
  defaults: () => Config;
}): ConfigService {
  let cached: Config | null = null;

  function notLoaded(): { tag: "NotFound"; resource: string; id: string } {
    return { tag: "NotFound", resource: "Config", id: "(unloaded)" };
  }

  function readDotted(cfg: Config, option: string): Result<unknown, ServiceError> {
    const parts = option.split(".");
    let cursor: unknown = cfg;
    for (const part of parts) {
      if (typeof cursor !== "object" || cursor === null || !(part in cursor)) {
        return err({ tag: "NotFound", resource: "ConfigOption", id: option });
      }
      cursor = (cursor as Record<string, unknown>)[part];
    }
    return ok(cursor);
  }

  function withSet(cfg: Config, option: string, value: unknown): Config {
    const [section, key] = option.split(".");
    const sectionKey = section as keyof Config;
    const sectionObj = cfg[sectionKey] as Record<string, unknown>;
    const nextSection = { ...sectionObj, [key as string]: value };
    return { ...cfg, [sectionKey]: nextSection } as Config;
  }

  return {
    async loadOrInit() {
      const r = await deps.repo.load();
      if (r.ok) {
        cached = r.value;
        return ok(cached);
      }
      if (r.error.tag === "NotFound") {
        const cfg = deps.defaults();
        const w = await deps.repo.save(cfg);
        if (!w.ok) return err({ tag: "Repository", cause: w.error });
        cached = cfg;
        return ok(cached);
      }
      return err({ tag: "Repository", cause: r.error });
    },
    current() {
      return cached;
    },
    get(option) {
      if (cached === null) return err(notLoaded());
      return readDotted(cached, option);
    },
    async set(option, value) {
      if (cached === null) return err(notLoaded());
      if (!KNOWN_OPTIONS.has(option)) {
        return err({ tag: "NotFound", resource: "ConfigOption", id: option });
      }
      const candidate = withSet(cached, option, value);
      const parsed = ConfigSchema["~standard"].validate(candidate);
      if (parsed.issues !== undefined) {
        return err({ tag: "Validation", issues: parsed.issues });
      }
      const w = await deps.repo.save(parsed.value);
      if (!w.ok) return err({ tag: "Repository", cause: w.error });
      cached = parsed.value;
      return ok(cached);
    },
  };
}
