# Spec: `ConfigRepository` (TOML)

- Source bean: `ldf-52mx`
- Parent epic: `ldf-hia6`
- References: PRD §F1, ADR-001 §4.3, CONSTITUTION §2.1, §4 (Bun builtins)

## Goal

Single source of TOML I/O for `config.toml`. Reads validate against `ConfigSchema`; writes serialize a `Config` deterministically. Returns `Result<…, RepoError>` exclusively — no naked throws cross the layer.

## Public surface

```ts
// src/repositories/types.ts (extended)
import type { StandardSchemaV1 } from "../domain/schema";
import type { Config } from "../domain/config";
import type { Result } from "../lib/result";

export type RepoError =
  | { readonly tag: "NotFound"; readonly path: string }
  | {
      readonly tag: "ParseError";
      readonly path: string;
      readonly issues: readonly StandardSchemaV1.Issue[];
    }
  | { readonly tag: "IoError"; readonly path: string; readonly cause: unknown };

export interface ConfigRepository {
  readonly kind: "ConfigRepository";
  readonly path: string;
  load(): Promise<Result<Config, RepoError>>;
  save(config: Config): Promise<Result<void, RepoError>>;
}
```

```ts
// src/repositories/config.repository.ts
export function createConfigRepository(path: string): ConfigRepository;

/** Exposed for tests and the service's "write defaults" branch. */
export function serializeConfig(config: Config): string;
```

## Internal design

### `load()`

1. `const file = Bun.file(path)`. If `!(await file.exists())` → `err({ tag: "NotFound", path })`.
2. `const text = await file.text()`. Catch any throw → `err({ tag: "IoError", path, cause })`.
3. `let raw: unknown; try { raw = Bun.TOML.parse(text); } catch (cause) { return err({ tag: "ParseError", path, issues: [{ message: String((cause as Error).message ?? cause) }] }); }`
4. `const parsed = ConfigSchema["~standard"].validate(raw);` If `parsed.issues` → `err({ tag: "ParseError", path, issues: parsed.issues })`.
5. `return ok(parsed.value)`.

### `save(config)`

1. `const text = serializeConfig(config)`.
2. Ensure parent dir exists: `await mkdir(dirname(path), { recursive: true })` via `node:fs/promises` (Bun has no equivalent today).
3. `await Bun.write(path, text)`. Any throw → `err({ tag: "IoError", path, cause })`.
4. `return ok(undefined)`.

### `serializeConfig`

Deterministic emitter for the exact `Config` shape:

- Sections in fixed order: `path`, `discovery`, `options`, `experimental`.
- Keys within each section in fixed order matching `defaultConfig()`.
- Strings: double-quoted, with `\\`, `\"`, `\n`, `\r`, `\t` escaped.
- Booleans: `true` / `false` lowercase.
- `string[]`: inline `["a", "b", "c"]`.
- Trailing newline on the file.

The output of `serializeConfig(defaultConfig())` **MUST** equal `DEFAULT_CONFIG_TEXT` byte-for-byte; this is asserted by a test.

## Dependencies

- `src/domain/config.ts` (`ConfigSchema`, `Config`, `DEFAULT_CONFIG_TEXT`, `defaultConfig`).
- `src/lib/result.ts`.
- Bun builtins: `Bun.file`, `Bun.write`, `Bun.TOML.parse`.
- `node:fs/promises` (`mkdir`) and `node:path` (`dirname`) — exempted by ADR-001 §4.3 ("only where Bun lacks the operation").

## Tests

`tests/repositories/config.repository.test.ts` (uses `withTmpDir` from `src/test-utils/tmp.ts`):

- **missing file** → `load()` returns `err({ tag: "NotFound" })`.
- **malformed TOML** (e.g. `"["`) → `load()` returns `err({ tag: "ParseError" })`.
- **schema mismatch** (valid TOML but `auto_track = "yes"`) → `load()` returns `err({ tag: "ParseError" })` whose `issues` mention `discovery.auto_track`.
- **round-trip**: `save(defaultConfig())` then `load()` deep-equals `defaultConfig()`.
- **serialize default equals README**: `serializeConfig(defaultConfig()) === DEFAULT_CONFIG_TEXT`.
- **save creates parent dirs**: `save` to a path under a nonexistent subdirectory succeeds and the file exists.
- **IoError on permission failure**: a save against a read-only parent returns `err({ tag: "IoError" })` (skipped if not running as a non-root user; assert behavior conditionally).

## Acceptance

- `src/repositories/types.ts` exports the surface above.
- `src/repositories/config.repository.ts` exports `createConfigRepository` and `serializeConfig`.
- All tests pass under `bun test`.
- No other module reads or writes TOML directly — every caller goes through `ConfigRepository`.

## Review

- PRD §F1, §6, §7.1, A1 coverage verified across this spec set.
- Inter-spec interfaces (ConfigService ↔ BootstrapService ↔ ConfigRepository ↔ FsRepository ↔ JjRepository ↔ config actor) typecheck on paper.
- No duplicated abstractions; default-config literal lives only in `domain/config.ts`.
- Constitution §6 non-negotiables respected: no process.exit, no width/height for layout flow, schemas at every boundary, Result returns.
- Approved for implementation.
