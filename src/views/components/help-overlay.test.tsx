import { afterEach, describe, expect, test } from "bun:test";
import { globalKeymap } from "../../controllers/keymap";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { HelpOverlay } from "./help-overlay";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function noop(): void {}

async function render(): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <HelpOverlay bindings={[...globalKeymap]} onClose={noop} />
    </ThemeProvider>,
    { width: 100, height: 30 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("HelpOverlay", () => {
  test("renders Keybindings header", async () => {
    const frame = await render();
    expect(frame).toContain("Keybindings");
  });

  test("renders one row per binding (keys + description)", async () => {
    const frame = await render();
    for (const b of globalKeymap) {
      expect(frame).toContain(b.description);
      for (const k of b.keys) expect(frame).toContain(k);
    }
  });

  test("instructions reference esc and ?", async () => {
    const frame = await render();
    expect(frame).toContain("esc");
    expect(frame).toContain("?");
  });
});
