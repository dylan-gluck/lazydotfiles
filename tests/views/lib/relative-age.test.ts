import { describe, expect, test } from "bun:test";
import { relativeAge } from "../../../src/views/lib/relative-age";

const NOW = new Date("2026-05-01T12:00:00Z");

describe("relativeAge", () => {
  test("just now under 60s", () => {
    expect(relativeAge("2026-05-01T11:59:30Z", NOW)).toBe("just now");
  });
  test("Nm ago under 60m", () => {
    expect(relativeAge("2026-05-01T11:55:00Z", NOW)).toBe("5m ago");
  });
  test("Nh ago under 24h", () => {
    expect(relativeAge("2026-05-01T09:00:00Z", NOW)).toBe("3h ago");
  });
  test("Nd ago beyond a day", () => {
    expect(relativeAge("2026-04-29T12:00:00Z", NOW)).toBe("2d ago");
  });
  test("returns input verbatim for unparseable", () => {
    expect(relativeAge("not-a-date", NOW)).toBe("not-a-date");
  });
});
