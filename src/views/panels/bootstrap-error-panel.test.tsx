import { afterEach, describe, expect, test } from "bun:test";
import type { ServiceError } from "../../services/types";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { BootstrapErrorPanel } from "./bootstrap-error-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

async function render(error: ServiceError): Promise<string> {
  const result = await renderToFrame(
    <ThemeProvider mode="dark">
      <BootstrapErrorPanel error={error} />
    </ThemeProvider>,
    { width: 100, height: 24 },
  );
  testSetup = result.setup;
  return result.frame;
}

describe("BootstrapErrorPanel", () => {
  test("renders NotFound error", async () => {
    const frame = await render({ tag: "NotFound", resource: "Config", id: "/etc/lazydotfiles" });
    expect(frame).toContain("Bootstrap failed");
    expect(frame).toContain("NotFound");
    expect(frame).toContain("Config not found");
  });

  test("renders Repository spawn error with stderr", async () => {
    const frame = await render({
      tag: "Repository",
      cause: {
        tag: "Spawn",
        command: ["jj", "git", "init"],
        exitCode: 1,
        stderr: "permission denied",
      },
    });
    expect(frame).toContain("command failed");
    expect(frame).toContain("permission denied");
  });
});
