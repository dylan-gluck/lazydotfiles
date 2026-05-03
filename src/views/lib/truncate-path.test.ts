import { describe, expect, test } from "bun:test";
import { compressPath, shortDir, tildify, truncateToWidth } from "./truncate-path";

describe("tildify", () => {
  test("returns path unchanged when not under home", () => {
    expect(tildify("/etc/hosts", "/home/u")).toBe("/etc/hosts");
  });
  test("collapses exact home to ~", () => {
    expect(tildify("/home/u", "/home/u")).toBe("~");
  });
  test("collapses subpath", () => {
    expect(tildify("/home/u/.config/fish", "/home/u")).toBe("~/.config/fish");
  });
  test("returns path when home is empty string", () => {
    expect(tildify("/etc/hosts", "")).toBe("/etc/hosts");
  });
});

describe("compressPath", () => {
  test("returns path unchanged when within tail+1 segments", () => {
    expect(compressPath("~/a/b")).toBe("~/a/b");
    expect(compressPath("~/a/b/c")).toBe("~/a/b/c");
  });
  test("compresses deep tilde paths to ~/.../parent/leaf", () => {
    expect(compressPath("~/a/b/c/d/leaf")).toBe("~/.../d/leaf");
  });
  test("preserves absolute root", () => {
    expect(compressPath("/var/log/journal/abcd/system.log")).toBe("/.../abcd/system.log");
  });
  test("respects custom tail", () => {
    expect(compressPath("~/a/b/c/d/e/leaf", { tail: 3 })).toBe("~/.../d/e/leaf");
  });
});

describe("truncateToWidth", () => {
  test("returns input when shorter than width", () => {
    expect(truncateToWidth("abc", 10)).toBe("abc");
  });
  test("truncates with ellipsis", () => {
    expect(truncateToWidth("abcdef", 4)).toBe("abc…");
  });
  test("returns lone ellipsis at width 1", () => {
    expect(truncateToWidth("hello", 1)).toBe("…");
  });
  test("returns empty at width 0 or less", () => {
    expect(truncateToWidth("hi", 0)).toBe("");
    expect(truncateToWidth("hi", -1)).toBe("");
  });
});

describe("shortDir", () => {
  test("tildifies and compresses in one call", () => {
    expect(shortDir("/home/u/.config/fish/functions/conf.d", "/home/u")).toBe(
      "~/.../functions/conf.d",
    );
  });
  test("leaves shallow tildified paths alone", () => {
    expect(shortDir("/home/u/.config", "/home/u")).toBe("~/.config");
  });
});
