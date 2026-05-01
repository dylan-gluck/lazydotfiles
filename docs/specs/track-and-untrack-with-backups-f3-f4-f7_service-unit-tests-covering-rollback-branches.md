# Spec — Track service unit tests covering every rollback branch

- **Source bean:** `ldf-s3w3`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §F3](../prds/001_mvp.md), [PRD §A5](../prds/001_mvp.md), [TrackService.add spec](./track-and-untrack-with-backups-f3-f4-f7_implement-trackserviceadd-with-rollback.md), [TrackService.remove spec](./track-and-untrack-with-backups-f3-f4-f7_implement-trackserviceremove.md), [CONSTITUTION §3](../CONSTITUTION.md).

## Goal

Cover every documented failure branch of `TrackService.add` and `TrackService.remove` with an isolated unit test using fakes (real reduced implementations, not mocks per CONSTITUTION §3.1) that asserts the **observable** post-state: filesystem layout, backup contents, jj invocations, tracked-file index, and the returned `ServiceError.tag === "Rollback"`.

## Public surface

No new code. Adds `src/services/track.service.test.ts` (new) covering the matrix below.

## Test matrix

Each row is one `bun:test` case. "Fault" describes which step we force to fail; "Asserts" lists observable post-state checks.

### `add`

| #   | Fault                                | Asserts                                                                                                                                                                                                            |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | (no fault) happy path                | backup exists, source exists, symlink valid, jj describe called once, tracked entry present, returns `ok(file)`                                                                                                    |
| A2  | step 1 fail (missing target)         | nothing on disk; `err.tag === "InvalidTarget"`, `reason === "missing"`                                                                                                                                             |
| A3  | step 1 fail (already symlinked)      | filesystem unchanged; `InvalidTarget("already-symlinked")`                                                                                                                                                         |
| A4  | step 1 fail (under dotfiles)         | filesystem unchanged; `InvalidTarget("under-dotfiles")`                                                                                                                                                            |
| A5  | step 2 fail (backup snapshot errors) | original at target unchanged; no source created; no symlink; no jj describe; `Rollback{failedStep:"snapshot"}`                                                                                                     |
| A6  | step 3 fail (move errors)            | original at target unchanged (or restored from backup); no source under dotfilesRoot; no symlink; `Rollback{failedStep:"move"}`                                                                                    |
| A7  | step 4 fail (symlink errors)         | source moved back to target (or copied from backup); no symlink at target; `Rollback{failedStep:"symlink"}`                                                                                                        |
| A8  | step 5 fail (jj describe errors)     | symlink unlinked, source moved back, target restored; `Rollback{failedStep:"describe"}`                                                                                                                            |
| A9  | step 6 fail (tracked.upsert errors)  | symlink unlinked, source moved back, target restored, jj rolled-back via empty describe (best-effort); `Rollback{failedStep:"record"}` plus a non-empty `rollbackErrors` only if the empty describe itself errored |

### `remove`

| #   | Fault                                | Asserts                                                                                                                               |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | (no fault) happy path                | target replaced by file with source bytes, source removed, backup at trigger="remove", jj describe called, tracked.status="untracked" |
| R2  | step 1 fail (target not LDF symlink) | filesystem unchanged; `InvalidTarget("not-tracked-symlink")`                                                                          |
| R3  | step 1 fail (no tracked entry)       | filesystem unchanged; `InvalidTarget("not-tracked-symlink")`                                                                          |
| R4  | step 2 fail (snapshot errors)        | symlink intact; no copy materialized; `Rollback{failedStep:"snapshot"}`                                                               |
| R5  | step 3 fail (unlink-symlink errors)  | symlink intact (or re-materialized); no target file; `Rollback{failedStep:"unlink-symlink"}`                                          |
| R6  | step 4 fail (copy errors)            | symlink restored; no target file; source intact; `Rollback{failedStep:"materialize"}`                                                 |
| R7  | step 5 fail (remove source errors)   | target restored to symlink; source intact; `Rollback{failedStep:"unlink-source"}`                                                     |
| R8  | step 6 fail (jj describe errors)     | target restored to symlink; source intact; `Rollback{failedStep:"describe"}`                                                          |
| R9  | step 7 fail (tracked.upsert errors)  | target file restored to symlink; source intact; tracked.status reverted to "tracked"; `Rollback{failedStep:"record"}`                 |

## Internal design (test infrastructure)

`src/services/track.service.test.ts` builds the SUT against the **real** repositories from `src/repositories/` rooted at a `withTmpDir`-managed `$HOME`, except for one injected seam: a thin `Faulty` decorator wrapper used per test to force a single step to fail.

```ts
function makeFaulty<T extends object>(
  real: T,
  faults: { method: keyof T; failOnce: boolean; error: RepoError | ServiceError }[],
): T;
```

Faults are layered onto the concrete repos at the call point that owns the step:

- Step 2 (snapshot) → faulty `BackupRepository.snapshot`.
- Step 3 (move) → faulty `FsRepository.move`.
- Step 4 (symlink) → faulty `SymlinkRepository.materialize`.
- Step 5 (describe) → faulty `JjRepository.describe`.
- Step 6 (record) → faulty `TrackedFileRepository.upsert`.

The `jj` repository is faked end-to-end (the rollback matrix does not require a real jj binary — A5 integration covers that). Fake `JjRepository` records `describe`/`snapshot` invocations in an array for assertion.

`now` is injected via the service's `now?` dep so timestamps are deterministic.

## Dependencies

- All track-phase production specs.
- `src/test-utils/tmp.ts`.

## Tests

This spec **is** a test deliverable; the matrix above is the test list.

## Acceptance

- All 18 cases (9 add + 9 remove) green.
- Each test asserts the filesystem and event/error shape — never the internal call graph (CONSTITUTION §3.2).

## Review

Approved. Tests use fakes, not mocks (real repos plus a `Faulty` wrapper that fails a single method once). Each row asserts at least one observable post-state in addition to the error tag, so a regression that emits the right tag while leaving the FS broken still fails.
