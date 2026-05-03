import { afterEach, describe, expect, test } from "bun:test";
import type { UseLogPanel } from "../../controllers/log.controller";
import type { OperationView } from "../../domain/repo";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { describeOp, LogPanel } from "./log-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function noop(): void {}

function model(over: Partial<UseLogPanel> = {}): UseLogPanel {
  return {
    operations: [],
    status: "ready",
    error: null,
    focusId: null,
    diff: null,
    diffLoading: false,
    restoring: null,
    focus: noop,
    loadDiff: noop,
    restoreToOp: noop,
    restoreFromLatestBackup: noop,
    refresh: noop,
    ...over,
  };
}

const op = (over: Partial<OperationView> = {}): OperationView => ({
  opId: "abc12345",
  changeId: "chg99999",
  parentOpId: null,
  kind: "track",
  description: "track .zshrc",
  at: new Date(Date.now() - 10 * 60_000).toISOString(),
  filesTouched: [".zshrc"],
  ...over,
});

async function render(m: UseLogPanel): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <LogPanel model={m} />
    </ThemeProvider>,
    { width: 100, height: 24 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("LogPanel", () => {
  test("empty state", async () => {
    const frame = await render(model());
    expect(frame).toContain("No operations");
  });

  test("renders rows with description, kind icon, short opId, age", async () => {
    const frame = await render(
      model({ operations: [op({ description: "track .zshrc" })], focusId: "abc12345" }),
    );
    expect(frame).toContain("track .zshrc");
    expect(frame).toContain("abc12345");
    // Track icon present.
    expect(frame).toContain("+");
  });

  test("renders error state", async () => {
    const frame = await render(
      model({ status: "error", error: { tag: "NotFound", resource: "x", id: "y" } }),
    );
    expect(frame).toContain("Log unavailable");
  });

  test("renders diff when loaded for the focused op", async () => {
    const frame = await render(
      model({
        operations: [op()],
        focusId: "abc12345",
        diff: { opId: "abc12345", text: "diff --git a/.zshrc b/.zshrc\n+alias g=jj\n" },
      }),
    );
    expect(frame).toContain("diff --git");
    expect(frame).toContain("alias g=jj");
  });

  test("restoring footer reflects actor state", async () => {
    const frame = await render(model({ restoring: { kind: "op" } }));
    expect(frame).toContain("restoring (op)");
  });
});

describe("describeOp", () => {
  test("uses the description when present", () => {
    const label = describeOp(op({ description: "track .zshrc" }));
    expect(label).toContain("track .zshrc");
    expect(label).toContain("abc12345");
  });

  test("falls back to kind + short hash + age when description is empty", () => {
    const label = describeOp(op({ description: "" }));
    expect(label).not.toContain("()");
    expect(label).toContain("track");
    expect(label).toContain("abc12345");
  });

  test("trims whitespace-only descriptions to the fallback", () => {
    const label = describeOp(op({ description: "   " }));
    expect(label).not.toContain("()");
    expect(label).toContain("abc12345");
  });
});
