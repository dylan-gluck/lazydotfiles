# restore.service (op + backup paths)

- **Source bean**: `ldf-jl3y`
- **Parent epic**: `ldf-z560`
- **PRD**: §F5 (op restore), §F7 (backup restore), §A7
- **ADR**: ADR-001 §4.3 (services), CONSTITUTION §1.1 (no logic in repo or actor)

## Goal

Provide the two restore paths called by `repo.actor`:

1. **`restoreToOp(opId)`** — `jj op restore` then re-materialize symlinks for every tracked file whose target now diverges from its `source`.
2. **`restoreFromBackup(backupId)`** — copy snapshot payload over the symlink target, leave jj history untouched, record the recovery as a new `BackupRecord` with `trigger = "restore"`.

## Public surface

`src/services/restore.service.ts`

```ts
export interface RestoreService {
  restoreToOp(opId: string): Promise<Result<RestoreToOpOutcome, ServiceError>>;
  restoreFromBackup(backupId: string): Promise<Result<BackupRecord, ServiceError>>;
}

export interface RestoreToOpOutcome {
  /** Files re-materialized because their symlink target was missing or wrong. */
  readonly rematerialized: readonly TrackedFile[];
}

export function createRestoreService(deps: {
  readonly home: string;
  readonly dotfilesRoot: string;
  readonly jj: JjRepository;
  readonly tracked: TrackedFileRepository;
  readonly symlinks: SymlinkRepository;
  readonly fs: FsRepository;
  readonly backups: BackupRepository;
  readonly now?: () => Date;
}): RestoreService;
```

The service is exported from `src/composition/services.ts` as `Services.restore`.

## Internal design

### `restoreToOp(opId)`

1. Run `jj.opRestore({ root, opId })`. On failure → `Repository` error.
2. `jj.snapshot({ root })` to refresh the working copy. Failure → `Repository` error (non-fatal but surfaced; symlink re-materialization can still proceed).
3. List tracked files via `tracked.list()`. For each file with `status === "tracked"`:
   - Read `target` symlink via `symlinks.read`. Three cases:
     - Symlink points to current `source` (resolved absolute) → no action.
     - Symlink missing OR is not a symlink OR points elsewhere → unlink (if symlink exists) and re-`symlinks.materialize({ target: source, link: target })`.
   - If `source` no longer exists in the working copy after restore (file removed by op restore), skip and emit it in a separate `restoredButOrphaned` field — for MVP, dropped from outcome (not surfaced; documented limitation).
4. Return `ok({ rematerialized: [...] })` listing files re-linked.

The symlink repo is used for both unlink and materialize so the rule "one source of truth for symlink ops" (PRD F5) holds.

### `restoreFromBackup(backupId)`

1. `backups.read(backupId)` → `BackupRecord`. Failure → `Repository`.
2. `tracked.read(record.trackedFileId)` to learn the symlink `target` path. NotFound → `ServiceError.NotFound { resource: "TrackedFile", id }`.
3. Resolve the file the user sees today:
   - If `target` is a symlink → unlink it (so we can write a real file).
   - If `target` is a regular file → remove it via `fs.removeFile`.
4. `fs.copyFile({ src: backups.payloadPath(record), dst: target })`. Failure → `Repository`; attempt to restore the symlink we just removed (best-effort inverse). On rollback failure, return `Rollback`.
5. Snapshot the **new** target as a fresh `BackupRecord` (`trigger = "restore"`) via `backups.snapshot` so the recovery itself is recoverable.
6. Return the new `BackupRecord` (NOT the input one) so the caller can show the user what they can roll back to.

### Errors

- `ServiceError` reuses the existing union; add no new tags. Failures inside step 3/4 of `restoreFromBackup` produce a `Rollback` with `failedStep: "materialize"` and the inverse error list.

### Determinism

- The service is stateless. `now` is injectable for tests. Loops over `tracked.list()` are sorted by `id` to keep outcomes deterministic.

## Dependencies

- `src/services/operation.service.ts` is **not** required at runtime; `restore.service` does not depend on op-list shape.
- Repositories: `JjRepository`, `TrackedFileRepository`, `SymlinkRepository`, `FsRepository`, `BackupRepository` (already exist).
- Domain: `BackupRecord`, `TrackedFile`.

## Tests

`src/services/restore.service.test.ts` (unit, fakes)

- **`restoreToOp` calls `jj.opRestore` then re-materializes a tracked file whose link target was broken.** Inject fakes; assert `symlinks.materialize` invoked with the expected `(target, link)` and that `outcome.rematerialized` contains exactly that file.
- **`restoreToOp` does nothing for a tracked file whose link is already correct.** Assert `materialize` not called.
- **`restoreToOp` surfaces `ServiceError.Repository` when `jj.opRestore` fails and does NOT touch symlinks.**
- **`restoreFromBackup` reads backup, unlinks current symlink, copies payload to target, and emits a new BackupRecord with `trigger="restore"`.**
- **`restoreFromBackup` returns `ServiceError.NotFound` when the BackupRecord's tracked file is no longer in the index.**
- **`restoreFromBackup` returns `Rollback` when copyFile fails after the unlink succeeded; the inverse re-materialized the symlink.**

`src/services/restore.service.integration.test.ts` (filesystem in `withTmpDir`)

- **End-to-end: track `.zshrc`, mutate `target` (it's a symlink so we point it elsewhere via `symlinks.unlink + symlinks.materialize`), call `restoreToOp(@-)`, target is once again the canonical symlink to `<dotfilesRoot>/.zshrc`.**

## Acceptance

- A unit test failing without the implementation; passing after.
- The integration test from `restore.service.integration.test.ts` passes against a real `jj` binary in a tmp `$HOME`.
- `Services.restore` is wired in the composition root and consumed by `repo.actor`.

## Review

- Rewrites: none.
- Approval: pending Step 4 cross-spec consistency review.
