import { describe, expect, test } from "bun:test";
import type { Operation } from "../domain/repo";
import { err, ok } from "../lib/result";
import type { JjRepository } from "../repositories/jj.repository";
import { createOperationService } from "./operation.service";

const op = (over: Partial<Operation>): Operation => ({
  id: "op0",
  parentId: null,
  kind: "edit",
  description: "snapshot working copy",
  at: "2026-05-01T00:00:00Z",
  filesTouched: [],
  ...over,
});

function fakeJj(over: Partial<JjRepository>): JjRepository {
  return {
    kind: "JjRepository",
    isRepo: async () => ok(true),
    initColocated: async () => ok(undefined),
    describe: async () => ok(undefined),
    snapshot: async () => ok(undefined),
    newChange: async () => ok(undefined),
    opLog: async () => ok([]),
    log: async () => ok([]),
    opRestore: async () => ok(undefined),
    logAtOp: async () => ok(null),
    diffSummaryAtOp: async () => ok([]),
    diffAtOp: async () => ok(""),
    status: async () => ok({ lastSyncAt: null, ahead: 0, behind: 0, dirty: false, remote: null }),
    gitFetch: async () => ok(undefined),
    gitPush: async () => ok(undefined),
    ...over,
  };
}

describe("OperationService.list", () => {
  test("enriches ops that have an @ change with description/kind/files", async () => {
    const jj = fakeJj({
      opLog: async () =>
        ok([
          op({ id: "opA", parentId: "opB", description: "describe commit ABC" }),
          op({ id: "opB", parentId: null, description: "snapshot working copy" }),
          op({ id: "opC", parentId: null, description: "add workspace 'default'" }),
        ]),
      logAtOp: async ({ opId }) => {
        if (opId === "opA") {
          return ok(op({ id: "chgA", description: "track .zshrc", kind: "track" }));
        }
        if (opId === "opB") {
          return ok(op({ id: "chgB", description: "track .zshrc", kind: "track" }));
        }
        return ok(null);
      },
      diffSummaryAtOp: async ({ opId }) =>
        ok(opId === "opA" ? [".zshrc"] : opId === "opB" ? [".zshrc"] : []),
    });
    const svc = createOperationService({ jj, root: "/d" });
    const r = await svc.list();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toHaveLength(3);
    expect(r.value[0]).toEqual({
      opId: "opA",
      changeId: "chgA",
      parentOpId: "opB",
      kind: "track",
      description: "track .zshrc",
      at: "2026-05-01T00:00:00Z",
      filesTouched: [".zshrc"],
    });
    // opC has no @ change → init kind, empty files.
    expect(r.value[2]).toMatchObject({
      opId: "opC",
      changeId: null,
      kind: "init",
      filesTouched: [],
    });
  });

  test("collapses snapshot ops without @ change to kind=edit", async () => {
    const jj = fakeJj({
      opLog: async () => ok([op({ id: "s1", description: "snapshot working copy" })]),
      logAtOp: async () => ok(null),
    });
    const svc = createOperationService({ jj, root: "/d" });
    const r = await svc.list();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0]?.kind).toBe("edit");
    expect(r.value[0]?.changeId).toBeNull();
  });

  test("offset+limit windows the underlying op log", async () => {
    let requested = 0;
    const jj = fakeJj({
      opLog: async ({ limit }) => {
        requested = limit ?? 0;
        return ok([op({ id: "o1" }), op({ id: "o2" }), op({ id: "o3" }), op({ id: "o4" })]);
      },
    });
    const svc = createOperationService({ jj, root: "/d" });
    const r = await svc.list({ offset: 1, limit: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(requested).toBe(3); // limit + offset
    expect(r.value.map((v) => v.opId)).toEqual(["o2", "o3"]);
  });

  test("opLog repository error surfaces as ServiceError.Repository", async () => {
    const jj = fakeJj({
      opLog: async () =>
        err({ tag: "Spawn", command: ["jj", "op", "log"], exitCode: 1, stderr: "boom" }),
    });
    const svc = createOperationService({ jj, root: "/d" });
    const r = await svc.list();
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
  });
});

describe("OperationService.diff", () => {
  test("returns empty string when the op has no @ change", async () => {
    let diffCalled = false;
    const jj = fakeJj({
      logAtOp: async () => ok(null),
      diffAtOp: async () => {
        diffCalled = true;
        return ok("should not be called");
      },
    });
    const svc = createOperationService({ jj, root: "/d" });
    const r = await svc.diff("op1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe("");
    expect(diffCalled).toBe(false);
  });

  test("returns stdout of jj diff --at-op when the op has a change", async () => {
    const jj = fakeJj({
      logAtOp: async () => ok(op({ id: "chgZ", description: "track x" })),
      diffAtOp: async () => ok("diff --git a/x b/x\n"),
    });
    const svc = createOperationService({ jj, root: "/d" });
    const r = await svc.diff("opZ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain("diff --git");
  });
});
