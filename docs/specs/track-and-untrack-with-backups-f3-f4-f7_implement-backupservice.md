# Spec — `BackupService`

- **Source bean:** `ldf-cy7c`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §F7](../prds/001_mvp.md), [ADR-001 §4.4](../adrs/001_project.md), [BackupRepository spec](./track-and-untrack-with-backups-f3-f4-f7_implement-backuprepository.md).

## Goal

Thin service over `BackupRepository` that translates `RepoError` to `ServiceError` and is the seam the track service / actor depends on. No new business rules — the repository owns layout and atomicity.

## Public surface

File: `src/services/backup.service.ts`.

```ts
import type { BackupRecord, BackupTrigger } from "../domain/backup";
import type { Result } from "../lib/result";
import type { BackupRepository, BackupSnapshotInput } from "../repositories/backup.repository";
import type { ServiceError } from "./types";

export interface BackupService {
  snapshot(input: {
    srcPath: string;
    trackedFileId: string;
    trigger: BackupTrigger;
  }): Promise<Result<BackupRecord, ServiceError>>;
  list(trackedFileId: string): Promise<Result<readonly BackupRecord[], ServiceError>>;
  read(id: string): Promise<Result<BackupRecord, ServiceError>>;
  payloadPath(record: BackupRecord): string;
}

export function createBackupService(deps: {
  repo: BackupRepository;
  /** Override for tests; defaults to `Date`. */
  now?: () => Date;
}): BackupService;
```

## Internal design

- `snapshot` forwards to `deps.repo.snapshot({ ...input, now: deps.now })`. On `RepoError`, returns `err({tag:"Repository", cause})`.
- `list`/`read` forward identically with `RepoError → Repository` mapping.
- `payloadPath` delegates to the repo (pure).
- The service does **not** decide trigger semantics — the caller (track service) picks `"add" | "remove" | "restore"` based on the operation it is running.

## Dependencies

- `src/repositories/backup.repository.ts`
- `src/services/types.ts`
- `src/domain/backup.ts`

## Tests

`src/services/backup.service.test.ts` (unit, fake repository):

- `snapshot` with a fake that returns `ok(record)` returns `ok(record)`.
- `snapshot` with a fake that returns `err({tag:"IoError"})` returns `err({tag:"Repository", cause:{tag:"IoError"}})`.
- `list` and `read` round-trip through the repo without modification.
- `payloadPath(record)` equals `repo.payloadPath(record)`.

## Acceptance

- Track service depends only on `BackupService`, not on the backup repository directly (DIP).
- Wired into `composition/services.ts` — see track-service spec for the wiring delta.
- All tests green.

## Review

Approved. Trivial orchestrator — its existence is justified by ADR-001 §4.4 (services translate `RepoError → ServiceError`) and by isolating the `now` injection point so tests can pin the timestamp deterministically without poking the repository.
