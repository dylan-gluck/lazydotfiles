import { describe, expect, test } from "bun:test";
import type { Operation } from "./repo";
import {
  OperationKindSchema,
  OperationSchema,
  parseOperationKind,
  RepoSchema,
  SyncStateSchema,
} from "./repo";

describe("OperationKindSchema", () => {
  test("accepts the five canonical kinds", () => {
    for (const k of ["init", "track", "untrack", "edit", "sync"] as const) {
      const r = OperationKindSchema["~standard"].validate(k);
      expect(r.issues).toBeUndefined();
      expect(r.value).toBe(k);
    }
  });

  test("rejects an unknown literal", () => {
    const r = OperationKindSchema["~standard"].validate("merge");
    expect(r.issues).toBeDefined();
  });
});

describe("OperationSchema", () => {
  const op: Operation = {
    id: "abc123",
    parentId: "parent01",
    kind: "track",
    description: "track .zshrc",
    at: "2026-05-01T11:00:00Z",
    filesTouched: ["dotfiles/.zshrc"],
  };

  test("round-trips a populated record", () => {
    const r = OperationSchema["~standard"].validate(op);
    expect(r.issues).toBeUndefined();
    expect(r.value).toEqual(op);
  });

  test("accepts null parentId", () => {
    const r = OperationSchema["~standard"].validate({ ...op, parentId: null });
    expect(r.issues).toBeUndefined();
  });

  test("rejects when at is not a string", () => {
    const r = OperationSchema["~standard"].validate({ ...op, at: 42 });
    expect(r.issues).toBeDefined();
  });

  test("rejects when filesTouched is not an array", () => {
    const r = OperationSchema["~standard"].validate({ ...op, filesTouched: "no" });
    expect(r.issues).toBeDefined();
  });
});

describe("SyncStateSchema", () => {
  test("accepts null lastSyncAt and remote", () => {
    const r = SyncStateSchema["~standard"].validate({
      lastSyncAt: null,
      ahead: 0,
      behind: 0,
      dirty: false,
      remote: null,
    });
    expect(r.issues).toBeUndefined();
  });
});

describe("RepoSchema", () => {
  test("accepts a nested operation as head", () => {
    const r = RepoSchema["~standard"].validate({
      root: "/tmp/dotfiles",
      vcs: "jj",
      head: {
        id: "h",
        parentId: null,
        kind: "init",
        description: "init",
        at: "2026-05-01T00:00:00Z",
        filesTouched: [],
      },
    });
    expect(r.issues).toBeUndefined();
  });

  test("rejects an unknown vcs", () => {
    const r = RepoSchema["~standard"].validate({
      root: "/tmp",
      vcs: "git",
      head: {
        id: "h",
        parentId: null,
        kind: "init",
        description: "init",
        at: "2026-05-01T00:00:00Z",
        filesTouched: [],
      },
    });
    expect(r.issues).toBeDefined();
  });
});

describe("parseOperationKind", () => {
  test("maps known prefixes", () => {
    expect(parseOperationKind("track .zshrc")).toBe("track");
    expect(parseOperationKind("untrack .zshrc")).toBe("untrack");
    expect(parseOperationKind("sync")).toBe("sync");
    expect(parseOperationKind("init")).toBe("init");
  });

  test("falls back to edit on unknown", () => {
    expect(parseOperationKind("edited config")).toBe("edit");
    expect(parseOperationKind("")).toBe("edit");
  });
});
