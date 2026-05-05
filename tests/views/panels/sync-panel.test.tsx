import { afterEach, describe, expect, test } from "bun:test";
import type { UseSyncPanel } from "../../../src/controllers/sync.controller";
import { cleanState } from "../../../src/actors/sync.actor";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../../test-utils/render";
import { ThemeProvider } from "../../../src/views/theme";
import { SyncPanel } from "../../../src/views/panels/sync-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function noop(): void {}

function model(over: Partial<UseSyncPanel> = {}): UseSyncPanel {
  return {
    state: cleanState,
    conflicts: [],
    phase: "idle",
    schedule: { running: false, interval: null },
    error: null,
    fetch: noop,
    push: noop,
    syncNow: noop,
    resolve: noop,
    refresh: noop,
    ...over,
  };
}

async function render(m: UseSyncPanel): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <SyncPanel model={m} />
    </ThemeProvider>,
    { width: 100, height: 24 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("SyncPanel", () => {
  test("clean idle with no remote shows '(no remote)'", async () => {
    const frame = await render(model());
    expect(frame).toContain("(no remote)");
    expect(frame).toContain("[Fetch]");
    expect(frame).toContain("auto-sync");
  });

  test("ahead/behind counts render in header", async () => {
    const frame = await render(
      model({
        state: { ...cleanState, ahead: 3, behind: 1, remote: "origin" },
      }),
    );
    expect(frame).toContain("origin");
    expect(frame).toContain("3");
    expect(frame).toContain("1");
  });

  test("fetching phase shows progress text", async () => {
    const frame = await render(model({ phase: "fetching" }));
    expect(frame).toContain("fetching");
  });

  test("conflicts render per-file rows with focus marker", async () => {
    const frame = await render(
      model({
        conflicts: [
          { path: ".zshrc", kind: "ours" },
          { path: ".bashrc", kind: "theirs" },
        ],
      }),
    );
    expect(frame).toContain(".zshrc");
    expect(frame).toContain(".bashrc");
    expect(frame).toContain("›");
    expect(frame).toContain("conflicts");
  });

  test("error phase renders summarized error", async () => {
    const frame = await render(
      model({
        phase: "error",
        error: { tag: "NotFound", resource: "Repo", id: "x" },
      }),
    );
    expect(frame).toContain("Sync failed");
    expect(frame).toContain("Repo");
  });
});
