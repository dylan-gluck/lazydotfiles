import { afterEach, describe, expect, test } from "bun:test";
import { makeCandidate } from "../../domain/candidate";
import type { UseDiscoveryPanel } from "../../controllers/discovery.controller";
import { destroyTestSetup, renderToFrame, type TestSetup } from "../test-utils";
import { ThemeProvider } from "../theme";
import { DiscoveryPanel } from "./discovery-panel";

let testSetup: TestSetup | undefined;

afterEach(() => {
   destroyTestSetup(testSetup);
   testSetup = undefined;
});

function noop(): void { }

function model(overrides: Partial<UseDiscoveryPanel> = {}): UseDiscoveryPanel {
   return {
      status: "ready",
      queue: [],
      autoTracked: [],
      error: null,
      counts: { pending: 0, accepted: 0, rejected: 0, deferred: 0 },
      rescan: noop,
      accept: noop,
      reject: noop,
      defer: noop,
      expand: noop,
      ...overrides,
   };
}

async function render(m: UseDiscoveryPanel): Promise<string> {
   const result = await renderToFrame(
      <ThemeProvider mode="dark">
         <DiscoveryPanel model={m} />
      </ThemeProvider>,
      { width: 80, height: 24 },
   );
   testSetup = result.setup;
   return result.frame;
}

describe("DiscoveryPanel", () => {
   test("renders empty state when queue is empty", async () => {
      const frame = await render(model());
      expect(frame).toContain("No candidates");
   });

   test("renders sidebar entries grouped by parent dir", async () => {
      const c1 = makeCandidate({
         path: "/h/.config/fish/config.fish",
         kind: "file",
         reason: "include",
      });
      const c2 = makeCandidate({
         path: "/h/.config/fish/functions/greet.fish",
         kind: "file",
         reason: "sibling-of",
      });
      const c3 = makeCandidate({ path: "/h/.zshrc", kind: "file", reason: "include" });
      const frame = await render(
         model({
            queue: [c1, c2, c3],
            counts: { pending: 3, accepted: 0, rejected: 0, deferred: 0 },
         }),
      );
      expect(frame).toContain("config.fish");
      expect(frame).toContain("greet.fish");
      expect(frame).toContain(".zshrc");
      expect(frame).toContain("/h/.config/fish");
   });

   test("renders scanning indicator", async () => {
      const frame = await render(model({ status: "scanning" }));
      expect(frame).toContain("scanning");
   });

   test("renders error state with cause message", async () => {
      const frame = await render(
         model({
            status: "error",
            error: {
               tag: "Repository",
               cause: { tag: "IoError", path: "/h", cause: new Error("boom") },
            },
         }),
      );
      expect(frame).toContain("Discovery failed");
      expect(frame).toContain("boom");
   });
});
