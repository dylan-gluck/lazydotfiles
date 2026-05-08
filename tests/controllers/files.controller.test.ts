import { describe, expect, test } from "bun:test";
import { buildUntrackedTree } from "../../src/controllers/files.controller";
import { makeCandidate } from "../../src/domain/candidate";
import { makeTrackedFile } from "../../src/domain/tracked-file";

const HOME = "/h";

describe("buildUntrackedTree", () => {
  test("nests deep file candidates under synthesized intermediate dirs", () => {
    const tree = buildUntrackedTree(
      [
        makeCandidate({ path: "/h/.config/git/config", kind: "file", reason: "include" }),
        makeCandidate({ path: "/h/.config/nvim/init.lua", kind: "file", reason: "include" }),
        makeCandidate({ path: "/h/.zshrc", kind: "file", reason: "include" }),
      ],
      [],
      HOME,
    );
    // Top-level: directory `.config` (children > 0) sorts before file `.zshrc`.
    expect(tree.map((n) => `${n.kind}:${n.name}`)).toEqual(["dir:.config", "file:.zshrc"]);
    const config = tree[0]!;
    expect(config.kind).toBe("dir");
    expect(config.candidateKind).toBeNull();
    expect(config.count).toBe(2);
    // Nested: synthesized `git` and `nvim` dirs each holding their leaf file.
    expect(config.children.map((c) => `${c.kind}:${c.name}`)).toEqual(["dir:git", "dir:nvim"]);
    const git = config.children[0]!;
    expect(git.candidateKind).toBeNull();
    expect(git.children.map((c) => c.name)).toEqual(["config"]);
    expect(git.children[0]!.kind).toBe("file");
    expect(git.children[0]!.candidateKind).toBe("file");
  });

  test("dot-directory candidates surface at the top with kind=dir and no children", () => {
    const tree = buildUntrackedTree(
      [makeCandidate({ path: "/h/.claude", kind: "directory", reason: "include" })],
      [],
      HOME,
    );
    expect(tree).toHaveLength(1);
    const node = tree[0]!;
    expect(node.kind).toBe("dir");
    expect(node.name).toBe(".claude");
    expect(node.candidateKind).toBe("directory");
    expect(node.children).toEqual([]);
    expect(node.count).toBe(1);
  });

  test("filters out paths that are already tracked", () => {
    const tree = buildUntrackedTree(
      [makeCandidate({ path: "/h/.zshrc", kind: "file", reason: "include" })],
      [
        makeTrackedFile({
          source: "/h/dotfiles/.zshrc",
          target: "/h/.zshrc",
          kind: "file",
          addedAt: "2026-01-01T00:00:00Z",
        }),
      ],
      HOME,
    );
    expect(tree).toEqual([]);
  });

  test("ignores candidates outside of home", () => {
    const tree = buildUntrackedTree(
      [makeCandidate({ path: "/elsewhere/.zshrc", kind: "file", reason: "include" })],
      [],
      HOME,
    );
    expect(tree).toEqual([]);
  });

  test("only counts pending candidates, not accepted/deferred ones", () => {
    const tree = buildUntrackedTree(
      [
        makeCandidate({
          path: "/h/.config/a",
          kind: "file",
          reason: "include",
          status: "pending",
        }),
        makeCandidate({
          path: "/h/.config/b",
          kind: "file",
          reason: "include",
          status: "deferred",
        }),
      ],
      [],
      HOME,
    );
    expect(tree).toHaveLength(1);
    expect(tree[0]!.count).toBe(1);
    expect(tree[0]!.children.map((c) => c.name)).toEqual(["a"]);
  });
});
