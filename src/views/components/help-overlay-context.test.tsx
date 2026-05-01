import { afterEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import {
  HelpOverlayProvider,
  type HelpOverlayController,
  useHelpOverlay,
} from "./help-overlay-context";

let testSetup: TestSetup | undefined;

afterEach(() => {
  destroyTestSetup(testSetup);
  testSetup = undefined;
});

function Capture(props: { sink: { current: HelpOverlayController | null } }) {
  const ctrl = useHelpOverlay();
  props.sink.current = ctrl;
  return <text>{ctrl.open ? "open" : "closed"}</text>;
}

async function mount(): Promise<{
  ctrl: { current: HelpOverlayController | null };
  rerender: () => Promise<string>;
}> {
  const sink: { current: HelpOverlayController | null } = { current: null };
  const result = await renderToFrame(
    <HelpOverlayProvider>
      <Capture sink={sink} />
    </HelpOverlayProvider>,
    { width: 40, height: 4 },
  );
  testSetup = result.setup;
  return {
    ctrl: sink,
    rerender: async () => {
      await act(async () => {
        await result.setup.renderOnce();
      });
      return result.setup.captureCharFrame();
    },
  };
}

describe("HelpOverlayProvider", () => {
  test("default state is closed", async () => {
    const { ctrl, rerender } = await mount();
    const frame = await rerender();
    expect(frame).toContain("closed");
    expect(ctrl.current?.open).toBe(false);
  });

  test("toggle flips open", async () => {
    const { ctrl, rerender } = await mount();
    await act(async () => {
      ctrl.current?.toggle();
    });
    const frame = await rerender();
    expect(frame).toContain("open");
  });

  test("close sets open to false", async () => {
    const { ctrl, rerender } = await mount();
    await act(async () => {
      ctrl.current?.toggle();
    });
    await rerender();
    await act(async () => {
      ctrl.current?.close();
    });
    const frame = await rerender();
    expect(frame).toContain("closed");
  });
});
