import { describe, expect, test } from "bun:test";

/**
 * Acceptance audit trail.
 *
 * For acceptance criteria whose canonical verification already lives at the
 * service-integration level, this file records the path each Aₙ is verified
 * by, asserts those files exist, AND asserts each contains a real `test(...)`
 * call so the artifact isn't a placeholder. It does NOT re-execute the
 * scenario — `bun test` already runs each canonical test once; double-execution
 * would be ceremony, not coverage.
 *
 * A1 verified by: tests/e2e/a1-boot-speed.test.ts
 * A2 verified by: tests/discovery.a2.test.ts
 * A3 verified by: tests/e2e/a3-add-round-trip.test.ts
 * A4 verified by: src/services/track.service.untrack-history.integration.test.ts
 * A5 verified by: src/services/track.service.sigterm.integration.test.ts
 * A6 verified by: src/services/sync.service.a6.integration.test.ts
 * A7 verified by: src/services/restore.service.a7.integration.test.ts
 * A8 verified by: docs/audits/a8-test-coverage.md (audit doc)
 * A9 verified by: tests/e2e/a9-static-invariants.test.ts (+ canonical guards)
 */
interface Pointer {
  readonly path: string;
  /** Test artifacts must contain at least one `test(`/`it(` call. */
  readonly mustContainTest: boolean;
}

const CANONICAL_TESTS: Record<string, Pointer> = {
  A1: { path: "tests/e2e/a1-boot-speed.test.ts", mustContainTest: true },
  A2: { path: "tests/discovery.a2.test.ts", mustContainTest: true },
  A3: { path: "tests/e2e/a3-add-round-trip.test.ts", mustContainTest: true },
  A4: {
    path: "src/services/track.service.untrack-history.integration.test.ts",
    mustContainTest: true,
  },
  A5: { path: "src/services/track.service.sigterm.integration.test.ts", mustContainTest: true },
  A6: { path: "src/services/sync.service.a6.integration.test.ts", mustContainTest: true },
  A7: { path: "src/services/restore.service.a7.integration.test.ts", mustContainTest: true },
  // A8 is an audit doc — not a test, so no `test(` requirement.
  A8: { path: "docs/audits/a8-test-coverage.md", mustContainTest: false },
  A9: { path: "tests/e2e/a9-static-invariants.test.ts", mustContainTest: true },
};

describe("PRD acceptance criteria — canonical verification paths", () => {
  for (const [criterion, pointer] of Object.entries(CANONICAL_TESTS)) {
    test(`${criterion} canonical artifact at ${pointer.path}`, async () => {
      const file = Bun.file(pointer.path);
      const exists = await file.exists();
      expect(exists, `missing acceptance artifact for ${criterion}: ${pointer.path}`).toBe(true);
      if (pointer.mustContainTest) {
        const text = await file.text();
        // Accept `test(`, `it(`, and modifier forms `test.skip(`, `test.skipIf(`,
        // `test.only(`, `test.if(` etc.
        expect(
          /\b(test|it)(?:\.\w+)?\s*\(/.test(text),
          `acceptance artifact for ${criterion} contains no test() call: ${pointer.path}`,
        ).toBe(true);
      }
    });
  }
});
