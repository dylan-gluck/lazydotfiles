import { describe, expect, test } from "bun:test";
import { pickConflictSide } from "../../src/services/sync.conflict-markers";

const TWO_WAY = [
  "a",
  "<<<<<<< ours",
  "ours-1",
  "ours-2",
  "=======",
  "theirs-1",
  ">>>>>>> theirs",
  "z",
].join("\n");

const THREE_WAY = [
  "a",
  "<<<<<<< ours",
  "ours-1",
  "||||||| base",
  "base-1",
  "=======",
  "theirs-1",
  ">>>>>>> theirs",
  "z",
].join("\n");

describe("pickConflictSide", () => {
  test("two-way picks ours", () => {
    expect(pickConflictSide(TWO_WAY, "ours")).toBe(["a", "ours-1", "ours-2", "z"].join("\n"));
  });
  test("two-way picks theirs", () => {
    expect(pickConflictSide(TWO_WAY, "theirs")).toBe(["a", "theirs-1", "z"].join("\n"));
  });
  test("three-way picks ours (base block dropped)", () => {
    expect(pickConflictSide(THREE_WAY, "ours")).toBe(["a", "ours-1", "z"].join("\n"));
  });
  test("three-way picks theirs (base block dropped)", () => {
    expect(pickConflictSide(THREE_WAY, "theirs")).toBe(["a", "theirs-1", "z"].join("\n"));
  });
  test("text with no markers passes through unchanged", () => {
    const t = "hello\nworld\n";
    expect(pickConflictSide(t, "ours")).toBe(t);
  });
  test("malformed block (no separator) is preserved", () => {
    const t = "x\n<<<<<<< incomplete\nlonely\ny\n";
    expect(pickConflictSide(t, "ours")).toBe(t);
  });
});
