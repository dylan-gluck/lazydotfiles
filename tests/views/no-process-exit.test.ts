import { describe, expect, test } from "bun:test";
import { Glob } from "bun";

// CONSTITUTION §6.1: no `process.exit()` outside the binary entry.
// `process.exitCode = N` is permitted (it lets the runtime drain). The scan
// matches the exact call form `process.exit(` to avoid false positives on
// `process.exitCode`.
const PROCESS_EXIT_RE = /\bprocess\.exit\s*\(/;

describe("runtime discipline", () => {
  test("no process.exit() in src/", async () => {
    const glob = new Glob("src/**/*.{ts,tsx}");
    const violations: string[] = [];
    for await (const path of glob.scan({ cwd: process.cwd(), onlyFiles: true })) {
      // Self-skip: this guard regex is itself a string match.
      if (path.endsWith("no-process-exit.test.ts")) continue;
      const text = await Bun.file(path).text();
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        if (PROCESS_EXIT_RE.test(line)) violations.push(`${path}:${idx + 1}  ${line.trim()}`);
      });
    }
    expect(violations).toEqual([]);
  });
});
