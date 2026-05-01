# Spec — `BackupRepository`

- **Source bean:** `ldf-d1iw`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §F3](../prds/001_mvp.md), [PRD §F4](../prds/001_mvp.md), [PRD §F7](../prds/001_mvp.md), [ADR-001 §4.3](../adrs/001_project.md), [CONSTITUTION §4 (Tooling — Bun builtins)](../CONSTITUTION.md), [BackupRecord spec](./track-and-untrack-with-backups-f3-f4-f7_define-backuprecord-schema.md).

## Goal

The only path on the filesystem that creates, reads, and lists snapshots under `$HOME/.dotfiles.bak`. Materializes each snapshot as `<backupRoot>/<trackedFileId>/<timestamp>-<trigger>/` containing the captured `payload` (file bytes, mode preserved) and a sibling `meta.json` (the `BackupRecord`).

## Public surface

File: `src/repositories/backup.repository.ts`.

```ts
import type { BackupRecord, BackupTrigger } from "../domain/backup";
import type { Result } from "../lib/result";
import type { RepoError } from "./types";

export interface BackupSnapshotInput {
  /** Absolute path of the file to capture. MUST exist and be a regular file or symlink target. */
  readonly srcPath: string;
  /** `sha256(target)` — the `TrackedFile.id` this backup is associated with. */
  readonly trackedFileId: string;
  readonly trigger: BackupTrigger;
  /** Override for tests; defaults to `() => new Date()`. */
  readonly now?: () => Date;
}

export interface BackupRepository {
  readonly kind: "BackupRepository";
  /**
   * Capture `srcPath` under `<backupRoot>/<trackedFileId>/<stamp>-<trigger>/payload`,
   * write `meta.json` next to it, and return the resulting `BackupRecord`.
   * MUST preserve the source file's POSIX mode bits.
   */
  snapshot(input: BackupSnapshotInput): Promise<Result<BackupRecord, RepoError>>;
  /** All records for `trackedFileId`, sorted by `createdAt` ascending. Missing dir → empty list. */
  list(trackedFileId: string): Promise<Result<readonly BackupRecord[], RepoError>>;
  /** Read the record by id (`<trackedFileId>/<stamp>-<trigger>`). */
  read(id: string): Promise<Result<BackupRecord, RepoError>>;
  /** Absolute path of the captured payload file inside the snapshot dir. */
  payloadPath(record: BackupRecord): string;
}

export function createBackupRepository(opts: { backupRoot: string }): BackupRepository;
```

## Internal design

- **Layout** (deterministic, ADR-001 §4.3):
  ```
  <backupRoot>/
    <trackedFileId>/
      <stamp>-<trigger>/
        meta.json       # BackupRecord JSON, pretty-printed with trailing "\n"
        payload         # captured bytes; chmod matches source st_mode & 0o777
  ```
- **`snapshot`**:
  1. `stat(srcPath)` (`node:fs/promises`). On `ENOENT` → `err({tag:"NotFound", path:srcPath})`. Other failures → `IoError`.
  2. `now = (input.now ?? Date.now)()`; `createdAt = now.toISOString()`; `stamp = formatBackupTimestamp(now)`.
  3. `dir = join(backupRoot, trackedFileId, `${stamp}-${trigger}`)`.
  4. `mkdir(dir, { recursive: true })`; on EEXIST when already a dir → `IoError` (collision means the caller used a non-monotonic clock — refuse).
  5. `payload = join(dir, "payload")`. Try `Bun.write(payload, Bun.file(srcPath))`. If it fails with `EXDEV` (cross-device), fall back to `node:fs/promises.cp(srcPath, payload, { preserveTimestamps: true })`.
  6. `chmod(payload, statResult.mode & 0o777)` so executable bits survive.
  7. Build `record = makeBackupRecord({ trackedFileId, snapshotPath: dir, createdAt, trigger })`.
  8. `Bun.write(join(dir, "meta.json"), JSON.stringify(record, null, 2) + "\n")`.
  9. `ok(record)`.
- **`list`**:
  1. `readdir(join(backupRoot, trackedFileId))`. On `ENOENT` → `ok([])`.
  2. For each entry, attempt to read `meta.json`; validate via `BackupRecordSchema`.
  3. Skip entries that lack `meta.json` (malformed snapshots from an interrupted write are not enumerated; the directory is left as-is for forensic inspection).
  4. Sort by `createdAt` ascending. Return `ok(records)`.
- **`read(id)`**:
  - Split id on the **first** `/`: `[trackedFileId, leaf]`. If split fails or leaf is empty → `err({tag:"NotFound", path:id})`.
  - Compute `dir = join(backupRoot, trackedFileId, leaf)`; read `meta.json`; validate; return record.
- **`payloadPath(record)`**: returns `join(record.snapshotPath, "payload")`. Pure derivation — does not stat.
- All IO uses Bun where available (`Bun.file`, `Bun.write`); `stat`/`chmod`/`mkdir`/`readdir` come from `node:fs/promises` because Bun has no first-class equivalents (CONSTITUTION §4 carve-out).
- Errors are mapped to the existing `RepoError` union — no new tags required.

## Dependencies

- `src/domain/backup.ts` (`BackupRecord`, `BackupTrigger`, `makeBackupRecord`, `formatBackupTimestamp`, `BackupRecordSchema`).
- `src/repositories/types.ts` (`RepoError`).
- `src/lib/result.ts`.

## Tests

`src/repositories/backup.repository.test.ts` (integration, real tmp dir via `test-utils/tmp.ts`):

- `snapshot` writes `payload` with the source bytes and `meta.json` with a parseable `BackupRecord`.
- `snapshot` preserves POSIX mode: source `0o600` produces a payload with mode `0o600` (asserted via `stat`).
- `snapshot` returns a record whose `id`, `snapshotPath`, and `createdAt` agree with the on-disk path.
- `snapshot` with a clock that returns the same instant twice for the same `trackedFileId+trigger` returns `IoError` on the second call (no overwrite).
- `snapshot` of a missing source path returns `{tag:"NotFound"}`.
- `list` with no directory yet returns `ok([])`.
- `list` returns records in `createdAt`-ascending order across two snapshots taken 1ms apart.
- `list` ignores a sibling directory that lacks `meta.json` (does not fail).
- `read(id)` returns the record; `read("bogus/none")` returns `{tag:"NotFound"}`.
- `payloadPath(record)` is `join(record.snapshotPath, "payload")` (pure assertion).

## Acceptance

- Snapshots land at the documented path layout (PRD §F3 step 2, §F7).
- `BackupRecord.snapshotPath` is read-only post-creation (no method mutates).
- All tests above green.

## Review

Approved. The repository is the single FS path for backup creation; the service spec consumes only this interface. No domain logic in the repository (it does not validate trigger combinations or know about jj). Constitution non-negotiables 4 (no repo-call outside services — service spec calls this) and 5 (no untyped boundary — `meta.json` validated via schema) honored.
