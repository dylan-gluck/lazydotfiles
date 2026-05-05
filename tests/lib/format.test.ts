import { describe, expect, test } from "bun:test";
import { formatServiceError, padRight, relativeAge, truncate } from "../../src/lib/format";

describe("format", () => {
  test("relativeAge buckets minutes/hours/days", () => {
    const NOW = new Date("2026-05-01T12:00:00Z");
    expect(relativeAge("2026-05-01T11:59:30Z", NOW)).toBe("just now");
    expect(relativeAge("2026-05-01T11:55:00Z", NOW)).toBe("5m ago");
    expect(relativeAge("2026-05-01T09:00:00Z", NOW)).toBe("3h ago");
    expect(relativeAge("2026-04-29T12:00:00Z", NOW)).toBe("2d ago");
    // Sanity: parser-resilient.
    expect(relativeAge("not a date", NOW)).toBe("not a date");
  });

  test("padRight + truncate", () => {
    expect(padRight("a", 4)).toBe("a   ");
    expect(padRight("abcd", 4)).toBe("abcd");
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("ab", 4)).toBe("ab");
  });

  test("formatServiceError discriminates each tag", () => {
    expect(formatServiceError({ tag: "NotFound", resource: "X", id: "y" })).toContain("X#y");
    expect(formatServiceError({ tag: "Validation", issues: [{ message: "bad" }] })).toContain(
      "bad",
    );
    expect(formatServiceError({ tag: "InvalidTarget", reason: "missing", path: "/p" })).toContain(
      "missing",
    );
    expect(
      formatServiceError({
        tag: "Repository",
        cause: { tag: "IoError", path: "/p", cause: new Error("boom") },
      }),
    ).toContain("boom");
    expect(
      formatServiceError({
        tag: "Rollback",
        failedStep: "move",
        original: { tag: "NotFound", resource: "F", id: "x" },
        rollbackErrors: [],
      }),
    ).toContain("rollback at step 'move'");
  });
});
