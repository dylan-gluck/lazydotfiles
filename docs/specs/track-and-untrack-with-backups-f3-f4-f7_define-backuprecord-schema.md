# Spec — `BackupRecord` domain entity

- **Source bean:** `ldf-2lwt`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §6 (Domain Model)](../prds/001_mvp.md), [PRD §F7 (Backup & restore)](../prds/001_mvp.md), [CONSTITUTION §1.4](../CONSTITUTION.md), [ADR-001 §4.2](../adrs/001_project.md).

## Goal

Land the `BackupRecord` domain entity, its Standard-Schema validator, and the deterministic id/path helpers shared by the backup repository and service. No IO; this is pure data + invariants.

## Public surface

File: `src/domain/backup.ts`.

```ts
import { type Infer, literal, object, type Schema, string, union } from "./schema";

export const BackupTriggerSchema: Schema<"add" | "remove" | "restore"> = union([
  literal("add"),
  literal("remove"),
  literal("restore"),
]);
export type BackupTrigger = Infer<typeof BackupTriggerSchema>;

export const BackupRecordSchema = object({
  /** `<trackedFileId>/<timestamp>-<trigger>` — deterministic, unique per snapshot. */
  id: string(),
  /** `sha256(target)` — matches `TrackedFile.id` for the file this snapshot protects. */
  trackedFileId: string(),
  /**
   * Absolute path to the snapshot directory on disk
   * (`<backupRoot>/<trackedFileId>/<timestamp>-<trigger>`).
   * Read-only after creation; never overwritten.
   */
  snapshotPath: string(),
  /** ISO-8601 with millisecond precision; matches the timestamp segment of `id`. */
  createdAt: string(),
  trigger: BackupTriggerSchema,
});
export type BackupRecord = Infer<typeof BackupRecordSchema>;

/**
 * Format a `Date` as the filename-safe timestamp segment used in `BackupRecord.id`
 * and the on-disk directory name. Format: `YYYYMMDDTHHMMSSsssZ` (UTC, no separators
 * other than the `T`). Pure; total over `Date`.
 */
export function formatBackupTimestamp(at: Date): string;

/** Inverse of `formatBackupTimestamp`. Returns `null` on malformed input. */
export function parseBackupTimestamp(stamp: string): Date | null;

export interface MakeBackupRecordInput {
  readonly trackedFileId: string;
  readonly snapshotPath: string;
  readonly createdAt: string; // ISO-8601
  readonly trigger: BackupTrigger;
}

/** Construct a `BackupRecord`; derives `id = "<trackedFileId>/<stamp>-<trigger>"`. */
export function makeBackupRecord(input: MakeBackupRecordInput): BackupRecord;
```

## Internal design

- `formatBackupTimestamp(at)` returns `at.toISOString().replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1Z")` so `2026-05-01T16:30:42.123Z` → `20260501T163042123Z`.
- `parseBackupTimestamp` rebuilds `YYYY-MM-DDTHH:MM:SS.sssZ` and feeds it to `new Date`. Returns `null` if the resulting timestamp is `NaN` or the input does not match `^\d{8}T\d{9}Z$`.
- `makeBackupRecord` derives the `stamp` from `createdAt` via `formatBackupTimestamp(new Date(createdAt))`. Throws `DomainError("INVARIANT_VIOLATION", { reason })` if the parsed date is invalid — the boundary that constructs `BackupRecord` is `BackupRepository.snapshot`, which never feeds malformed dates.
- `BackupRecord.snapshotPath` is treated as immutable post-construction: callers never mutate, repository never overwrites.

## Dependencies

- `src/domain/schema.ts` (existing primitives).
- `src/domain/errors.ts` (`DomainError`, `INVARIANT_VIOLATION`).

## Tests

`src/domain/backup.test.ts`:

- `BackupTriggerSchema` accepts `"add" | "remove" | "restore"` and rejects `"foo"` with a single issue.
- `BackupRecordSchema` round-trips a structurally valid record.
- `BackupRecordSchema` rejects an object missing `trigger` with a path-tagged issue at `["trigger"]`.
- `formatBackupTimestamp(new Date("2026-05-01T16:30:42.123Z"))` equals `"20260501T163042123Z"`.
- `parseBackupTimestamp("20260501T163042123Z")?.toISOString()` equals `"2026-05-01T16:30:42.123Z"`.
- `parseBackupTimestamp("not-a-stamp")` is `null`.
- `makeBackupRecord({trackedFileId:"abc", snapshotPath:"/b/abc/...", createdAt:"2026-05-01T16:30:42.123Z", trigger:"add"})` yields `id === "abc/20260501T163042123Z-add"`.
- `makeBackupRecord` with `createdAt = "not-a-date"` throws `DomainError` with tag `INVARIANT_VIOLATION`.

## Acceptance

- Type `BackupRecord` exported and matches the PRD §6 class shape (`id`, `trackedFileId`, `snapshotPath`, `createdAt`, `trigger`).
- Schema validates inputs from disk; `makeBackupRecord` is the single construction path used by the repository.
- All tests above are green.

## Review

Approved. No IO; no parallel timestamp utilities elsewhere in the tree (verified via search of `src/`). `BackupRecord.snapshotPath` immutability is enforced by absence of any setter and by repository contract (separate spec). Constitution §6 non-negotiables: no `process.exit`, no width/height, schema-first — all satisfied.
