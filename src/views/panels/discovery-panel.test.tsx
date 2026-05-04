import { afterEach, describe, expect, test } from "bun:test";
import { makeCandidate } from "../../domain/candidate";
import type { UseDiscoveryPanel } from "../../controllers/discovery.controller";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { DiscoveryPanel } from "./discovery-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function noop(): void {}

function model(overrides: Partial<UseDiscoveryPanel> = {}): UseDiscoveryPanel {
  return {
    status: "ready",
    queue: [],
    autoTracked: [],
    error: null,
    counts: { pending: 0, accepted: 0, rejected: 0, deferred: 0 },
    rescan: noop,
    accept: noop,
    reject: noop,
    defer: noop,
    acceptMany: noop,
    deferMany: noop,
    rejectMany: noop,
    restore: noop,
    expand: noop,
    ...overrides,
  };
}

async function render(
  m: UseDiscoveryPanel,
  size: { width: number; height: number } = { width: 80, height: 24 },
  extra: { dotfiles?: string; backupRoot?: string } = {},
): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <DiscoveryPanel model={m} home="/h" dotfiles={extra.dotfiles} backupRoot={extra.backupRoot} />
    </ThemeProvider>,
    size,
  );
  testSetup = result.setup;
  return result.frame;
}

describe("DiscoveryPanel", () => {
  test("renders empty state when queue is empty", async () => {
    const frame = await render(model());
    expect(frame).toContain("No candidates yet");
  });

  test("renders 'all caught up' when no pending remain but accepted exist", async () => {
    const c = makeCandidate({ path: "/h/.zshrc", kind: "file", reason: "include" });
    const frame = await render(
      model({
        queue: [{ ...c, status: "accepted" }],
        counts: { pending: 0, accepted: 1, rejected: 0, deferred: 0 },
      }),
    );
    expect(frame).toContain("All caught up");
  });

  test("renders top-level dirs collapsed with aggregated counts", async () => {
    const c1 = makeCandidate({
      path: "/h/.config/fish/config.fish",
      kind: "file",
      reason: "include",
    });
    const c2 = makeCandidate({
      path: "/h/.config/fish/functions/greet.fish",
      kind: "file",
      reason: "sibling-of",
    });
    const c3 = makeCandidate({ path: "/h/.zshrc", kind: "file", reason: "include" });
    const frame = await render(
      model({
        queue: [c1, c2, c3],
        counts: { pending: 3, accepted: 0, rejected: 0, deferred: 0 },
      }),
    );
    // Top-level dir name visible.
    expect(frame).toContain(".config");
    // Direct top-level file visible inline (no triangle).
    expect(frame).toContain(".zshrc");
    // Aggregated count includes all descendants (2 under .config).
    expect(frame).toContain("2 pending");
    // Subdir names NOT shown when parent is collapsed.
    expect(frame).not.toContain("fish");
    expect(frame).not.toContain("greet.fish");
    // Header shows totals.
    expect(frame).toContain("3 candidates");
  });

  test("renders scanning indicator", async () => {
    const frame = await render(model({ status: "scanning" }));
    expect(frame).toContain("scanning");
  });

  test("renders error state with cause message", async () => {
    const frame = await render(
      model({
        status: "error",
        error: {
          tag: "Repository",
          cause: { tag: "IoError", path: "/h", cause: new Error("boom") },
        },
      }),
    );
    expect(frame).toContain("Discovery failed");
    expect(frame).toContain("boom");
  });

  test("inline-expands focused candidate with on-accept move plan", async () => {
    const c = makeCandidate({
      path: "/h/.zshrc",
      kind: "file",
      reason: "include",
    });
    const frame = await render(
      model({
        queue: [c],
        counts: { pending: 1, accepted: 0, rejected: 0, deferred: 0 },
      }),
      { width: 100, height: 30 },
      { dotfiles: "/h/dotfiles", backupRoot: "/h/.dotfiles.bak" },
    );
    // Preview labels appear inline below the focused candidate row.
    expect(frame).toContain("path");
    expect(frame).toContain("reason");
    expect(frame).toContain("on accept");
    expect(frame).toContain("symlink replaces original");
    // Move plan tildifies both endpoints.
    expect(frame).toContain("~/.zshrc");
    expect(frame).toContain("~/dotfiles/.zshrc");
    // Backup destination uses configured root and the candidate id prefix.
    expect(frame).toContain("~/.dotfiles.bak");
    // jj describe message shows the relative path.
    expect(frame).toContain('jj describe -m "track .zshrc"');
  });

  test("hides deeply nested paths until parent is expanded", async () => {
    const deep = makeCandidate({
      path: "/h/.config/some/deeply/nested/dir/config.toml",
      kind: "file",
      reason: "include",
    });
    const frame = await render(
      model({
        queue: [deep],
        counts: { pending: 1, accepted: 0, rejected: 0, deferred: 0 },
      }),
      { width: 80, height: 24 },
    );
    // Only the top-level dir is visible by default.
    expect(frame).toContain(".config");
    // Aggregate count from the single descendant.
    expect(frame).toContain("1 pending");
    // Nested segments hidden until expand.
    expect(frame).not.toContain("nested");
    expect(frame).not.toContain("config.toml");
    // No row exceeds 80 cells.
    for (const line of frame.split("\n")) {
      expect(line.replace(/\s+$/, "").length).toBeLessThanOrEqual(80);
    }
  });
});
