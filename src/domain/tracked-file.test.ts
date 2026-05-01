import { describe, expect, test } from "bun:test";
import { makeTrackedFile, TrackedFileSchema, trackedFileId } from "./tracked-file";

describe("trackedFileId", () => {
  test("is 64 hex chars and deterministic", () => {
    const id = trackedFileId("/Users/x/.zshrc");
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(trackedFileId("/Users/x/.zshrc")).toBe(id);
  });

  test("distinct targets produce distinct ids", () => {
    expect(trackedFileId("/a")).not.toBe(trackedFileId("/b"));
  });
});

describe("makeTrackedFile", () => {
  test("derives id from target and defaults status to tracked", () => {
    const tf = makeTrackedFile({
      source: "/dot/.zshrc",
      target: "/home/.zshrc",
      kind: "file",
      addedAt: "2026-05-01T00:00:00Z",
    });
    expect(tf.id).toBe(trackedFileId("/home/.zshrc"));
    expect(tf.status).toBe("tracked");
  });

  test("respects an explicit untracked status", () => {
    const tf = makeTrackedFile({
      source: "/s",
      target: "/t",
      kind: "file",
      addedAt: "x",
      status: "untracked",
    });
    expect(tf.status).toBe("untracked");
  });
});

describe("TrackedFileSchema", () => {
  const base = {
    id: "x",
    source: "/s",
    target: "/t",
    kind: "file",
    addedAt: "2026-05-01T00:00:00Z",
    status: "tracked",
  };

  test("accepts a valid record", () => {
    const r = TrackedFileSchema["~standard"].validate(base);
    expect(r.issues).toBeUndefined();
  });

  test("rejects missing id", () => {
    const { id: _id, ...rest } = base;
    void _id;
    const r = TrackedFileSchema["~standard"].validate(rest);
    expect(r.issues).toBeDefined();
  });

  test("rejects unknown kind", () => {
    const r = TrackedFileSchema["~standard"].validate({ ...base, kind: "symlink" });
    expect(r.issues).toBeDefined();
  });

  test("rejects unknown status", () => {
    const r = TrackedFileSchema["~standard"].validate({ ...base, status: "queued" });
    expect(r.issues).toBeDefined();
  });
});
