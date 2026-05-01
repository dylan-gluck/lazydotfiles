# Spec — `TrackService.add` with rollback

- **Source bean:** `ldf-irkm`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §F3](../prds/001_mvp.md), [PRD §A3](../prds/001_mvp.md), [PRD §A5](../prds/001_mvp.md), [CONSTITUTION §2.1](../CONSTITUTION.md), [BackupService spec](./track-and-untrack-with-backups-f3-f4-f7_implement-backupservice.md), [SymlinkRepository spec](./track-and-untrack-with-backups-f3-f4-f7_implement-symlinkrepository.md).

## Goal

Run the atomic add sequence from PRD §F3 — `validate → snapshot → move → symlink → describe + jj-snapshot → record` — and replay the inverse on any failure so the filesystem is always either fully tracked or fully restored. This spec also extends `ServiceError` and `FsRepository` with the surface this service requires.

## Public surface

### `ServiceError` extension

File: `src/services/types.ts`.

```ts
export type TrackStep =
  // shared
  | "validate"
  | "snapshot"
  | "describe"
  | "record"
  // add-only
  | "move"
  | "symlink"
  // remove-only
  | "unlink-symlink"
  | "materialize"
  | "unlink-source";

export type ServiceError =
  | { readonly tag: "NotFound"; readonly resource: string; readonly id: string }
  | { readonly tag: "Validation"; readonly issues: readonly StandardSchemaV1.Issue[] }
  | { readonly tag: "Repository"; readonly cause: RepoError }
  | {
      readonly tag: "InvalidTarget";
      readonly reason: "missing" | "already-symlinked" | "under-dotfiles" | "not-tracked-symlink";
      readonly path: string;
    }
  | {
      readonly tag: "Rollback";
      readonly failedStep: TrackStep;
      readonly original: ServiceError;
      readonly rollbackErrors: readonly ServiceError[];
    };
```

`InvalidTarget.reason = "not-tracked-symlink"` is used by `remove` (separate spec); listed here so the union is defined once.

### `FsRepository` extension

File: `src/repositories/fs.repository.ts` — adds:

```ts
export interface FsRepository {
  // ...existing surface unchanged...
  /**
   * Move `src` → `dst`, creating `dirname(dst)` if needed. Uses `rename`; on `EXDEV`
   * falls back to copy-then-unlink with mode preserved. Refuses to overwrite an
   * existing `dst` (returns `IoError`).
   */
  move(input: { src: string; dst: string }): Promise<Result<void, RepoError>>;
  /** Copy `src` → `dst` preserving mode; refuses to overwrite an existing `dst`. */
  copyFile(input: { src: string; dst: string }): Promise<Result<void, RepoError>>;
  /** Remove a regular file. ENOENT → `ok(undefined)`. */
  removeFile(path: string): Promise<Result<void, RepoError>>;
}
```

### `TrackService`

File: `src/services/track.service.ts`.

```ts
import type { TrackedFile } from "../domain/tracked-file";
import type { Result } from "../lib/result";
import type { JjRepository } from "../repositories/jj.repository";
import type { TrackedFileRepository } from "../repositories/tracked-file.repository";
import type { SymlinkRepository } from "../repositories/symlink.repository";
import type { FsRepository } from "../repositories/fs.repository";
import type { BackupService } from "./backup.service";
import type { ServiceError } from "./types";

export interface TrackService {
  add(absolutePath: string): Promise<Result<TrackedFile, ServiceError>>;
  remove(absolutePath: string): Promise<Result<TrackedFile, ServiceError>>;
}

export function createTrackService(deps: {
  readonly home: string;
  readonly dotfilesRoot: string;
  readonly fs: FsRepository;
  readonly symlinks: SymlinkRepository;
  readonly tracked: TrackedFileRepository;
  readonly jj: JjRepository;
  readonly backups: BackupService;
  readonly now?: () => Date;
}): TrackService;
```

## Internal design

### Step sequence (`add(absolutePath)`)

Let `target = absolutePath` (caller responsibility: pre-resolved absolute path under `home`). Let `relativePath = relative(home, target)`. Let `id = trackedFileId(target)`. Let `source = join(dotfilesRoot, relativePath)`.

| #   | Step     | Forward action                                                                                                         | Inverse on rollback                                                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | validate | `fs.exists(target)` true; `symlinks.isLdfSymlink({path:target,dotfilesRoot})` false; `target` not under `dotfilesRoot` | none                                                                                                                      |
| 2   | snapshot | `backups.snapshot({srcPath:target, trackedFileId:id, trigger:"add"})` → `record`                                       | none (snapshot is the rollback fuel; payload kept)                                                                        |
| 3   | move     | `fs.move({src:target, dst:source})`                                                                                    | `fs.move({src:source, dst:target})` if `source` exists, else `fs.copyFile({src:backups.payloadPath(record), dst:target})` |
| 4   | symlink  | `symlinks.materialize({target:source, link:target})`                                                                   | `symlinks.unlink(target)`                                                                                                 |
| 5   | describe | `jj.describe({root:dotfilesRoot, message:`track ${relativePath}`})` then `jj.snapshot({root:dotfilesRoot})`            | best-effort: `jj.describe({root, message:""})` (do not fail rollback if jj cannot be reached; record the rollback error)  |
| 6   | record   | `tracked.upsert(makeTrackedFile({source, target, kind:"file", addedAt:isoNow}))`                                       | `tracked.remove(id)`                                                                                                      |

