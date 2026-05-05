import { afterEach, describe, expect, test } from "bun:test";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../../test-utils/render";
import { ThemeProvider } from "../../../src/views/theme";
import { AppShell } from "../../../src/views/components/app-shell";
import {
  PanelBindingsProvider,
  usePublishPanelBindings,
  usePublishPanelLabel,
} from "../../../src/views/components/panel-bindings-context";

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
  readonly label?: string;
  readonly bindings: readonly { keys: string; description: string }[];
  readonly children: React.ReactNode;
}): React.ReactNode {
  if (props.label !== undefined) usePublishPanelLabel(props.label);
  usePublishPanelBindings(props.bindings);
  return props.children;
}

describe("AppShell", () => {
  test("renders child content and ? more hint", async () => {
    const frame = await render(
      <AppShell>
        <text>body</text>
      </AppShell>,
    );
    expect(frame).toContain("body");
    expect(frame).toContain("? more");
    // No nav-key clutter when the active panel publishes nothing.
    expect(frame).not.toContain("[1] status");
  });

  test("renders panel-published bindings inline in the footer", async () => {
    const frame = await render(
      <AppShell>
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
    expect(frame).toContain("a/A");
    expect(frame).toContain("accept");
    expect(frame).toContain("search");
    expect(frame).toContain("? more");
  });

  test("renders the panel label as a leading chip", async () => {
    const frame = await render(
      <AppShell>
        <PanelStub label="discover" bindings={[{ keys: "a", description: "accept" }]}>
          <text>body</text>
        </PanelStub>
      </AppShell>,
    );
    expect(frame).toContain("discover");
  });

  test("AppHeader fallback renders default repo + branch tokens with no actor context", async () => {
    const frame = await render(
      <AppShell>
        <text>x</text>
      </AppShell>,
    );
    // AppHeader fallback when actor runtime is absent.
    expect(frame).toContain("~/dotfiles");
    expect(frame).toContain("main");
    expect(frame).toContain("clean");
    expect(frame).toContain("queue empty");
  });
});
