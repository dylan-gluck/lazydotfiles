import { describe, expect, test } from "bun:test";
import { expandHome, expandPaths } from "../../src/lib/path";

describe("expandHome", () => {
  test("expands $HOME prefix", () => {
    expect(expandHome("$HOME/dotfiles", "/u/x")).toBe("/u/x/dotfiles");
  });
  test("expands leading ~/", () => {
    expect(expandHome("~/x", "/u/x")).toBe("/u/x/x");
  });
  test("expands bare ~", () => {
    expect(expandHome("~", "/u/x")).toBe("/u/x");
  });
  test("leaves absolute paths alone", () => {
    expect(expandHome("/abs", "/u/x")).toBe("/abs");
  });
  test("substitutes $HOME wherever it appears", () => {
    expect(expandHome("a/$HOME/b", "/u/x")).toBe("a//u/x/b");
  });
  test("does not expand mid-string ~", () => {
    expect(expandHome("a/~/b", "/u/x")).toBe("a/~/b");
  });
});

describe("expandPaths", () => {
  test("expands all three keys", () => {
    expect(expandPaths({ home: "$HOME", dotfiles: "$HOME/d", backup: "~/.b" }, "/u/x")).toEqual({
      home: "/u/x",
      dotfiles: "/u/x/d",
      backup: "/u/x/.b",
    });
  });
  test("preserves extra fields", () => {
    const out = expandPaths(
      { home: "$HOME", dotfiles: "$HOME/d", backup: "$HOME/b", extra: 7 },
      "/h",
    );
    expect(out.extra).toBe(7);
  });
});
