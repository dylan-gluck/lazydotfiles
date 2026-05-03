import { afterEach, describe, expect, test } from "bun:test";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { AppShell } from "./app-shell";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

async function render(node: React.ReactNode): Promise<string> {
  const result = await renderToFrame(<ThemeProvider mode="dark">{node}</ThemeProvider>, {
    width: 120,
    height: 12,
  });
  testSetup = result.setup;
  return result.frame;
}

describe("AppShell", () => {
  test("renders child content, current path, and global keybind footer", async () => {
    const frame = await render(
      <AppShell currentPath="/tracked">
        <text>body</text>
      </AppShell>,
    );
    expect(frame).toContain("body");
    expect(frame).toContain("/tracked");
    // Footer advertises every binding from the global keymap.
    expect(frame).toContain("[1] status");
    expect(frame).toContain("[7] sync");
    expect(frame).toContain("[?] help");
    expect(frame).toContain("[q] quit");
  });

  test("does not render a top header (no title bar)", async () => {
    const frame = await render(
      <AppShell currentPath="/">
        <text>x</text>
      </AppShell>,
    );
    expect(frame).not.toContain("lazydotfiles");
  });
});
