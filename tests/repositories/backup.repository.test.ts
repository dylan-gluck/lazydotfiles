import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeTmpDir, type TmpDir } from "../test-utils/tmp";
import { createBackupRepository } from "../../src/repositories/backup.repository";

let tmp: TmpDir;
let backupRoot: string;

beforeEach(async () => {
  tmp = await makeTmpDir("ldf-backup-");
  backupRoot = join(tmp.path, "bak");
});

afterEach(async () => {
  await tmp.cleanup();
});

function makeRepo() {
  return createBackupRepository({ backupRoot });
}

async function source(name: string, content: string, mode = 0o600): Promise<string> {
  const p = join(tmp.path, name);
  await writeFile(p, content);
  await chmod(p, mode);
  return p;
}

const fixedNow = () => new Date("2026-05-01T16:30:42.123Z");

describe("BackupRepository.snapshot", () => {
  test("writes payload and meta.json with parseable record", async () => {
    const src = await source("a", "hello\n");
    const repo = makeRepo();
    const r = await repo.snapshot({
      srcPath: src,
      trackedFileId: "abc",
      trigger: "add",
      now: fixedNow,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const payload = repo.payloadPath(r.value);
    expect(await Bun.file(payload).text()).toBe("hello\n");
    expect(r.value.id).toBe("abc/20260501T163042123Z-add");
    expect(r.value.snapshotPath).toBe(join(backupRoot, "abc", "20260501T163042123Z-add"));
  });

  test("preserves POSIX mode", async () => {
    const src = await source("a", "x", 0o600);
    const r = await makeRepo().snapshot({
      srcPath: src,
      trackedFileId: "id1",
      trigger: "add",
      now: fixedNow,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await stat(makeRepo().payloadPath(r.value));
    expect(s.mode & 0o777).toBe(0o600);
  });

  test("clock collision (same instant + trigger) errors", async () => {
    const src = await source("a", "x");
    const repo = makeRepo();
    const r1 = await repo.snapshot({
      srcPath: src,
      trackedFileId: "id1",
      trigger: "add",
      now: fixedNow,
    });
    expect(r1.ok).toBe(true);
    const r2 = await repo.snapshot({
      srcPath: src,
      trackedFileId: "id1",
      trigger: "add",
      now: fixedNow,
    });
    expect(r2.ok).toBe(false);
  });

  test("missing source returns NotFound", async () => {
    const r = await makeRepo().snapshot({
      srcPath: join(tmp.path, "nope"),
      trackedFileId: "id1",
      trigger: "add",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("NotFound");
  });
});

describe("BackupRepository.list / read", () => {
  test("empty when directory missing", async () => {
    const r = await makeRepo().list("nobody");
    expect(r.ok && r.value).toEqual([]);
  });

  test("orders records ascending by createdAt", async () => {
    const repo = makeRepo();
    const src = await source("a", "x");
    const t1 = () => new Date("2026-05-01T00:00:00.001Z");
    const t2 = () => new Date("2026-05-01T00:00:00.002Z");
    await repo.snapshot({ srcPath: src, trackedFileId: "id1", trigger: "add", now: t2 });
    await repo.snapshot({ srcPath: src, trackedFileId: "id1", trigger: "add", now: t1 });
    const r = await repo.list("id1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.length).toBe(2);
    expect(r.value[0]!.createdAt < r.value[1]!.createdAt).toBe(true);
  });

  test("ignores sibling dirs without meta.json", async () => {
    const repo = makeRepo();
    const src = await source("a", "x");
    await repo.snapshot({ srcPath: src, trackedFileId: "id1", trigger: "add", now: fixedNow });
    await mkdir(join(backupRoot, "id1", "garbage"), { recursive: true });
    const r = await repo.list("id1");
    expect(r.ok && r.value.length).toBe(1);
  });

  test("read returns the record; bogus id returns NotFound", async () => {
    const repo = makeRepo();
    const src = await source("a", "x");
    const w = await repo.snapshot({
      srcPath: src,
      trackedFileId: "id1",
      trigger: "add",
      now: fixedNow,
    });
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    const r = await repo.read(w.value.id);
    expect(r.ok && r.value.id).toBe(w.value.id);
    const miss = await repo.read("none/none");
    expect(miss.ok).toBe(false);
  });

  test("payloadPath equals snapshotPath/payload", async () => {
    const repo = makeRepo();
    const src = await source("a", "x");
    const r = await repo.snapshot({
      srcPath: src,
      trackedFileId: "id1",
      trigger: "add",
      now: fixedNow,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(repo.payloadPath(r.value)).toBe(join(r.value.snapshotPath, "payload"));
  });
});
