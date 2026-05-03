import { describe, expect, test } from "bun:test";
import { dark, light } from "../../src/views/theme";

describe("theme tokens", () => {
  test("dark and light differ in mode", () => {
    expect(dark.mode).toBe("dark");
    expect(light.mode).toBe("light");
  });

  test("space scale matches design", () => {
    expect(dark.space).toEqual({ xs: 0, sm: 1, md: 2, lg: 4 });
  });

  test("borders are flexbox-friendly enums, not hand-rolled", () => {
    expect(dark.border.default).toBe("single");
    expect(dark.border.emphasis).toBe("double");
  });
});
