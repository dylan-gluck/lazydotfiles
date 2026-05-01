import { afterEach, describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { ThemeProvider } from "../theme";
import { ConfirmModal } from "./confirm-modal";

let testSetup: Awaited<ReturnType<typeof testRender>> | undefined;

afterEach(() => {
  if (testSetup) {
    testSetup.renderer.destroy();
    testSetup = undefined;
  }
});

function noop(): void {}

async function render(node: ReturnType<typeof ConfirmModal>): Promise<string> {
  testSetup = await testRender(<ThemeProvider mode="dark">{node}</ThemeProvider>, {
    width: 100,
    height: 24,
  });
  await testSetup.renderOnce();
  return testSetup.captureCharFrame();
}

describe("ConfirmModal", () => {
  test("renders title, summary, paths, backupDestination", async () => {
    const frame = await render(
      <ConfirmModal
        title="Untrack file"
        summary="Untrack /h/.zshrc?"
        paths={["/h/.zshrc", "/d/.zshrc"]}
        backupDestination="/b/abc/...-remove"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(frame).toContain("Untrack file");
    expect(frame).toContain("Untrack /h/.zshrc?");
    expect(frame).toContain("/h/.zshrc");
    expect(frame).toContain("/d/.zshrc");
    expect(frame).toContain("backup");
    expect(frame).toContain("/b/abc/...-remove");
    expect(frame).toContain("Confirm");
    expect(frame).toContain("Cancel");
  });

  test("omits backup line when destination undefined", async () => {
    const frame = await render(
      <ConfirmModal
        title="Confirm"
        summary="Sure?"
        paths={["/x"]}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(frame).not.toContain("backup →");
  });
});