Exact ordering of the inverse: replay steps in reverse from `failedStep - 1` down to `1` (i.e. inverse step 6 first if step 7 failed, then 5, etc.). After a successful inverse pass the function returns `err({tag:"Rollback", failedStep, original, rollbackErrors})` where `rollbackErrors` collects every inverse step that itself errored (rollback never throws — it accumulates).

### Validation rules (`step 1`)

- `target` must exist as a regular file or directory: `fs.exists(target) === true`. Else `InvalidTarget("missing")`.
- `target` must not already be a symlink whose target is inside `dotfilesRoot`: `symlinks.isLdfSymlink({path:target, dotfilesRoot}) === false`. Else `InvalidTarget("already-symlinked")`.
- `target` must not lie under `dotfilesRoot`: reject if `target === dotfilesRoot` or `target.startsWith(dotfilesRoot + sep)`. Else `InvalidTarget("under-dotfiles")`.

### `addedAt`

`addedAt = (deps.now?.() ?? new Date()).toISOString()`. Tests inject `now` for determinism.

### `kind`

MVP scope is files only (PRD §F3 cites `<relativePath>` semantics). The service computes `kind = "file"` and trusts the caller to pre-validate. Directory-kind support is deferred (out-of-MVP per PRD §3 — not listed but implied by feature scope).

### Inverse step 5 caveat

If `jj describe` succeeds but `jj snapshot` (or step 6) fails, the inverse cannot fully unwind the jj op log — `jj op restore` is the only clean way to rewind. The MVP rollback **does not** call `jj op restore` here; it records a `rollbackErrors` entry indicating a stranded jj change so the user can recover via `/log`. PRD §A5 (filesystem fully tracked or fully restored) is satisfied: the **filesystem** is consistent; the jj op log may carry an empty-described change, which is observable and reversible from the log view. This deviation is documented in §Review below.

## Dependencies

- `src/services/backup.service.ts`
- `src/repositories/symlink.repository.ts`
- `src/repositories/fs.repository.ts` (extended surface — see above)
- `src/repositories/tracked-file.repository.ts`
- `src/repositories/jj.repository.ts`
- `src/domain/tracked-file.ts`

## Tests

Unit-level coverage lives in `src/services/track.service.test.ts` for the rollback branches; the dedicated rollback-test bean (`ldf-s3w3`) lists the matrix. SIGTERM mid-add is covered by `ldf-ylps` integration test (separate spec).

This spec's own tests in `src/services/track.service.test.ts` ("add"-suite):

- `add` with a missing target returns `InvalidTarget("missing")`; no FS changes.
- `add` with an already-LDF-symlinked target returns `InvalidTarget("already-symlinked")`.
- `add` with a target under `dotfilesRoot` returns `InvalidTarget("under-dotfiles")`.
- Happy path: `add("/home/u/.zshrc")` produces (a) backup snapshot under `<backupRoot>/<id>/<stamp>-add/`, (b) `<dotfilesRoot>/.zshrc` containing original bytes, (c) symlink at `/home/u/.zshrc` → `<dotfilesRoot>/.zshrc`, (d) `jj describe -m "track .zshrc"` invoked, (e) `tracked.read(id)` returns the new entry.
- `add` returns `ok(trackedFile)` with `id === trackedFileId(target)`, `addedAt === fixedNow().toISOString()`, `status === "tracked"`.

`FsRepository.move`/`copyFile`/`removeFile` get focused integration tests in `src/repositories/fs.repository.test.ts`:

- `move` renames within a device and preserves mode.
- `move` falls back to copy-then-unlink when `rename` throws `EXDEV` (simulated by stubbing `fs.rename`).
- `move` refuses overwrite (existing `dst` → `IoError`).
- `copyFile` preserves mode and refuses overwrite.
- `removeFile` is idempotent on ENOENT.

## Acceptance

- PRD §F3 sequence executes in order on the happy path.
- Every failure branch leaves the filesystem fully restored (asserted by `ldf-s3w3`).
- Each rollback returns `ServiceError.tag === "Rollback"` with `failedStep` set to the step that originally failed; `original` is the failure that triggered the rollback.

## Review

Approved with one documented carve-out (§Internal design — Inverse step 5 caveat): a partial jj describe followed by a step-6 failure leaves an empty-described `jj` change. The filesystem invariant required by PRD §A5 holds; the user-visible recovery path is `/log → restore`. The carve-out is **not** a parallel API — there is one rollback path, and it deterministically records this in `rollbackErrors`. Adding `jj op restore` to the rollback would couple the track service to the op-log internals and risks rewinding unrelated user operations; we defer that escalation to a follow-up bean only if A5 verification fails.
