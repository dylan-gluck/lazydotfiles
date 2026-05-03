# Spec — `TrackService.remove`

- **Source bean:** `ldf-95fy`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §F4](../prds/001_mvp.md), [PRD §A4](../prds/001_mvp.md), [TrackService.add spec](./track-and-untrack-with-backups-f3-f4-f7_implement-trackserviceadd-with-rollback.md).

## Goal

Reverse the add sequence: `validate symlink ownership → snapshot current target → materialize copy back → jj describe + snapshot → mark TrackedFile.status = "untracked"`. History in `jj` is preserved; the working copy simply no longer contains the file.

## Public surface

`TrackService.remove(absolutePath: string): Promise<Result<TrackedFile, ServiceError>>` — declared on the same `TrackService` interface introduced by the `add` spec. No new error tags; reuses `InvalidTarget("not-tracked-symlink")` and the `Rollback` tag.

## Internal design

Let `target = absolutePath`. Let `id = trackedFileId(target)`. Let `relativePath = relative(home, target)`. Let `source = join(dotfilesRoot, relativePath)`.

### Step sequence (`remove`)

| #   | Step           | Forward action                                                                                                             | Inverse on rollback                                                |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | validate       | `symlinks.isLdfSymlink({path:target, dotfilesRoot}) === true`; `tracked.read(id)` returns ok; `fs.exists(source) === true` | none                                                               |
| 2   | snapshot       | `backups.snapshot({srcPath:source, trackedFileId:id, trigger:"remove"})` → `record`                                        | none                                                               |
| 3   | unlink-symlink | `symlinks.unlink(target)`                                                                                                  | `symlinks.materialize({target:source, link:target})` (best-effort) |
| 4   | materialize    | `fs.copyFile({src:source, dst:target})` then `chmod(target, sourceMode)` (mode read in step 1)                             | `fs.removeFile(target)`                                            |
| 5   | unlink-source  | `fs.removeFile(source)`                                                                                                    | `fs.copyFile({src:backups.payloadPath(record), dst:source})`       |
| 6   | describe       | `jj.describe({root:dotfilesRoot, message:`untrack ${relativePath}`})` then `jj.snapshot({root})`                           | best-effort empty describe (same caveat as `add`)                  |
| 7   | record         | `tracked.upsert({...existing, status:"untracked"})`                                                                        | revert to `status:"tracked"` via `tracked.upsert(existing)`        |

`InvalidTarget` reasons used by `remove`:

- `target` is not a symlink owned by ldf → `not-tracked-symlink`.
- `tracked.read(id)` returns NotFound → `not-tracked-symlink` (same surface; the path is not authoritatively tracked).
- `source` missing on disk → `not-tracked-symlink` (the index is stale; user should investigate via `/log`).

Rollback returns `err({tag:"Rollback", failedStep, original, rollbackErrors})` per the same accumulation rules as `add`.

### `kind` and unchanged fields

`remove` mutates only `status`. `addedAt`, `kind`, `source`, `target`, `id` are preserved (PRD §6 invariants — `id = sha256(target)` is stable across status changes).

### History preservation (PRD §A4)

`jj describe` + `jj snapshot` records the file's removal as a new change in the working copy; `jj log` retains the prior `track` change. The service does **not** call `jj abandon` or rewind history.

## Dependencies

Same as `add` (same `TrackService` interface, same dependency bag).

## Tests

`src/services/track.service.test.ts` ("remove"-suite):

- `remove` of a non-LDF symlink returns `InvalidTarget("not-tracked-symlink")`.
- `remove` of an unindexed symlink (`tracked.read(id)` → NotFound) returns `InvalidTarget("not-tracked-symlink")`.
- Happy path:
  - target replaced by a regular file with the source bytes.
  - source removed under `dotfilesRoot` (so the working copy no longer contains it).
  - backup at `<backupRoot>/<id>/<stamp>-remove/` matches the source bytes.
  - `jj describe -m "untrack <rel>"` invoked.
  - `tracked.read(id).value.status === "untracked"`.
- `remove` returns `ok(updatedTrackedFile)` with `id` unchanged.
- Rollback branches mirror the `ldf-s3w3` matrix; integration of A4 is `ldf-9hf0`.

## Acceptance

- File restored at original location with current source bytes (PRD §A4).
- `jj log` retains the `track <rel>` change (asserted in `ldf-9hf0`).
- All tests above green.

## Review

Approved. Same jj-rollback caveat as `add` applies; the integration test for A4 (`ldf-9hf0`) verifies end-to-end. The status flip lives in the index (TrackedFile JSON) — keeping the entry around with `status:"untracked"` lets the operation log surface the file in historical views without resurrecting it from disk.
