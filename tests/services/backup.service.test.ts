import { describe, expect, test } from "bun:test";
import type { BackupRecord } from "../../src/domain/backup";
import { err, ok } from "../../src/lib/result";
import type { BackupRepository } from "../../src/repositories/backup.repository";
import { createBackupService } from "../../src/services/backup.service";

const record: BackupRecord = {
  id: "abc/20260501T163042123Z-add",
  trackedFileId: "abc",
  snapshotPath: "/b/abc/20260501T163042123Z-add",
  createdAt: "2026-05-01T16:30:42.123Z",
  trigger: "add",
};

function fakeRepo(over: Partial<BackupRepository> = {}): BackupRepository {
  return {
    kind: "BackupRepository",
    snapshot: async () => ok(record),
    list: async () => ok([record]),
    read: async () => ok(record),
    payloadPath: (r) => `${r.snapshotPath}/payload`,
    ...over,
  };
}

describe("BackupService", () => {
  test("snapshot ok forwards record", async () => {
    const svc = createBackupService({ repo: fakeRepo() });
    const r = await svc.snapshot({ srcPath: "/x", trackedFileId: "abc", trigger: "add" });
    expect(r.ok && r.value.id).toBe(record.id);
  });

  test("snapshot maps RepoError to Repository service error", async () => {
    const svc = createBackupService({
      repo: fakeRepo({
        snapshot: async () => err({ tag: "IoError", path: "/x", cause: new Error("boom") }),
      }),
    });
    const r = await svc.snapshot({ srcPath: "/x", trackedFileId: "abc", trigger: "add" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
    if (r.error.tag !== "Repository") return;
    expect(r.error.cause.tag).toBe("IoError");
  });

  test("list and read forward", async () => {
    const svc = createBackupService({ repo: fakeRepo() });
    const list = await svc.list("abc");
    expect(list.ok && list.value.length).toBe(1);
    const read = await svc.read(record.id);
    expect(read.ok && read.value.id).toBe(record.id);
  });

  test("payloadPath delegates", async () => {
    const svc = createBackupService({ repo: fakeRepo() });
    expect(svc.payloadPath(record)).toBe(`${record.snapshotPath}/payload`);
  });
});
