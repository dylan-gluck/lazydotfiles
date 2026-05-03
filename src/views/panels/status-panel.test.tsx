import { afterEach, describe, expect, test } from "bun:test";
import type { UseStatusPanel } from "../../controllers/status.controller";
import type { Operation } from "../../domain/repo";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { StatusPanel } from "./status-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function model(over: Partial<UseStatusPanel> = {}): UseStatusPanel {
  return {
    repoRoot: "/u/dotfiles",
    dirty: false,
    trackedCount: 0,
    queueCount: 0,
    sync: { lastSyncAt: null, ahead: 0, behind: 0, remote: null },
    recentOperations: [],
    toast: null,
    ...over,
  };
}

const op = (over: Partial<Operation> = {}): Operation => ({
  id: "deadbeefcafe",
  parentId: null,
  kind: "track",
  description: "track .zshrc",
  at: new Date(Date.now() - 60_000).toISOString(),
  filesTouched: [".zshrc"],
  ...over,
});

async function render(m: UseStatusPanel): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <StatusPanel model={m} />
    </ThemeProvider>,
    { width: 100, height: 24 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("StatusPanel", () => {
  test("renders header repo root and clean flag", async () => {
    const frame = await render(model());
    expect(frame).toContain("/u/dotfiles");
    expect(frame).toContain("clean");
  });

  test("renders three counter cards", async () => {
    const frame = await render(model({ trackedCount: 12, queueCount: 4 }));
    expect(frame).toContain("Tracked");
    expect(frame).toContain("12");
    expect(frame).toContain("Discovery queue");
    expect(frame).toContain("4");
    expect(frame).toContain("Sync");
  });

  test("renders recent operations", async () => {
    const frame = await render(
      model({
        recentOperations: [op({ id: "aaaa1111", description: "track .zshrc" })],
      }),
    );
    expect(frame).toContain("aaaa1111");
    expect(frame).toContain("track .zshrc");
  });

  test("renders toast in danger tone", async () => {
    const frame = await render(model({ toast: { message: "Repository", tone: "danger" } }));
    expect(frame).toContain("Repository");
  });

  test("dirty flag rendered when dirty=true", async () => {
    const frame = await render(model({ dirty: true }));
    expect(frame).toContain("dirty");
  });
});
