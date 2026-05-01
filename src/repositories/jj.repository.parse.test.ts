import { describe, expect, test } from "bun:test";
import { countLines, parseConflictList, parseOperationLine } from "./jj.repository";

const US = "\u001f";

describe("parseOperationLine", () => {
  test("parses a canonical op log line with a parent", () => {
    const line = `abc123${US}parent01${US}track .zshrc${US}2026-05-01T11:00:00+00:00${US}`;
    const r = parseOperationLine(line);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({
      id: "abc123",
      parentId: "parent01",
      kind: "track",
      description: "track .zshrc",
      at: "2026-05-01T11:00:00+00:00",
      filesTouched: [],
    });
  });

  test("treats an empty parent field as null parentId", () => {
    const line = `root00${US}${US}init${US}2026-05-01T00:00:00+00:00${US}`;
    const r = parseOperationLine(line);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.parentId).toBeNull();
    expect(r.value.kind).toBe("init");
  });

  test("returns ParseError when the field count is wrong", () => {
    const line = `only${US}two`;
    const r = parseOperationLine(line);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("ParseError");
  });

  test("derives kind from description for untracked descriptions", () => {
    const line = `id1${US}p${US}edited config${US}2026-05-01T00:00:00+00:00${US}`;
    const r = parseOperationLine(line);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.kind).toBe("edit");
  });
});

describe("countLines", () => {
  test("counts non-empty newline-terminated lines", () => {
    expect(countLines("")).toBe(0);
    expect(countLines("x\n")).toBe(1);
    expect(countLines("x\nx\nx\n")).toBe(3);
    expect(countLines("x\n\nx\n")).toBe(2);
  });
});

describe("parseConflictList", () => {
  test("extracts trailing path from each row", () => {
    const stdout = [
      "2-sided conflict including 1 deletion .zshrc",
      "2-sided conflict src/foo.ts",
      "",
    ].join("\n");
    expect(parseConflictList(stdout)).toEqual([".zshrc", "src/foo.ts"]);
  });
  test("single-token line is taken as a path", () => {
    expect(parseConflictList(".zshrc\n")).toEqual([".zshrc"]);
  });
  test("empty input yields empty list", () => {
    expect(parseConflictList("")).toEqual([]);
  });
});
