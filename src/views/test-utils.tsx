import { testRender } from "@opentui/react/test-utils";
import { act, type ReactNode } from "react";

export type TestSetup = Awaited<ReturnType<typeof testRender>>;

/**
 * Wraps `testRender` + `renderOnce` in `act(...)` so React effects
 * (e.g. `useEffect` that calls `setState`) flush inside an act scope.
 * Without this wrapper, components that schedule state updates during
 * mount produce "update was not wrapped in act(...)" warnings.
 */
export async function renderToFrame(
   node: ReactNode,
   options: Parameters<typeof testRender>[1],
): Promise<{ setup: TestSetup; frame: string }> {
   const setup = await testRender(node, options);
   await act(async () => {
      await setup.renderOnce();
   });
   return { setup, frame: setup.captureCharFrame() };
}

/**
 * `renderer.destroy()` synchronously unmounts the React tree via a DESTROY
 * event listener registered by `createRoot`, which calls
 * `reconciler.updateContainer(null, …)` + `flushSyncWork()` outside of any
 * act scope and produces "update was not wrapped in act(...)" warnings.
 * Wrap teardown to keep React quiet.
 */
export function destroyTestSetup(setup: TestSetup | undefined): void {
   if (!setup) return;
   act(() => {
      setup.renderer.destroy();
   });
}
