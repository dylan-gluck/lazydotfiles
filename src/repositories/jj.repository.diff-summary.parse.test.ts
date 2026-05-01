import { describe, expect, test } from "bun:test";
import { parseDiffSummary } from "./jj.repository";

describe("parseDiffSummary", () => {
  test("strips status prefix and returns paths in order", () => {
    const out = parseDiffSummary("A .zshrc\nM .config/nvim/init.lua\nD old\n");
    expect(out).toEqual([".zshrc", ".config/nvim/init.lua", "old"]);
  });

  test("returns empty array for empty stdout", () => {
    expect(parseDiffSummary("")).toEqual([]);
    expect(parseDiffSummary("\n\n")).toEqual([]);
  });
});
