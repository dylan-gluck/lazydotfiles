import { afterEach, describe, expect, test } from "bun:test";
import { act } from "react";
import type { UseTrackedPanel } from "../../controllers/track.controller";
import type { TrackedFile } from "../../domain/tracked-file";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { TrackedPanel } from "./tracked-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function noop(): void {}

function model(over: Partial<UseTrackedPanel> = {}): UseTrackedPanel {
  return {
    tracked: [],
    inFlight: null,
    error: null,
    backups: new Map(),
    loadingBackups: false,
    refreshBackups: noop,
    add: noop,
    remove: noop,
    clearError: noop,
    ...over,
  };
}

const file = (over: Partial<TrackedFile> = {}): TrackedFile => ({
  id: "abc",
  source: "/d/.zshrc",
  target: "/h/.zshrc",
  kind: "file",
  addedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  status: "tracked",
  ...over,
});

async function render(
  m: UseTrackedPanel,
  onViewLog?: (target: string) => void,
): Promise<{ frame: string; setup: TestSetup }> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <TrackedPanel model={m} onViewLog={onViewLog} />
    </ThemeProvider>,
    { width: 100, height: 24 },
  );
  testSetup = result.setup;
  return { frame: result.frame, setup: result.setup };
}

describe("TrackedPanel", () => {
  test("empty state", async () => {
    const { frame } = await render(model());
    expect(frame).toContain("No tracked files");
  });

  test("renders rows with basename + age (kind shown in detail pane)", async () => {
    const { frame } = await render(
      model({
        tracked: [file({ id: "a", target: "/h/.zshrc" }), file({ id: "b", target: "/h/.bashrc" })],
      }),
    );
    // Sidebar uses basename only — no full path.
    expect(frame).toContain(".zshrc");
    expect(frame).toContain(".bashrc");
    // Kind appears in detail pane label.
    expect(frame).toContain("kind: file");
  });

  test("renders error state with shared summarizer", async () => {
    const { frame } = await render(
      model({
        error: { tag: "InvalidTarget", reason: "missing", path: "/h/.zshrc" },
      }),
    );
    expect(frame).toContain("invalid target");
    expect(frame).toContain("missing");
  });

  test("inFlight shows tracking… footer", async () => {
    const { frame } = await render(
      model({
        tracked: [file()],
        inFlight: { kind: "add", path: "/h/.zshrc" },
      }),
    );
    expect(frame).toContain("tracking");
  });

  test("Enter on focused row calls onViewLog with focused target", async () => {
    const calls: string[] = [];
    const { setup } = await render(model({ tracked: [file({ target: "/h/.zshrc" })] }), (target) =>
      calls.push(target),
    );
    await act(async () => {
      setup.mockInput.pressEnter();
      await setup.renderOnce();
    });
    expect(calls).toEqual(["/h/.zshrc"]);
  });
});
