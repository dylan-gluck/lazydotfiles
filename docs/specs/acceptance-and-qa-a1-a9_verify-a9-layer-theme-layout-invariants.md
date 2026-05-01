# Spec — Verify A9: layer, theme, and layout static invariants

- **Source bean:** `ldf-xu23`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A9](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md).

## Goal

Consolidate and complete the three A9 static-analysis guards — no `process.exit()` in `src/`, no hand-rolled layout dimensions, no hex literals outside `views/theme/` — into a single `check:layers` script and a unified e2e acceptance entry.

## Public surface

### Existing coverage

| Guard               | File                                      | Status      |
| ------------------- | ----------------------------------------- | ----------- |
| No width/height     | `src/views/layout-discipline.test.ts`     | ✓ Complete  |
| No hex literals     | `src/views/theme/no-hex-literals.test.ts` | ✓ Complete  |
| No `process.exit()` | —                                         | **Missing** |

### New artifacts

#### 1. `src/views/no-process-exit.test.ts`

```ts
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";

describe("process.exit guard", () => {
  test("no process.exit() calls in src/", async () => {
    const glob = new Glob("src/**/*.{ts,tsx}");
    const violations: string[] = [];
    for await (const path of glob.scan({ cwd: process.cwd(), onlyFiles: true })) {
      if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
      const text = await Bun.file(path).text();
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        // Match process.exit( but NOT process.exitCode.
        if (/process\.exit\s*\(/.test(line)) {
          violations.push(`${path}:${idx + 1}  ${line.trim()}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
```

**Scope:** `src/**/*.{ts,tsx}` production files only (excludes test files). `bin/ldf.ts` is outside `src/` and is allowed to use `process.exitCode` (but not `process.exit()`; a separate lint check could cover `bin/` if desired). The regex `/process\.exit\s*\(/` matches `process.exit(` and `process.exit (` but does NOT match `process.exitCode`.

#### 2. `scripts/check-layers.ts`

```ts
#!/usr/bin/env bun
/**
 * Static-invariant checker for CONSTITUTION §6 compliance.
 * Runs as: bun scripts/check-layers.ts
 * Exit code 0 = pass, 1 = failure. Uses process.exitCode, NOT process.exit().
 */
import { Glob } from "bun";

let failed = false;

// --- Step 1: run the two existing guard tests + the new process.exit test ---
const testResult = Bun.spawnSync(
  [
    "bun",
    "test",
    "src/views/layout-discipline.test.ts",
    "src/views/theme/no-hex-literals.test.ts",
    "src/views/no-process-exit.test.ts",
  ],
  { cwd: import.meta.dir + "/..", stdout: "inherit", stderr: "inherit" },
);

if (testResult.exitCode !== 0) {
  console.error("FAIL: guard tests exited with code", testResult.exitCode);
  failed = true;
}

// --- Step 2: standalone scan for process.exit( in src/ ---
// (Belt-and-suspenders: the test above covers this, but the script must
//  also fail independently of the test runner.)
const glob = new Glob("src/**/*.{ts,tsx}");
const violations: string[] = [];
for await (const path of glob.scan({ cwd: import.meta.dir + "/..", onlyFiles: true })) {
  if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
  const text = await Bun.file(path).text();
  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    if (/process\.exit\s*\(/.test(line)) {
      violations.push(`${path}:${idx + 1}  ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("FAIL: process.exit() found in src/:");
  violations.forEach((v) => console.error("  " + v));
  failed = true;
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("check:layers passed");
}
```

**Key points:**

- Uses `process.exitCode = 1`, NOT `process.exit()`.
- `Bun.spawnSync` runs tests synchronously so the script can aggregate results.
- The standalone scan is a belt-and-suspenders check; it catches violations even if the test file itself is somehow excluded.
- `import.meta.dir + "/.."` resolves to project root regardless of `cwd`.

#### 3. `package.json` — add script

```json
"check:layers": "bun scripts/check-layers.ts"
```

Added alongside existing scripts in `package.json`.

#### 4. `tests/e2e/a9-static-invariants.test.ts`

```ts
// One-stop acceptance entry for A9 static invariants.
// Importing the three guard test files causes bun:test to register and
// run their describe/test blocks in this suite.
import "../src/views/layout-discipline.test";
import "../src/views/theme/no-hex-literals.test";
import "../src/views/no-process-exit.test";
```

**Note:** The import paths use `../src/` because the file lives at `tests/e2e/`. This re-exports the existing tests into the e2e acceptance suite without duplicating assertions.

## Internal design

All three guards use the same pattern: `Bun.Glob` scan → line-by-line regex → collect violations → `expect(violations).toEqual([])`. This is consistent with the existing `layout-discipline.test.ts` and `no-hex-literals.test.ts`.

The `check:layers` script is intentionally redundant with the test files. It serves as a CI gate that can be run outside `bun test` (e.g. in a pre-commit hook or CI step).

## Dependencies

- `src/views/layout-discipline.test.ts` — existing, unchanged.
- `src/views/theme/no-hex-literals.test.ts` — existing, unchanged.
- Bun built-ins: `Glob`, `Bun.file`, `Bun.spawnSync`.

## Tests

- `src/views/no-process-exit.test.ts` — the new guard test.
- `tests/e2e/a9-static-invariants.test.ts` — acceptance entry aggregating all three.
- `bun run check:layers` — script-level validation.

## Acceptance

- `src/views/no-process-exit.test.ts` passes: zero `process.exit()` calls in `src/`.
- `bun run check:layers` exits 0.
- `tests/e2e/a9-static-invariants.test.ts` runs all three guard suites.
- PRD §A9 fully satisfied:
  1. No `process.exit()` in `src/` ✓ (new test + script scan).
  2. No hand-rolled width/height ✓ (existing `layout-discipline.test.ts`).
  3. No hex literals outside `views/theme/` ✓ (existing `no-hex-literals.test.ts`).

## Review

Approved. CONSTITUTION §6 compliance: the script itself uses `process.exitCode`, not `process.exit()`. No domain logic, no repository calls, no mutable shared state, no `any`. The `process.exit(` regex correctly excludes `process.exitCode` assignments.
