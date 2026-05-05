import {
  array,
  boolean,
  type Infer,
  literal,
  object,
  optional,
  type Schema,
  string,
  union,
} from "./schema";

export const VcsKindSchema: Schema<"jj"> = literal("jj");
export type VcsKind = Infer<typeof VcsKindSchema>;

export const IntervalSchema: Schema<"hourly" | "daily" | "weekly"> = union([
  literal("hourly"),
  literal("daily"),
  literal("weekly"),
]);
export type Interval = Infer<typeof IntervalSchema>;

export const PathsSchema = object({
  home: string(),
  dotfiles: string(),
  backup: string(),
});
export type Paths = Infer<typeof PathsSchema>;

export const DiscoverySchema = object({
  auto_track: boolean(),
  include: array(string()),
  exclude: array(string()),
});
export type Discovery = Infer<typeof DiscoverySchema>;

export const OptionsSchema = object({
  vcs: VcsKindSchema,
  auto_commit: boolean(),
  auto_sync: boolean(),
  auto_sync_interval: IntervalSchema,
  remote: optional(string()),
});
export type Options = Infer<typeof OptionsSchema>;

export const ExperimentalSchema = object({
  detect_api_keys: boolean(),
});
export type Experimental = Infer<typeof ExperimentalSchema>;

export const ConfigSchema = object({
  path: PathsSchema,
  discovery: DiscoverySchema,
  options: OptionsSchema,
  experimental: ExperimentalSchema,
});
export type Config = Infer<typeof ConfigSchema>;

/**
 * README default config, byte-identical to the documented template.
 *
 * MUST round-trip with `serializeConfig(defaultConfig())` (asserted by the
 * config repository test suite).
 */
export const DEFAULT_CONFIG_TEXT = `[path]
home = "$HOME"
dotfiles = "$HOME/dotfiles"
backup = "$HOME/.dotfiles.bak"

[discovery]
auto_track = true
include = [".config/**/*", ".claude/**/*", ".zshrc"]
exclude = [".env*", "!.env.example"]

[options]
vcs = "jj"
auto_commit = true
auto_sync = true
auto_sync_interval = "daily"
remote = ""

[experimental]
detect_api_keys = true
`;

/** Parsed default config with `$HOME` placeholders left untouched. */
export function defaultConfig(): Config {
  return {
    path: {
      home: "$HOME",
      dotfiles: "$HOME/dotfiles",
      backup: "$HOME/.dotfiles.bak",
    },
    discovery: {
      auto_track: true,
      include: [".config/**/*", ".claude/**/*", ".zshrc"],
      exclude: [".env*", "!.env.example"],
    },
    options: {
      vcs: "jj",
      auto_commit: true,
      auto_sync: true,
      auto_sync_interval: "daily",
      remote: "",
    },
    experimental: {
      detect_api_keys: true,
    },
  };
}
