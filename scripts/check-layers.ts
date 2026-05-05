#!/usr/bin/env bun
// PRD A9 static-invariant aggregator. Runs the three guard tests that encode
// the constitution §6.1 / §2.2 layer rules:
//   1. no process.exit() in src/                       (no-process-exit.test.ts)
//   2. no hand-rolled width/height for layout flow     (layout-discipline.test.ts)
//   3. no hex literals outside views/theme/            (no-hex-literals.test.ts)
//
// Sets process.exitCode (CONSTITUTION §6.1 forbids process.exit()).

const GUARDS = [
  "tests/views/no-process-exit.test.ts",
  "tests/views/layout-discipline.test.ts",
  "tests/views/theme/no-hex-literals.test.ts",
];

const proc = Bun.spawnSync({
  cmd: ["bun", "test", ...GUARDS],
  stdout: "inherit",
  stderr: "inherit",
});

process.exitCode = proc.exitCode ?? 1;
