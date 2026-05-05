import { afterEach, describe, expect, test } from "bun:test";
import type { UseConfigPanel } from "../../../src/controllers/config.controller";
import { defaultConfig } from "../../../src/domain/config";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../../test-utils/render";
import { ThemeProvider } from "../../../src/views/theme";
import { ConfigPanel } from "../../../src/views/panels/config-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function noop(): void {}

function model(over: Partial<UseConfigPanel> = {}): UseConfigPanel {
  return {
    status: "ready",
    config: defaultConfig(),
    error: null,
    set: noop,
    reload: noop,
    ...over,
  };
}

async function render(m: UseConfigPanel): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <ConfigPanel model={m} />
    </ThemeProvider>,
    { width: 120, height: 40 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("ConfigPanel", () => {
  test("renders all sections and rows from default config", async () => {
    const frame = await render(model());
    expect(frame).toContain("Paths");
    expect(frame).toContain("Discovery");
    expect(frame).toContain("Options");
    expect(frame).toContain("Experimental");
    expect(frame).toContain("path.home");
    expect(frame).toContain("$HOME/dotfiles");
    expect(frame).toContain("discovery.auto_track");
    expect(frame).toContain("true");
    expect(frame).toContain("options.vcs");
    expect(frame).toContain("jj");
  });

  test("renders loading state with no config", async () => {
    const frame = await render(model({ status: "loading", config: null }));
    expect(frame).toContain("loading config");
  });

  test("renders error banner when service error present", async () => {
    const frame = await render(
      model({ error: { tag: "NotFound", resource: "ConfigOption", id: "options.bogus" } }),
    );
    expect(frame).toContain("ConfigOption");
  });
});
