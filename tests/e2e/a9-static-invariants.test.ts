import { describe, expect, test } from "bun:test";

/**
 * PRD A9: no `process.exit()` outside the binary entry; no hand-rolled width/
 * height for layout flow; no hex literals outside `views/theme/`.
 *
 * The actual scans live alongside the source they protect:
 *   - src/views/no-process-exit.test.ts
 *   - src/views/layout-discipline.test.ts
 *   - src/views/theme/no-hex-literals.test.ts
 *
 * This e2e file is an explicit acceptance handshake: when `bun test` runs the
 * tests/ tree, A9 has a named test the acceptance audit can point at. It also
 * verifies the `scripts/check-layers.ts` aggregator script exists so CI can
 * invoke `bun run check:layers` once.
 */
describe("A9 static invariants", () => {
  test("aggregator script exists at scripts/check-layers.ts", async () => {
    expect(await Bun.file("scripts/check-layers.ts").exists()).toBe(true);
  });

  test("guard tests exist at their canonical paths", async () => {
    expect(await Bun.file("src/views/no-process-exit.test.ts").exists()).toBe(true);
    expect(await Bun.file("src/views/layout-discipline.test.ts").exists()).toBe(true);
    expect(await Bun.file("src/views/theme/no-hex-literals.test.ts").exists()).toBe(true);
  });
});
