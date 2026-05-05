import { describe, expect, test } from "bun:test";
import { classifyPath, isGlobPattern } from "../../src/repositories/fs-scanner.repository";

describe("classifyPath", () => {
  test("bare include matches its literal", () => {
    expect(classifyPath(".zshrc", [".zshrc"], [])).toBe("include");
  });

  test("excluded by .env*", () => {
    expect(classifyPath(".env", [".config/**", ".env*"], [".env*"])).toBe("exclude");
  });

  test("re-included by !pattern after exclude", () => {
    expect(classifyPath(".env.example", [".env*"], [".env*", "!.env.example"])).toBe("include");
  });

  test("no include match → exclude", () => {
    expect(classifyPath("foo", ["bar"], [])).toBe("exclude");
  });

  test("glob include matches nested paths", () => {
    expect(classifyPath(".config/fish/config.fish", [".config/**/*"], [])).toBe("include");
  });
});

describe("isGlobPattern", () => {
  test("true for glob meta-characters", () => {
    expect(isGlobPattern("**/*")).toBe(true);
    expect(isGlobPattern(".config/[ab]")).toBe(true);
    expect(isGlobPattern("{a,b}")).toBe(true);
    expect(isGlobPattern("foo?")).toBe(true);
  });

  test("false for literal paths", () => {
    expect(isGlobPattern(".zshrc")).toBe(false);
    expect(isGlobPattern(".config/fish/config.fish")).toBe(false);
  });
});
