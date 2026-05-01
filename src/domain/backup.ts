import { DomainError } from "./errors";
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

const STAMP_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/;

/**
 * Format a `Date` as the filename-safe timestamp segment used in `BackupRecord.id`
 * and the on-disk directory name. Format: `YYYYMMDDTHHMMSSsssZ` (UTC, no separators
 * other than the `T`). Pure; total over `Date`.
 */
export function formatBackupTimestamp(at: Date): string {
  const iso = at.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ
  return iso.replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1Z");
}

/** Inverse of `formatBackupTimestamp`. Returns `null` on malformed input. */
export function parseBackupTimestamp(stamp: string): Date | null {
  const m = STAMP_RE.exec(stamp);
  if (m === null) return null;
  const [, y, mo, d, h, mi, s, ms] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface MakeBackupRecordInput {
  readonly trackedFileId: string;
  readonly snapshotPath: string;
  readonly createdAt: string;
  readonly trigger: BackupTrigger;
}

/** Construct a `BackupRecord`; derives `id = "<trackedFileId>/<stamp>-<trigger>"`. */
export function makeBackupRecord(input: MakeBackupRecordInput): BackupRecord {
  const date = new Date(input.createdAt);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError("INVARIANT_VIOLATION", {
      reason: `invalid createdAt: ${input.createdAt}`,
    });
  }
  const stamp = formatBackupTimestamp(date);
  return {
    id: `${input.trackedFileId}/${stamp}-${input.trigger}`,
    trackedFileId: input.trackedFileId,
    snapshotPath: input.snapshotPath,
    createdAt: input.createdAt,
    trigger: input.trigger,
  };
}
