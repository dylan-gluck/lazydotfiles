import { afterEach, describe, expect, test } from "bun:test";
import type { UseHomePanel } from "../../controllers/home.controller";
import type { Operation } from "../../domain/repo";
import type { TrackedFile } from "../../domain/tracked-file";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { HomePanel } from "./home-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

const tracked = (over: Partial<TrackedFile> = {}): TrackedFile => ({
  id: "0123456789ab",
  source: "/h/.zshrc",
  target: "/h/dotfiles/.zshrc",
  kind: "file",
  addedAt: new Date(Date.now() - 60_000).toISOString(),
  status: "tracked",
  ...over,
});

const op = (over: Partial<Operation> = {}): Operation => ({
  id: "abcdef01",
  parentId: null,
  kind: "track",
  description: "track .zshrc",
  at: new Date(Date.now() - 60_000).toISOString(),
  filesTouched: [".zshrc"],
  ...over,
});

const model = (over: Partial<UseHomePanel> = {}): UseHomePanel => ({
  repoRoot: "/h/dotfiles",
  home: "/h",
  branchSummary: "main @ deadbeef",
  dirty: false,
  tracked: [],
  trackedCount: 0,
  queueCount: 0,
  queueGroups: [],
  queueGroupCount: 0,
  sync: {
    lastSyncAt: null,
    nextAutoSyncIso: null,
    ahead: 0,
    behind: 0,
    remote: null,
    autoInterval: null,
  },
  recentOperations: [],
  totalOperations: 0,
  toast: null,
  ...over,
});

async function render(m: UseHomePanel): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <HomePanel model={m} />
    </ThemeProvider>,
    { width: 100, height: 36 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("HomePanel", () => {
  test("renders header with repo path, branch, and clean flag", async () => {
    const frame = await render(model());
    expect(frame).toContain("~/dotfiles");
    expect(frame).toContain("main @ deadbeef");
    expect(frame).toContain("clean");
  });

  test("dirty flag rendered when dirty=true", async () => {
    const frame = await render(model({ dirty: true }));
    expect(frame).toContain("dirty");
  });

  test("renders four section headers in margin-note order", async () => {
    const frame = await render(model());
    expect(frame).toContain("tracked");
    expect(frame).toContain("discovery");
    expect(frame).toContain("sync");
    expect(frame).toContain("recent");
  });

  test("tracked section lists files with margin age and hint when focused", async () => {
    const frame = await render(
      model({
        tracked: [tracked({ id: "1", target: "/h/.zshrc" })],
        trackedCount: 1,
      }),
    );
    expect(frame).toContain("+ ~/.zshrc");
  });

  test("queue section renders top-level groups when pending", async () => {
    const frame = await render(
      model({
        queueCount: 41,
        queueGroups: [
          { segment: ".config", count: 30 },
          { segment: ".claude", count: 11 },
        ],
        queueGroupCount: 2,
      }),
    );
    expect(frame).toContain("? .config");
    expect(frame).toContain("? .claude");
    expect(frame).toContain("41 candidates");
  });

  test("queue section empty state prompts rescan", async () => {
    const frame = await render(model({ queueCount: 0, queueGroups: [], queueGroupCount: 0 }));
    expect(frame).toContain("queue empty");
    expect(frame).toContain("nothing pending");
  });

  test("sync section shows remote, ahead/behind, and last sync age", async () => {
    const frame = await render(
      model({
        sync: {
          lastSyncAt: new Date(Date.now() - 2 * 60_000).toISOString(),
          nextAutoSyncIso: null,
          ahead: 0,
          behind: 0,
          remote: "git@github.com:dylan/dotfiles.git",
          autoInterval: null,
        },
      }),
    );
    expect(frame).toContain("git@github.com:dylan/dotfiles.git");
    expect(frame).toContain("2m ago");
    expect(frame).toContain("auto-sync off");
  });

  test("recent section lists ops with id prefix and description", async () => {
    const frame = await render(
      model({
        recentOperations: [op({ id: "abcdef0123", description: "track .zshrc" })],
        totalOperations: 1,
      }),
    );
    expect(frame).toContain("abcdef0");
    expect(frame).toContain("track .zshrc");
  });

  test("renders toast in danger tone", async () => {
    const frame = await render(model({ toast: { message: "Repository", tone: "danger" } }));
    expect(frame).toContain("Repository");
  });
});
