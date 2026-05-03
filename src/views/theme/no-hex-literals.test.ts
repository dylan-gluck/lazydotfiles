import { describe, expect, test } from "bun:test";
import { Glob } from "bun";

const HEX_RE = /#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?\b/;

const ALLOW_PREFIXES: readonly string[] = [
  "src/views/theme/",
  // Generated; bypassed structurally and content-allowed.
  "src/routeTree.gen.ts",
];

describe("theme audit", () => {
  test("no hex literals outside views/theme/", async () => {
    const glob = new Glob("src/**/*.{ts,tsx}");
    const violations: string[] = [];
    for await (const path of glob.scan({ cwd: process.cwd(), onlyFiles: true })) {
      if (ALLOW_PREFIXES.some((p) => path.startsWith(p))) continue;
      // Skip test files — assertions may legitimately reference hex strings as data.
      if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
      const text = await Bun.file(path).text();
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        if (HEX_RE.test(line)) violations.push(`${path}:${idx + 1}  ${line.trim()}`);
      });
    }
    expect(violations).toEqual([]);
  });
});
