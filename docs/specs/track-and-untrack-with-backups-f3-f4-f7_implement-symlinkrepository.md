# Spec — `SymlinkRepository`

- **Source bean:** `ldf-gedy`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §F3 step 4](../prds/001_mvp.md), [PRD §F4](../prds/001_mvp.md), [ADR-001 §4.3](../adrs/001_project.md).

## Goal

The single repository allowed to create or remove symlinks. Encapsulates `node:fs/promises.symlink`, `lstat`, `readlink`, `unlink` so service code never touches them directly.

## Public surface

File: `src/repositories/symlink.repository.ts`.

```ts
import type { Result } from "../lib/result";
import type { RepoError } from "./types";

export interface SymlinkInfo {
  /** Resolved (absolute) target. Empty string for a non-symlink (callers should branch on `kind`). */
  readonly target: string;
}

export interface SymlinkRepository {
  readonly kind: "SymlinkRepository";
  /**
   * Create a symlink at `link` pointing to `target`. Fails with `IoError` if `link` exists.
   * The caller (track service) is responsible for unlinking any pre-existing entry first;
   * this repository does NOT silently overwrite.
   */
  materialize(input: { target: string; link: string }): Promise<Result<void, RepoError>>;
  /**
   * Remove a symlink at `path`. ENOENT collapses to `ok(undefined)` (idempotent for the
   * rollback path); a non-symlink at `path` returns `IoError` (refuses to delete real files).
   */
  unlink(path: string): Promise<Result<void, RepoError>>;
  /** Resolve the link target. Errors if `path` is not a symlink. */
  read(path: string): Promise<Result<SymlinkInfo, RepoError>>;
  /**
   * True iff `path` is a symlink whose absolute target lies inside `dotfilesRoot`.
   * Uses `path.resolve(dirname(path), readlink(path))` so relative links resolve correctly.
   * False (not error) for missing path or non-symlink.
   */
  isLdfSymlink(input: { path: string; dotfilesRoot: string }): Promise<Result<boolean, RepoError>>;
}

export function createSymlinkRepository(): SymlinkRepository;
```

## Internal design

- All operations are thin wrappers around `node:fs/promises` (Bun has no symlink primitive).
- **`materialize`**:
  - `lstat(link)` first; if it returns (any kind), → `IoError` with cause `"link path already exists"`.
  - `ENOENT` → proceed with `symlink(target, link)`.
  - On `EXDEV`/permission errors → `IoError`.
- **`unlink`**:
  - `lstat(path)`. `ENOENT` → `ok(undefined)`.
  - If not a symlink → `IoError({path, cause: new Error("refusing to unlink non-symlink")})`.
  - Otherwise `unlink(path)` (the `node:fs/promises` call).
- **`read`**: `lstat`; if `!isSymbolicLink()` → `IoError`. Otherwise `readlink(path)` → `ok({target})`.
- **`isLdfSymlink`**:
  - `lstat(path)`. `ENOENT` → `ok(false)`. Non-symlink → `ok(false)`.
  - `target = readlink(path)`; if relative, `resolve(dirname(path), target)`; else use as-is.
  - Return `ok(resolved.startsWith(dotfilesRoot + sep) || resolved === dotfilesRoot)`.

## Dependencies

- `src/repositories/types.ts` (`RepoError`).
- `src/lib/result.ts`.
- `node:fs/promises`, `node:path`.

## Tests

`src/repositories/symlink.repository.test.ts` (integration, tmp dir):

- `materialize` creates a symlink; `read` returns the same target.
- `materialize` errors when `link` already exists (regular file, dir, or symlink).
- `unlink` removes a symlink; subsequent `read` errors `IoError` (or `NotFound`-shaped path).
- `unlink` of a regular file errors and the file remains on disk.
- `unlink` of a missing path returns `ok(undefined)` (idempotent).
- `read` of a non-symlink errors.
- `isLdfSymlink` returns `true` for a link pointing inside `dotfilesRoot`, `false` for one outside, `false` for missing path, `false` for a regular file.
- `isLdfSymlink` resolves relative link targets against the link's parent dir.

## Acceptance

- The only place symlinks are created or removed in the codebase (verified by `ast-grep` for `symlink(`/`unlink(` outside this file in services/views — none expected).
- All tests green.

## Review

Approved. `unlink` refuses non-symlinks — this prevents the rollback path from accidentally deleting the user's restored file. `materialize` does not auto-overwrite — the track service handles the move-then-symlink ordering explicitly so partial states are observable.
