import { describe, expect, test } from "bun:test";
import {
  BackupRecordSchema,
  BackupTriggerSchema,
  formatBackupTimestamp,
  makeBackupRecord,
  parseBackupTimestamp,
} from "../../src/domain/backup";
import { DomainError } from "../../src/domain/errors";

describe("BackupTriggerSchema", () => {
  test("accepts add | remove | restore", () => {
    for (const t of ["add", "remove", "restore"] as const) {
      const r = BackupTriggerSchema["~standard"].validate(t);
      expect(r.issues).toBeUndefined();
    }
  });
  test("rejects 'foo'", () => {
    const r = BackupTriggerSchema["~standard"].validate("foo");
    expect(r.issues).toBeDefined();
  });
});

describe("BackupRecordSchema", () => {
  test("round-trips a valid record", () => {
    const rec = {
      id: "abc/20260501T163042123Z-add",
      trackedFileId: "abc",
      snapshotPath: "/b/abc/20260501T163042123Z-add",
      createdAt: "2026-05-01T16:30:42.123Z",
      trigger: "add" as const,
    };
    const r = BackupRecordSchema["~standard"].validate(rec);
    expect(r.issues).toBeUndefined();
    expect(r.value).toEqual(rec);
  });
  test("rejects missing trigger with path-tagged issue", () => {
    const r = BackupRecordSchema["~standard"].validate({
      id: "x",
      trackedFileId: "x",
      snapshotPath: "/p",
      createdAt: "2026-05-01T16:30:42.123Z",
    });
    expect(r.issues).toBeDefined();
    expect(r.issues?.some((i) => (i.path ?? [])[0] === "trigger")).toBe(true);
  });
});

describe("formatBackupTimestamp / parseBackupTimestamp", () => {
  test("format known instant", () => {
    expect(formatBackupTimestamp(new Date("2026-05-01T16:30:42.123Z"))).toBe("20260501T163042123Z");
  });
  test("parse round-trip", () => {
    expect(parseBackupTimestamp("20260501T163042123Z")?.toISOString()).toBe(
      "2026-05-01T16:30:42.123Z",
    );
  });
  test("parse malformed returns null", () => {
    expect(parseBackupTimestamp("not-a-stamp")).toBeNull();
  });
});

describe("makeBackupRecord", () => {
  test("derives id from createdAt + trigger", () => {
    const rec = makeBackupRecord({
      trackedFileId: "abc",
      snapshotPath: "/b/abc/20260501T163042123Z-add",
      createdAt: "2026-05-01T16:30:42.123Z",
      trigger: "add",
    });
    expect(rec.id).toBe("abc/20260501T163042123Z-add");
  });
  test("throws DomainError on invalid createdAt", () => {
    expect(() =>
      makeBackupRecord({
        trackedFileId: "abc",
        snapshotPath: "/b",
        createdAt: "not-a-date",
        trigger: "add",
      }),
    ).toThrow(DomainError);
  });
});
