import { describe, expect, test } from "bun:test";
import { DomainError, isDomainError } from "../../src/domain/errors";

describe("DomainError", () => {
  test("carries tag and details", () => {
    const e = new DomainError("DUPLICATE_TARGET", { target: "/x" });
    expect(e.tag).toBe("DUPLICATE_TARGET");
    expect(e.details.target).toBe("/x");
  });

  test("toJSON flattens", () => {
    const e = new DomainError("DUPLICATE_TARGET", { target: "/x" });
    expect(e.toJSON()).toEqual({ tag: "DUPLICATE_TARGET", target: "/x" });
  });

  test("isDomainError discriminates", () => {
    expect(isDomainError(new DomainError("NOT_FOUND", { resource: "x", id: "1" }))).toBe(true);
    expect(isDomainError(new Error("plain"))).toBe(false);
    expect(isDomainError(null)).toBe(false);
  });
});
