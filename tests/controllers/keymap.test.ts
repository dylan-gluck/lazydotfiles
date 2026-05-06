import { describe, expect, test } from "bun:test";
import type { KeyEvent } from "@opentui/core";
import {
  type Binding,
  dispatchKeymap,
  globalKeymap,
  type KeymapContext,
} from "../../src/controllers/keymap";

function key(name: string): KeyEvent {
  return { name, sequence: name } as unknown as KeyEvent;
}

function makeCtx(overrides: Partial<KeymapContext> = {}): KeymapContext {
  return {
    router: { navigate: () => Promise.resolve() } as unknown as KeymapContext["router"],
    renderer: { destroy: () => {} },
    ui: { toggleHelp: () => {} },
    actions: {
      sync: () => {},
      fetch: () => {},
      push: () => {},
      rescan: () => {},
    },
    inputActive: false,
    ...overrides,
  };
}

describe("dispatchKeymap", () => {
  test("runs first matching binding and returns true", () => {
    let count = 0;
    const table: Binding[] = [
      { keys: ["a"], description: "first", run: () => count++ },
      { keys: ["a"], description: "second", run: () => count++ },
    ];
    expect(dispatchKeymap(table, key("a"), makeCtx())).toBe(true);
    expect(count).toBe(1);
  });

  test("returns false on no match", () => {
    const table: Binding[] = [{ keys: ["a"], description: "x", run: () => {} }];
    expect(dispatchKeymap(table, key("b"), makeCtx())).toBe(false);
  });

  test("honors `when` predicate", () => {
    let ran = false;
    const table: Binding[] = [
      { keys: ["a"], description: "x", when: () => false, run: () => (ran = true) },
    ];
    expect(dispatchKeymap(table, key("a"), makeCtx())).toBe(false);
    expect(ran).toBe(false);
  });

  test("q invokes renderer.destroy via global keymap", () => {
    let destroyed = false;
    const ctx = makeCtx({ renderer: { destroy: () => (destroyed = true) } });
    expect(dispatchKeymap(globalKeymap, key("q"), ctx)).toBe(true);
    expect(destroyed).toBe(true);
  });

  test("globalKeymap covers 1, 2, 3, ?, q", () => {
    const keys = new Set(globalKeymap.flatMap((b) => b.keys));
    for (const k of ["1", "2", "3", "?", "q"]) expect(keys.has(k)).toBe(true);
  });
});
