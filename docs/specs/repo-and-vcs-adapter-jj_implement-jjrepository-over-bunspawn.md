# Spec — `jj.repository` over `Bun.spawn`

- **Source bean:** `ldf-slf8`
- **Parent epic:** `ldf-zf8l`
- **References:** [PRD §F5, §F6](../prds/001_mvp.md), [ADR-001 §4.3](../adrs/001_project.md), [CONSTITUTION §1.4, §4](../CONSTITUTION.md).

## Goal

Wrap the `jj` CLI behind a single typed surface so every higher layer reads/writes the dotfiles repo through one repository. Argument arrays only — never shell strings.

## Public surface

File: `src/repositories/jj.repository.ts`. **Renames** `src/repositories/vcs.repository.ts`; the public symbols `JjRepository`, `createJjRepository`, `isRepo`, `initColocated` survive verbatim so `bootstrap.service.ts` continues to compile without edit.

```typescript
import type { Operation, SyncState } from "../domain/repo";
import type { Result } from "../lib/result";
import type { RepoError } from "./types";

export interface JjRepository {
  readonly kind: "JjRepository";

  // Pre-existing surface (kept; used by bootstrap):
  isRepo(path: string): Promise<Result<boolean, RepoError>>;
  initColocated(path: string): Promise<Result<void, RepoError>>;

  // New surface for the adapter:
  describe(opts: { root: string; message: string }): Promise<Result<void, RepoError>>;
  snapshot(opts: { root: string }): Promise<Result<void, RepoError>>;
  opLog(opts: { root: string; limit?: number }): Promise<Result<readonly Operation[], RepoError>>;
  log(opts: { root: string; limit?: number }): Promise<Result<readonly Operation[], RepoError>>;
  opRestore(opts: { root: string; opId: string }): Promise<Result<void, RepoError>>;
  status(opts: { root: string }): Promise<Result<SyncState, RepoError>>;
  gitFetch(opts: { root: string }): Promise<Result<void, RepoError>>;
  gitPush(opts: { root: string }): Promise<Result<void, RepoError>>;
}

export function createJjRepository(): JjRepository;
```

Extends `RepoError` in `src/repositories/types.ts`:

```typescript
export type RepoError =
  | { readonly tag: "NotFound"; readonly path: string }
  | {
      readonly tag: "ParseError";
      readonly path: string;
      readonly issues: readonly StandardSchemaV1.Issue[];
    }
  | { readonly tag: "IoError"; readonly path: string; readonly cause: unknown }
  | {
      readonly tag: "Spawn";
      readonly command: readonly string[];
      readonly exitCode: number;
      readonly stderr: string;
    };
```

## Internal design

- A private helper `runJj(args: readonly string[], opts: { cwd?: string }): Promise<Result<{ stdout: string; stderr: string }, RepoError>>` wraps `Bun.spawn(["jj", ...args], { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, JJ_USER: "ldf", JJ_EMAIL: "ldf@local" } })`. Non-zero exit returns `{ tag: "Spawn", command: ["jj", ...args], exitCode, stderr }`. Spawn launch failure returns `IoError`.
  - The deterministic `JJ_USER`/`JJ_EMAIL` only override when the host environment lacks them, so user-configured identities pass through; this lets fresh tmp `$HOME`s in tests not blow up on `jj`'s "user not configured" error.
- `describe`: `["describe", "-m", message]` with `cwd: root`. Returns `ok(undefined)` on exit 0.
- `snapshot`: `["debug", "snapshot"]` with `cwd: root`. (`jj` snapshots automatically on most commands; explicit snapshot is the safe default and is the documented escape hatch.)
- `opLog`: `["op", "log", "--no-graph", "-T", TEMPLATE, "--limit", String(limit ?? 50)]` where `TEMPLATE` is a fixed `jj` template emitting one op per line as tab-separated `id\tparent\tdescription\tat\tfilesTouched(comma-joined)`. Stdout is split on newlines; each line parses through a small `parseOperationLine` helper into `Operation`. Parse failures → `ParseError`.
- `log`: `["log", "--no-graph", "-T", LOG_TEMPLATE, "--limit", String(limit ?? 50)]`, same shape.
- `opRestore`: `["op", "restore", opId]`.
- `status`: `["status"]` plus `["log", "-r", "@", "-T", "change_id"]` plus `["git", "remote", "list"]` to derive `{ dirty, ahead, behind, remote }`. `lastSyncAt` is sourced from the most recent op of kind `"sync"` in `opLog` (best-effort; null when none). The combined parser is private to the repository; the caller only sees the validated `SyncState`.
- `gitFetch`: `["git", "fetch"]`.
- `gitPush`: `["git", "push"]`.
- All parsed outputs validate through the schemas from `domain/repo.ts` before returning. A schema failure becomes `ParseError`.
- The repository **MUST NOT** print to stdout/stderr; logging is the caller's responsibility (a future `logger` actor).

### Templates

Two private constants live in the file — one for `op log`, one for `log`. They are Jujutsu template strings using literal field separators we never expect in real output (`\u001f` ASCII unit separator). The parser splits on `\u001f`; if the field count is wrong, `ParseError` is returned with an `issues` array describing which line failed.

## Dependencies

- `src/domain/repo.ts` (`OperationSchema`, `SyncStateSchema`, `parseOperationKind`).
- `src/repositories/types.ts` (extended `RepoError`).
- `Bun.spawn` (Bun builtin).

## Tests

Pure-unit tests on the parser go in `src/repositories/jj.repository.parse.test.ts`:

- A canonical `op log` line parses into the expected `Operation`.
- An empty `filesTouched` field parses into `[]`.
- A line with the wrong field count returns `ParseError`.
- `parseOperationKind` integration: `"track .zshrc"` description yields `kind: "track"`.

The end-to-end integration tests against a real `jj` binary are owned by `ldf-9mrb`.

## Acceptance

- All listed methods present, return `Promise<Result<T, RepoError>>`, accept argument arrays.
- `bootstrap.service.ts` continues to compile (`isRepo`, `initColocated` preserved).
- Parser unit tests green.

## Review

Approved. Renaming `vcs.repository.ts` → `jj.repository.ts` is the design-coherent move — the file's content is `jj`-specific and the PRD pins `vcs = "jj"` as the only MVP value (N5). Shim left behind would violate the constitution's "no forwarding addresses" rule.
