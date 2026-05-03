import { afterEach, describe, expect, test } from "bun:test";
import { globalKeymap } from "../../controllers/keymap";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { HelpDrawer } from "./help-drawer";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function noop(): void {}

async function render(activeLabel: string | null = "discover"): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <HelpDrawer
        activeLabel={activeLabel}
        activeBindings={[
          { keys: "a", description: "accept" },
          { keys: "d", description: "defer" },
          { keys: "/", description: "search" },
        ]}
        onClose={noop}
      />
    </ThemeProvider>,
    { width: 120, height: 30 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("HelpDrawer", () => {
  test("renders the active panel label as a section heading", async () => {
    const frame = await render("discover");
    expect(frame).toContain("discover");
  });

  test("renders the Global section heading", async () => {
    const frame = await render();
    expect(frame).toContain("Global");
  });

  test("renders global keymap keys and descriptions", async () => {
    const frame = await render();
    for (const b of globalKeymap) {
      expect(frame).toContain(b.description.toLowerCase());
      for (const k of b.keys) expect(frame).toContain(k);
    }
  });

  test("renders the close hint", async () => {
    const frame = await render();
    expect(frame).toContain("?/esc");
    expect(frame).toContain("close help");
  });

  test("falls back to 'Panel' when no active label is set", async () => {
    const frame = await render(null);
    expect(frame).toContain("Panel");
  });
});
