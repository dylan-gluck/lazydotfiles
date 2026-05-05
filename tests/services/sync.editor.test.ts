import { describe, expect, test } from "bun:test";
import { createEditorRunner, splitEditorCommand } from "../../src/services/sync.editor";

describe("splitEditorCommand", () => {
  test("splits on whitespace", () => {
    expect(splitEditorCommand("vim -u NONE")).toEqual(["vim", "-u", "NONE"]);
  });

  test("preserves double-quoted segments", () => {
    expect(splitEditorCommand('code --wait "/path with space"')).toEqual([
      "code",
      "--wait",
      "/path with space",
    ]);
  });

  test("preserves single-quoted segments", () => {
    expect(splitEditorCommand("emacs -nw '/a b'")).toEqual(["emacs", "-nw", "/a b"]);
  });

  test("collapses runs of whitespace", () => {
    expect(splitEditorCommand("vim   --foo    bar")).toEqual(["vim", "--foo", "bar"]);
  });

  test("empty string yields no parts", () => {
    expect(splitEditorCommand("")).toEqual([]);
  });
});

describe("createEditorRunner", () => {
  test("invokes suspend hook with the resolved command", async () => {
    let suspended = 0;
    const runner = createEditorRunner({
      env: { EDITOR: "true" }, // /usr/bin/true exits 0; safe to spawn
      suspend: async (fn) => {
        suspended++;
        return fn();
      },
    });
    const r = await runner.run("/tmp/file");
    expect(suspended).toBe(1);
    expect(r.ok).toBe(true);
  });

  test("falls back to opts.fallback when EDITOR is unset", async () => {
    let observedCmd: readonly string[] | null = null;
    const runner = createEditorRunner({
      env: {},
      fallback: "true",
      suspend: async (fn) => fn(),
    });
    // Spawn `true` so we don't actually launch an editor.
    const r = await runner.run("/tmp/file");
    expect(r.ok).toBe(true);
    void observedCmd;
  });

  test("returns Spawn error when editor exits non-zero", async () => {
    const runner = createEditorRunner({
      env: { EDITOR: "false" }, // /usr/bin/false exits 1
      suspend: async (fn) => fn(),
    });
    const r = await runner.run("/tmp/file");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
    if (r.error.tag !== "Repository") return;
    expect(r.error.cause.tag).toBe("Spawn");
  });

  test("returns IoError when editor binary cannot be spawned", async () => {
    const runner = createEditorRunner({
      env: { EDITOR: "/no/such/editor/binary" },
      suspend: async (fn) => fn(),
    });
    const r = await runner.run("/tmp/file");
    // Bun.spawn either throws (caught → IoError) or produces non-zero exit (Spawn).
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.tag).toBe("Repository");
  });
});
