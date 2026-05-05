import { describe, expect, test } from "bun:test";
import { Glob } from "bun";

// Match width={N} or height={N} where N is an integer literal.
// Allowed: height={1} and width={1} — fixed UI affordances (status bars,
// single-glyph cursor / icon slots) per CONSTITUTION §2.2 exception.
// Anything else for layout flow is prohibited.
const SIZE_RE = /\b(width|height)=\{(-?\d+)\}/g;

describe("layout discipline", () => {
  test("no hand-rolled width/height for layout flow in views/routes", async () => {
    const glob = new Glob("src/{views,routes}/**/*.{ts,tsx}");
    const violations: string[] = [];
    for await (const path of glob.scan({ cwd: process.cwd(), onlyFiles: true })) {
      if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) continue;
      const text = await Bun.file(path).text();
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        SIZE_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = SIZE_RE.exec(line)) !== null) {
          const dim = m[1];
          const value = Number(m[2]);
          if ((dim === "height" || dim === "width") && value === 1) continue;
          violations.push(`${path}:${idx + 1}  ${line.trim()}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });
});
