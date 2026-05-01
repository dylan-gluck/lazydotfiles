import { describe, expect, test } from "bun:test";
import { candidateId, DiscoveryCandidateSchema, makeCandidate } from "./candidate";

describe("DiscoveryCandidateSchema", () => {
  test("validates a well-formed candidate", () => {
    const input = {
      id: "deadbeef",
      path: "/h/.zshrc",
      kind: "file" as const,
      reason: "include" as const,
      siblings: [],
      status: "pending" as const,
    };
    const r = DiscoveryCandidateSchema["~standard"].validate(input);
    expect(r.issues).toBeUndefined();
    expect(r.value).toEqual(input);
  });

  test("rejects unknown reason and reports the reason path", () => {
    const r = DiscoveryCandidateSchema["~standard"].validate({
      id: "x",
      path: "/p",
      kind: "file",
      reason: "wat",
      siblings: [],
      status: "pending",
    });
    expect(r.issues).toBeDefined();
    expect(r.issues!.some((i) => (i.path ?? []).includes("reason"))).toBe(true);
  });

  test("rejects unknown status", () => {
    const r = DiscoveryCandidateSchema["~standard"].validate({
      id: "x",
      path: "/p",
      kind: "file",
      reason: "include",
      siblings: [],
      status: "huh",
    });
    expect(r.issues).toBeDefined();
    expect(r.issues!.some((i) => (i.path ?? []).includes("status"))).toBe(true);
  });
});

describe("candidateId", () => {
  test("is stable for the same input", () => {
    expect(candidateId("/h/.zshrc")).toBe(candidateId("/h/.zshrc"));
  });

  test("differs across paths", () => {
    expect(candidateId("/h/.zshrc")).not.toBe(candidateId("/h/.bashrc"));
  });
});

describe("makeCandidate", () => {
  test("defaults siblings=[] and status=pending", () => {
    const c = makeCandidate({ path: "/h/.zshrc", kind: "file", reason: "include" });
    expect(c.siblings).toEqual([]);
    expect(c.status).toBe("pending");
  });

  test("populates id = candidateId(path)", () => {
    const c = makeCandidate({ path: "/h/.zshrc", kind: "file", reason: "include" });
    expect(c.id).toBe(candidateId("/h/.zshrc"));
  });
});
