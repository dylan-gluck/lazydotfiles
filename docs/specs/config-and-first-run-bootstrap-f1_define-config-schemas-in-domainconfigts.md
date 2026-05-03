# Spec: `Config` schemas in `domain/config.ts`

- Source bean: `ldf-w0h2`
- Parent epic: `ldf-hia6`
- References: PRD §6 (domain model), README "Configuration", CONSTITUTION §1.4, ADR-001 §4.2

## Goal

Provide schema-first definitions for `Config` and its child aggregates (`Paths`, `Discovery`, `Options`, `Experimental`, `VcsKind`, `Interval`) plus a frozen `DEFAULT_CONFIG_TEXT` and `DEFAULT_CONFIG` factory. Every other layer derives types from these schemas.

## Public surface

```ts
// src/domain/config.ts
import { array, boolean, literal, object, string, union, type Infer, type Schema } from "./schema";

export const VcsKindSchema: Schema<"jj">;
export type VcsKind = Infer<typeof VcsKindSchema>;

export const IntervalSchema: Schema<"hourly" | "daily" | "weekly">;
export type Interval = Infer<typeof IntervalSchema>;

export const PathsSchema: Schema<{ home: string; dotfiles: string; backup: string }>;
export type Paths = Infer<typeof PathsSchema>;

export const DiscoverySchema: Schema<{
  auto_track: boolean;
  include: string[];
  exclude: string[];
}>;
export type Discovery = Infer<typeof DiscoverySchema>;

export const OptionsSchema: Schema<{
  vcs: VcsKind;
  auto_commit: boolean;
  auto_sync: boolean;
  auto_sync_interval: Interval;
}>;
export type Options = Infer<typeof OptionsSchema>;

export const ExperimentalSchema: Schema<{ detect_api_keys: boolean }>;
export type Experimental = Infer<typeof ExperimentalSchema>;

export const ConfigSchema: Schema<{
  path: Paths;
  discovery: Discovery;
  options: Options;
  experimental: Experimental;
}>;
export type Config = Infer<typeof ConfigSchema>;

/** README default config, byte-identical to the documented template. */
export const DEFAULT_CONFIG_TEXT: string;

/** Parsed default config with `$HOME` placeholders left untouched. */
export function defaultConfig(): Config;
```

`DEFAULT_CONFIG_TEXT` mirrors README exactly:

```toml
[path]
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

[experimental]
detect_api_keys = true
```

`defaultConfig()` returns the parsed shape with raw `$HOME` strings; expansion is the service's responsibility.

## Internal design

- All schemas built from primitives in `domain/schema.ts`. No new schema combinators are introduced; if a primitive is missing, the spec for `domain/schema.ts` must extend first.
- `VcsKindSchema = literal("jj")` — MVP-only; future ADR may widen to a union.
- `IntervalSchema = union([literal("hourly"), literal("daily"), literal("weekly")])`.
- `DEFAULT_CONFIG_TEXT` is a module-level frozen string constant (`Object.freeze` is unnecessary for primitives but the binding is `const`).
- `defaultConfig()` returns a fresh object each call (no shared mutable reference).

## Dependencies

- `src/domain/schema.ts` (existing). No external libs.

## Tests

`tests/domain/config.test.ts`:

- `ConfigSchema.validate(defaultConfig())` succeeds and returns deep-equal output.
- `Bun.TOML.parse(DEFAULT_CONFIG_TEXT)` validated through `ConfigSchema` produces the same shape as `defaultConfig()`.
- Schema rejects: missing `path.home`, wrong `vcs` value, non-array `include`, unknown `auto_sync_interval`.
- `defaultConfig()` returns independent instances (mutation of one does not affect a subsequent call).

## Acceptance

- File `src/domain/config.ts` exports the surface above.
- All tests pass under `bun test`.
- No other module duplicates the default-config literal — every consumer imports it from `domain/config.ts`.

## Review

- PRD §F1, §6, §7.1, A1 coverage verified across this spec set.
- Inter-spec interfaces (ConfigService ↔ BootstrapService ↔ ConfigRepository ↔ FsRepository ↔ JjRepository ↔ config actor) typecheck on paper.
- No duplicated abstractions; default-config literal lives only in `domain/config.ts`.
- Constitution §6 non-negotiables respected: no process.exit, no width/height for layout flow, schemas at every boundary, Result returns.
- Approved for implementation.
