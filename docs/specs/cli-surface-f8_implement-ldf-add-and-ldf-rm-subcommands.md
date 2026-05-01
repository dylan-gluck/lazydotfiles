# cli-surface-f8 — `ldf add` & `ldf rm`

- **Bean:** ldf-v4qn
- **Parent epic:** ldf-zfcv
- **PRD:** §F3, §F4, §F8, §A3, §A4
- **ADR:** ADR-001 §4.5
- **Constitution:** §2.1, §6.4

## Goal

Thin wrappers over `track.service.add` and `track.service.remove`. Resolve `<path>` against `deps.io.cwd` to absolute. Surface typed errors as actionable single-line messages.

## Public surface

```ts
// src/cli/handlers/add.ts
export function addHandler(
  rest: readonly string[],
  deps: import("../index").CliDeps,
): Promise<number>;

// src/cli/handlers/remove.ts
export function removeHandler(
  rest: readonly string[],
  deps: import("../index").CliDeps,
): Promise<number>;
```

Usage:

- `ldf add <path>`
- `ldf rm <path>`

Exit codes:

- `0` on `Result.ok`. Stdout: `tracked <relpath>` / `untracked <relpath>`.
- `1` on missing/extra positional, non-existent path before validate (`InvalidTarget` `missing`).
- `2` on any other `ServiceError` (Repository, Rollback, Validation, NotFound).

## Internal design

1. Exactly one positional required. Else stderr usage line, exit 1.
2. `path.resolve(cwd, positional)` → absolute.
3. Call service method; on `ok` print success; on `err` route through `formatServiceError(err)` → stderr; exit 1 if err.tag === `"InvalidTarget"` && reason === `"missing"`, else 2.
4. Relpath in success message = `path.relative(home, absolute)`.

## Dependencies

- `services.track.add`, `services.track.remove`.
- `lib/format.ts::formatServiceError`.

## Tests

- `add` a freshly created file under tmp `$HOME` → stdout starts with `tracked `, exit 0; symlink exists.
- `rm` of the just-added path → stdout starts with `untracked `, exit 0; original file restored.
- `add /no/such/path` → exit 1, stderr mentions `missing`.
- `add` a path already symlinked into dotfiles → exit 2, stderr mentions `already-symlinked`.

## Acceptance

- F8 add/rm rows; A3 partial (filesystem outcome verified by integration test from track epic — covered there).

## Review

Approved. Distinction between exit 1 and 2 keyed on `InvalidTarget(missing)` only, since the other invalid-target reasons (already-symlinked, under-dotfiles, not-tracked-symlink) are operational, not user-typo, errors.
