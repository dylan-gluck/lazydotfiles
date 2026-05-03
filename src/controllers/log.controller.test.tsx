import { describe, expect, test } from "bun:test";
import type { OperationView } from "../domain/repo";
import { filterOpsByFile } from "./log.controller";

const op = (over: Partial<OperationView> = {}): OperationView => ({
  opId: "op",
  changeId: null,
  parentOpId: null,
  kind: "edit",
  description: "edit",
  at: new Date().toISOString(),
  filesTouched: [],
  ...over,
});

describe("filterOpsByFile", () => {
  test("returns all operations when file undefined", () => {
    const ops = [op({ opId: "1" }), op({ opId: "2" })];
    expect(filterOpsByFile(ops, undefined)).toEqual(ops);
  });

  test("filters operations whose filesTouched include exact file", () => {
    const ops = [
      op({ opId: "1", filesTouched: [".zshrc"] }),
      op({ opId: "2", filesTouched: ["other"] }),
    ];
    const out = filterOpsByFile(ops, ".zshrc").map((o) => o.opId);
    expect(out).toEqual(["1"]);
  });

  test("filters operations whose filesTouched include path ending with /file", () => {
    const ops = [
      op({ opId: "1", filesTouched: ["sub/.zshrc"] }),
      op({ opId: "2", filesTouched: ["other"] }),
    ];
    const out = filterOpsByFile(ops, ".zshrc").map((o) => o.opId);
    expect(out).toEqual(["1"]);
  });

  test("returns empty when no operation touches file", () => {
    const ops = [op({ opId: "1", filesTouched: ["a"] })];
    expect(filterOpsByFile(ops, "z")).toEqual([]);
  });
});
