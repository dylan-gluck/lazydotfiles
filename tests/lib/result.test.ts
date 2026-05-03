import { describe, expect, test } from "bun:test";
import { err, flatMap, isErr, isOk, map, mapErr, match, ok } from "../../src/lib/result";

describe("Result", () => {
  test("ok wraps a value", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  test("err wraps an error", () => {
    expect(err("nope")).toEqual({ ok: false, error: "nope" });
  });

  test("isOk and isErr discriminate", () => {
    const a = ok(1);
    const b = err("e");
    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);
    expect(isOk(b)).toBe(false);
    expect(isErr(b)).toBe(true);
  });

  test("map transforms Ok payload", () => {
    expect(map(ok(2), (n) => n + 1)).toEqual({ ok: true, value: 3 });
  });

  test("map leaves Err untouched", () => {
    const e = err("e");
    expect(map(e, (n: number) => n + 1)).toBe(e);
  });

  test("flatMap chains Ok→Ok", () => {
    expect(flatMap(ok(2), (n) => ok(n + 1))).toEqual({ ok: true, value: 3 });
  });

  test("flatMap short-circuits on Err", () => {
    const e = err("e");
    let called = false;
    flatMap(e, (n: number) => {
      called = true;
      return ok(n);
    });
    expect(called).toBe(false);
  });

  test("mapErr transforms Err payload", () => {
    expect(mapErr(err("a"), (s) => s.length)).toEqual({ ok: false, error: 1 });
  });

  test("mapErr leaves Ok untouched", () => {
    const o = ok(1);
    expect(mapErr(o, (e: string) => e.length)).toBe(o);
  });

  test("match calls the right branch", () => {
    expect(match(ok(2), { ok: (n) => n + 1, err: () => -1 })).toBe(3);
    expect(match(err("e"), { ok: () => -1, err: (e: string) => e.length })).toBe(1);
  });
});
