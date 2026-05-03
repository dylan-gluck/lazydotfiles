import { describe, expect, test } from "bun:test";
import {
  array,
  boolean,
  literal,
  number,
  object,
  optional,
  string,
  union,
} from "../../src/domain/schema";

describe("schema", () => {
  test("string accepts strings, rejects numbers", () => {
    expect(string()["~standard"].validate("a")).toEqual({ value: "a" });
    expect(string()["~standard"].validate(1).issues).toBeDefined();
  });

  test("number rejects NaN and strings", () => {
    expect(number()["~standard"].validate(1)).toEqual({ value: 1 });
    expect(number()["~standard"].validate(Number.NaN).issues).toBeDefined();
    expect(number()["~standard"].validate("1").issues).toBeDefined();
  });

  test("boolean", () => {
    expect(boolean()["~standard"].validate(true)).toEqual({ value: true });
    expect(boolean()["~standard"].validate("true").issues).toBeDefined();
  });

  test("literal accepts only the exact value", () => {
    expect(literal("x")["~standard"].validate("x")).toEqual({ value: "x" });
    expect(literal("x")["~standard"].validate("y").issues).toBeDefined();
  });

  test("union accepts any member", () => {
    const u = union([literal("a"), literal("b")]);
    expect(u["~standard"].validate("a").value).toBe("a");
    expect(u["~standard"].validate("b").value).toBe("b");
    expect(u["~standard"].validate("c").issues).toBeDefined();
  });

  test("object validates nested fields", () => {
    const s = object({ id: string(), n: number() });
    expect(s["~standard"].validate({ id: "x", n: 1 })).toEqual({ value: { id: "x", n: 1 } });
    const bad = s["~standard"].validate({ id: "x", n: "1" });
    expect(bad.issues?.[0]?.path).toEqual(["n"]);
  });

  test("array reports element path", () => {
    const s = array(string());
    const bad = s["~standard"].validate(["a", 2]);
    expect(bad.issues?.[0]?.path).toEqual([1]);
  });

  test("optional accepts undefined and inner type", () => {
    const s = optional(string());
    expect(s["~standard"].validate(undefined)).toEqual({ value: undefined });
    expect(s["~standard"].validate("x")).toEqual({ value: "x" });
    expect(s["~standard"].validate(1).issues).toBeDefined();
  });

  test("deeply nested path", () => {
    const s = object({ list: array(object({ name: string() })) });
    const bad = s["~standard"].validate({ list: [{ name: "a" }, { name: 1 }] });
    expect(bad.issues?.[0]?.path).toEqual(["list", 1, "name"]);
  });
});
