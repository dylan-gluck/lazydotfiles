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
    width: 100,
    height: 12,
  });
  testSetup = result.setup;
  return result.frame;
}

describe("AppShell", () => {
  test("renders title, current path, and footer hint", async () => {
    const frame = await render(
      <AppShell title="lazydotfiles" currentPath="/tracked" hint="[q] quit">
        <text>body</text>
      </AppShell>,
    );
    expect(frame).toContain("lazydotfiles");
    expect(frame).toContain("/tracked");
    expect(frame).toContain("[q] quit");
    expect(frame).toContain("body");
  });

  test("falls back to default footer hint", async () => {
    const frame = await render(
      <AppShell title="lazydotfiles" currentPath="/">
        <text>x</text>
      </AppShell>,
    );
    expect(frame).toContain("[?] help");
    expect(frame).toContain("[q] quit");
  });
});
