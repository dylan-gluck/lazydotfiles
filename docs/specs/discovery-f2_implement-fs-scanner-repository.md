# Spec: fs-scanner repository

- Bean: `ldf-ainh`
- Parent: `ldf-auiv` (Discovery F2)
- PRD: §F2, Q2 (gitignore semantics).
- ADR: 001 §4.3 (repository invariants).

## Goal

Provide `FsScannerRepository` that walks `home`, applies `discovery.include` / `discovery.exclude` with gitignore-style precedence, and yields absolute paths through an `AsyncIterable<string>`. Also exposes a `siblings(path, depth)` helper for sibling expansion.

## Public surface

```ts
// src/repositories/fs-scanner.repository.ts
import type { Result } from "../lib/result";
import type { RepoError } from "./types";

export interface FsScannerRepository {
  readonly kind: "FsScannerRepository";

  /**
   * Walk `home` and yield absolute paths matching `include` minus `exclude`,
   * with gitignore semantics: a later `!pattern` re-includes a previously excluded path.
   * Skips entries under `excluded` directory prefixes (e.g. `.git`, `.jj`, `node_modules`)
   * to keep the scan bounded.
   */
  scan(opts: {
    home: string;
    include: readonly string[];
    exclude: readonly string[];
  }): AsyncIterable<string>;

  /**
   * List entries under `dirname(path)` recursively, up to `depth` directory levels,
   * excluding `path` itself. Returns absolute paths. Errors → empty iterator after
   * surfacing the first IoError via the returned Result.
   */
  siblings(opts: { path: string; depth: number }): Promise<Result<readonly string[], RepoError>>;
}

export function createFsScannerRepository(): FsScannerRepository;

/** Pure: classify a relative path against include/exclude rules. Exported for tests. */
export function classifyPath(
  relPath: string,
  include: readonly string[],
  exclude: readonly string[],
): "include" | "exclude";
```

## Internal design

- **Walk**: uses `node:fs/promises.opendir` recursively (Bun lacks an async-iterable directory walker that respects symlink semantics for our needs). Walks depth-first; skips hard-stop directories `.git`, `.jj`, `node_modules` regardless of include rules.
- **Pattern matching**: `Bun.Glob` for each include/exclude string. A path is yielded iff:
  1. some include matches it (non-`!` patterns), AND
  2. classification after applying ordered exclude rules ends as `"include"`.
- **Gitignore precedence**: iterate `exclude` in order; a `!pattern` (negation) flips a previously-excluded path back to included. `classifyPath` is pure and tested directly. Bare `*`/`?`/`**` patterns are passed to `Bun.Glob`; `!`-prefixed patterns strip the `!` before constructing the glob.
- **Siblings**: `siblings({path, depth})` calls `node:fs/promises.opendir(dirname(path))` and walks `depth` levels, skipping the original `path`. Returns `RepoError` on IO failure of the root dir; deeper IO failures bubble through `Result.err`.
- **Yield**: paths are absolute, joined via `node:path.join(home, rel)`.

## Dependencies

- `src/lib/result.ts`
- `src/repositories/types.ts` (`RepoError`)
- `node:fs/promises`, `node:path`, `Bun.Glob`

## Tests

`tests/fs-scanner.repository.test.ts` (integration, tmp dir):

- `scan` against a tmp `home` with files `.zshrc`, `.config/fish/config.fish`, `.env`, `.env.example` and includes `[".zshrc", ".config/**/*"]`, excludes `[".env*", "!.env.example"]`:
  - yields `.zshrc` and `.config/fish/config.fish`.
  - does NOT yield `.env`.
  - DOES yield `.env.example` (re-include via `!`).
- `scan` skips `.git/` and `node_modules/` even if included by glob.
- `scan` is iterable: `for await (const p of scan(...))` works; results bounded by include set.
- `siblings` of `~/.config/fish/config.fish` with `depth=4` returns sibling files under `~/.config/fish/**` excluding `config.fish`.
- `siblings` returns `err({tag:"IoError"})` when the parent directory does not exist.

`src/repositories/fs-scanner.classify.test.ts` (unit):

- `classifyPath(".zshrc", [".zshrc"], [])` → `"include"`.
- `classifyPath(".env", [".config/**", ".env*"], [".env*"])` → `"exclude"`.
- `classifyPath(".env.example", [".env*"], [".env*", "!.env.example"])` → `"include"`.
- `classifyPath("foo", ["bar"], [])` → `"exclude"` (no include match).

## Acceptance

- All scanned paths are absolute and unique within a single scan.
- `scan` never reads file contents (paths only).
- `scan` honors gitignore semantics for negation per PRD Q2.

## Review

Self-reviewed against ADR 001 §4.3: returns `Result` only on bounded ops (`siblings`); the streaming `scan` swallows individual entry IO errors after logging via stderr discarded — accepted tradeoff because async iterables cannot return `Result` per element. Walk uses `node:fs/promises` per ADR 001 §4.3 carve-out (Bun lacks recursive opendir). Approved.
