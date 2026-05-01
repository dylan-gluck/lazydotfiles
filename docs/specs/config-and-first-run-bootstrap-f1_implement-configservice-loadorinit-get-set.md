# Spec: `ConfigService` (`loadOrInit`, `get`, `set`)

- Source bean: `ldf-2ny7`
- Parent epic: `ldf-hia6`
- References: PRD §F1 + §F8 (`ldf config [option]`), ADR-001 §4.4, CONSTITUTION §2.1

## Goal

Single business-logic owner of the loaded `Config`. Bootstraps the on-disk config from defaults when missing; offers typed `get`/`set` against dotted-path option keys; persists every mutation through `ConfigRepository`.

## Public surface

```ts
// src/services/types.ts (extended)
import type { StandardSchemaV1 } from "../domain/schema";
import type { RepoError } from "../repositories/types";

export type ServiceError =
  | { readonly tag: "NotFound"; readonly resource: string; readonly id: string }
  | { readonly tag: "Validation"; readonly issues: readonly StandardSchemaV1.Issue[] }
  | { readonly tag: "Repository"; readonly cause: RepoError };
```

```ts
// src/services/config.service.ts
import type { Config } from "../domain/config";
import type { Result } from "../lib/result";
import type { ConfigRepository } from "../repositories/types";
import type { ServiceError } from "./types";

export interface ConfigService {
  /**
   * Read config from disk; if absent, write expanded defaults and return them.
   * Caches the loaded config in-closure for subsequent get/set.
   */
  loadOrInit(): Promise<Result<Config, ServiceError>>;

  /** Current cached config or null if loadOrInit has not yet run. */
  current(): Config | null;

  /** Dotted-path read. Returns NotFound for unknown paths. */
  get(option: string): Result<unknown, ServiceError>;

  /**
   * Dotted-path write. Validates the candidate against `ConfigSchema`,
   * persists via repository, updates the cached config, and returns the
   * new full `Config`.
   */
  set(option: string, value: unknown): Promise<Result<Config, ServiceError>>;
}

export function createConfigService(deps: {
  repo: ConfigRepository;
  /** Caller-supplied default factory, already expanded against $HOME. */
  defaults: () => Config;
}): ConfigService;
```

Recognized option paths (validated by `set` against the schema; out-of-set paths produce `NotFound`):

```
path.home
path.dotfiles
path.backup
discovery.auto_track
discovery.include
discovery.exclude
options.vcs
options.auto_commit
options.auto_sync
options.auto_sync_interval
experimental.detect_api_keys
```

## Internal design

- The service holds `let cached: Config | null = null` in its factory closure (no module-level state per ADR-001 §4.4).
- `loadOrInit`:
  1. `const r = await repo.load()`.
  2. If `r.ok` → cache and return `ok(r.value)`.
  3. If `r.error.tag === "NotFound"` → `const cfg = deps.defaults()`; `const w = await repo.save(cfg)`; on failure return `err({ tag: "Repository", cause })`; cache and return `ok(cfg)`.
  4. Otherwise (`ParseError`, `IoError`) → `err({ tag: "Repository", cause })`. Do **not** silently overwrite a malformed file.
- `current()` returns `cached`.
- `get(option)`:
  1. If `cached === null` → `err({ tag: "NotFound", resource: "Config", id: "(unloaded)" })`.
  2. Split `option` on `.`; walk the cached object. If any segment misses, return `err({ tag: "NotFound", resource: "ConfigOption", id: option })`.
  3. Return `ok(value)`.
- `set(option, value)`:
  1. If `cached === null` → `err({ tag: "NotFound", resource: "Config", id: "(unloaded)" })`.
  2. Reject unknown option paths with `NotFound` (whitelist above).
  3. Build `next: Config` by structurally copying `cached` and replacing the leaf at `option`.
  4. Validate `next` via `ConfigSchema["~standard"].validate(next)`. On `issues` → `err({ tag: "Validation", issues })`.
  5. `await repo.save(next)`. On failure → `err({ tag: "Repository", cause })`.
  6. `cached = parsed.value`; return `ok(cached)`.

The service deliberately does **not** expand `$HOME` — `defaults()` is the seam for that, and the composition root supplies a defaults factory that has already expanded paths.

## Dependencies

- `src/domain/config.ts`.
- `src/repositories/types.ts` (`ConfigRepository`, `RepoError`).
- `src/lib/result.ts`.

## Tests

`tests/services/config.service.test.ts` (fake `ConfigRepository` — real implementation backed by an in-memory map, not a mock):

- **load missing → writes defaults**: repo reports NotFound; `loadOrInit()` returns `ok(defaults)`; subsequent `repo.load()` returns the same config.
- **load existing → returns parsed**: repo seeded with a config; `loadOrInit()` returns it without invoking `save`.
- **load parse error → Repository**: repo returns ParseError; `loadOrInit()` returns `err({ tag: "Repository" })` and does **not** overwrite the file.
- **current() reflects last loaded value**.
- **get(known path)**: returns `ok(value)` for `discovery.auto_track`.
- **get(unknown path)**: `experimental.nope` → `err(NotFound)`.
- **get before load**: returns `err(NotFound)` with `resource: "Config"`.
- **set valid**: `set("discovery.auto_track", false)` returns `ok(config')`; subsequent `get` returns `false`; the repo's stored bytes round-trip.
- **set wrong type**: `set("discovery.auto_track", "yes")` returns `err({ tag: "Validation" })`; cached config unchanged; repo unchanged.
- **set unknown path**: `set("nope.x", 1)` returns `err(NotFound)`.
- **set before load**: returns `err(NotFound)`.

## Acceptance

- `src/services/config.service.ts` exports the surface above.
- All tests pass under `bun test`.
- No consumer reads `Config` except via `ConfigService.current` / `loadOrInit` / `get`; nothing imports `ConfigRepository` outside the composition root and `bootstrap.service`.

## Review

- PRD §F1, §6, §7.1, A1 coverage verified across this spec set.
- Inter-spec interfaces (ConfigService ↔ BootstrapService ↔ ConfigRepository ↔ FsRepository ↔ JjRepository ↔ config actor) typecheck on paper.
- No duplicated abstractions; default-config literal lives only in `domain/config.ts`.
- Constitution §6 non-negotiables respected: no process.exit, no width/height for layout flow, schemas at every boundary, Result returns.
- Approved for implementation.
