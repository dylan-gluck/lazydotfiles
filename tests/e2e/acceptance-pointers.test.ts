import { describe, expect, test } from "bun:test";

/**
 * Acceptance audit trail.
 *
 * For acceptance criteria whose canonical verification already lives at the
 * service-integration level, this file records the path each Aₙ is verified
 * by, and asserts those files exist. It does NOT re-execute the scenario —
 * `bun test` already runs each canonical test once; double-execution would
 * be ceremony, not coverage.
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
const CANONICAL_TESTS = {
  A1: "tests/e2e/a1-boot-speed.test.ts",
  A2: "tests/discovery.a2.test.ts",
  A3: "tests/e2e/a3-add-round-trip.test.ts",
  A4: "src/services/track.service.untrack-history.integration.test.ts",
  A5: "src/services/track.service.sigterm.integration.test.ts",
  A6: "src/services/sync.service.a6.integration.test.ts",
  A7: "src/services/restore.service.a7.integration.test.ts",
  A8: "docs/audits/a8-test-coverage.md",
  A9: "tests/e2e/a9-static-invariants.test.ts",
} as const;

describe("PRD acceptance criteria — canonical verification paths", () => {
  for (const [criterion, path] of Object.entries(CANONICAL_TESTS)) {
    test(`${criterion} canonical artifact at ${path}`, async () => {
      const exists = await Bun.file(path).exists();
      expect(exists, `missing acceptance artifact for ${criterion}: ${path}`).toBe(true);
    });
  }
});
