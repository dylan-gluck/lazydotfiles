# Spec: `BootstrapService`

- Source bean: `ldf-f2ib`
- Parent epic: `ldf-hia6`
- References: PRD §F1 + §7.1 + A1, ADR-001 §4.4, CONSTITUTION §1.2 ("Repository MUST be the only path to persistence")

## Goal

Idempotent first-run orchestrator. Loads or initializes config, ensures `path.dotfiles` is a colocated `jj git init` repo, and ensures `path.backup` exists. Returns a typed `BootstrapOutcome`; never calls `process.exit`.

## Public surface

```ts
// src/services/bootstrap.service.ts
import type { Config } from "../domain/config";
import type { Result } from "../lib/result";
import type { ConfigService } from "./config.service";
import type { ServiceError } from "./types";
import type { FsRepository } from "../repositories/fs.repository";
import type { JjRepository } from "../repositories/vcs.repository";

export interface BootstrapOutcome {
  readonly config: Config;
  /** True when bootstrap had to create something (config, repo, or backup dir). */
  readonly initialized: boolean;
}

export interface BootstrapService {
  run(): Promise<Result<BootstrapOutcome, ServiceError>>;
}

export function createBootstrapService(deps: {
  config: ConfigService;
  jj: JjRepository;
  fs: FsRepository;
}): BootstrapService;
```

New repository seeds (minimal surfaces this epic needs; future epics extend):

```ts
// src/repositories/fs.repository.ts
import type { Result } from "../lib/result";
import type { RepoError } from "./types";

export interface FsRepository {
  readonly kind: "FsRepository";
  exists(path: string): Promise<Result<boolean, RepoError>>;
  ensureDir(path: string): Promise<Result<{ created: boolean }, RepoError>>;
}

export function createFsRepository(): FsRepository;
```

```ts
// src/repositories/vcs.repository.ts
import type { Result } from "../lib/result";
import type { RepoError } from "./types";

export interface JjRepository {
  readonly kind: "JjRepository";
  /** True iff `<path>/.jj/` exists. Does not validate repo health. */
  isRepo(path: string): Promise<Result<boolean, RepoError>>;
  /** Run `jj git init <path>` (colocated). Creates the dir if missing. */
  initColocated(path: string): Promise<Result<void, RepoError>>;
}

export function createJjRepository(): JjRepository;
```

## Internal design

### `BootstrapService.run`

1. `const cfg = await deps.config.loadOrInit()`. On err → return `err(cfg.error)`.
2. `let initialized = false`.
3. **Dotfiles repo**:
   - `const present = await deps.jj.isRepo(cfg.value.path.dotfiles)`. On err → `err({ tag: "Repository", cause })`.
   - If `!present.value` → `const init = await deps.jj.initColocated(cfg.value.path.dotfiles)`; on err → `err({ tag: "Repository", cause })`; set `initialized = true`.
4. **Backup dir**:
   - `const ensure = await deps.fs.ensureDir(cfg.value.path.backup)`. On err → `err({ tag: "Repository", cause })`. If `ensure.value.created` → `initialized = true`.
5. Return `ok({ config: cfg.value, initialized })`.

### `FsRepository`

- `exists(p)` uses `Bun.file(p).exists()` and falls back to `node:fs/promises.stat` for directories (since `Bun.file` reports `false` on directories on some platforms; wrap defensively).
- `ensureDir(p)` calls `node:fs/promises.mkdir(p, { recursive: true })`. Detect "already existed" by `stat` before the call: returns `{ created: !preExisted }`. Failure → `IoError`.

### `JjRepository`

- `isRepo(p)`: stat `${p}/.jj`. Exists → `ok(true)`. ENOENT (or parent ENOENT) → `ok(false)`. Other error → `IoError`.
- `initColocated(p)`:
  1. `mkdir -p` parent of `p`.
  2. `Bun.spawn(["jj", "git", "init", p], { stdout: "pipe", stderr: "pipe" })`.
  3. `await proc.exited`. If exit code !== 0 → `err({ tag: "IoError", path: p, cause: { stderr: text } })`.
  4. Return `ok(undefined)`.

The `jj` binary is required on `PATH`; tests assert via `Bun.which("jj")` before running and skip with a clear message if absent (acceptable: the project itself uses jj, so dev/CI machines have it).

## Dependencies

- `src/services/config.service.ts`.
- `src/repositories/types.ts` (`RepoError`).
- `src/repositories/fs.repository.ts`, `src/repositories/vcs.repository.ts` (this spec creates both).
- Bun builtins: `Bun.file`, `Bun.spawn`, `Bun.which`.
- `node:fs/promises` (`mkdir`, `stat`).

## Tests

`tests/services/bootstrap.service.test.ts` (integration, real `jj`, real fs in tmp dir from `withTmpDir`):

- **clean tmp HOME**: with `home = tmp`, `paths` pointing under `tmp`, `run()` returns `ok({ initialized: true })`; assertions:
  - `${tmp}/.config/lazydotfiles/config.toml` exists and parses back to `defaultConfig()` (with `$HOME` expanded to `tmp`).
  - `${tmp}/dotfiles/.jj/` exists.
  - `${tmp}/.dotfiles.bak/` exists.
- **second run is no-op**: a second `run()` against the same tmp HOME returns `ok({ initialized: false })` and touches no files (mtimes unchanged on the config and `.jj/`).
- **failure surfaces typed error**: a tmp HOME where `path.dotfiles` is set to a path inside a read-only parent returns `err({ tag: "Repository" })`; nothing is partially written.
- **jj missing**: when `Bun.which("jj") === null` the test is skipped with a `console.warn`; CI must have jj.

`tests/repositories/fs.repository.test.ts` and `tests/repositories/vcs.repository.test.ts` cover the small surfaces directly:

- `FsRepository.exists` / `ensureDir` happy path, idempotency, IoError on permission failure.
- `JjRepository.isRepo` returns `false` on a non-repo dir, `true` after `initColocated`.
- `JjRepository.initColocated` against an empty dir produces a `.jj/` directory and exit 0.

## Acceptance

- All three files exist with the surfaces above.
- All tests pass under `bun test` (with `jj` on PATH).
- PRD A1 holds end-to-end against a tmp HOME: see "Manual A1 scenario via tmp HOME" in the validate phase.
- `BootstrapService.run` never calls `process.exit`; failure exclusively flows through the `Result`.

## Review

- PRD §F1, §6, §7.1, A1 coverage verified across this spec set.
- Inter-spec interfaces (ConfigService ↔ BootstrapService ↔ ConfigRepository ↔ FsRepository ↔ JjRepository ↔ config actor) typecheck on paper.
- No duplicated abstractions; default-config literal lives only in `domain/config.ts`.
- Constitution §6 non-negotiables respected: no process.exit, no width/height for layout flow, schemas at every boundary, Result returns.
- Approved for implementation.
