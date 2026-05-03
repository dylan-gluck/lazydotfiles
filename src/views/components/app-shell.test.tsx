import { afterEach, describe, expect, test } from "bun:test";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { AppShell } from "./app-shell";
import {
  PanelBindingsProvider,
  usePublishPanelBindings,
} from "./panel-bindings-context";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

async function render(node: React.ReactNode): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <PanelBindingsProvider>{node}</PanelBindingsProvider>
    </ThemeProvider>,
    {
      width: 120,
      height: 12,
    },
  );
  testSetup = result.setup;
  return result.frame;
}

function PanelStub(props: {
  readonly bindings: readonly { keys: string; description: string }[];
  readonly children: React.ReactNode;
}): React.ReactNode {
  usePublishPanelBindings(props.bindings);
  return props.children;
}

describe("AppShell", () => {
  test("renders child content, current path, and ? help hint", async () => {
    const frame = await render(
      <AppShell currentPath="/tracked">
        <text>body</text>
      </AppShell>,
    );
    expect(frame).toContain("body");
    expect(frame).toContain("/tracked");
    expect(frame).toContain("? help");
    // No nav-key clutter when the active panel publishes nothing.
    expect(frame).not.toContain("[1] status");
  });

  test("renders panel-published bindings in the footer", async () => {
    const frame = await render(
      <AppShell currentPath="/discover">
        <PanelStub
          bindings={[
            { keys: "a/A", description: "accept" },
            { keys: "/", description: "search" },
          ]}
        >
          <text>body</text>
        </PanelStub>
      </AppShell>,
    );
    expect(frame).toContain("a/A accept");
    expect(frame).toContain("/ search");
    expect(frame).toContain("? help");
    expect(frame).toContain("/discover");
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
