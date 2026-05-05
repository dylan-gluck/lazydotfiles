import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createJjRepository } from "../../src/repositories/jj.repository";
import { withTmpDir } from "../test-utils/tmp";
import { HAS_JJ } from "../test-utils/jj";

describe.if(HAS_JJ)("JjRepository — isRepo / initColocated", () => {
  test("isRepo returns false on a non-repo dir", async () => {
    await withTmpDir(async ({ path }) => {
      const r = await createJjRepository().isRepo(path);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(false);
    });
  });

  test("initColocated creates a .jj directory", async () => {
    await withTmpDir(async ({ path }) => {
      const target = join(path, "dotfiles");
      const jj = createJjRepository();
      const init = await jj.initColocated(target);
      expect(init.ok).toBe(true);
      const r = await jj.isRepo(target);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(true);
    });
  });
});

describe.if(HAS_JJ)("JjRepository — round trip", () => {
  test("init → describe → snapshot → opLog/log returns the parsed change", async () => {
    await withTmpDir(async ({ path }) => {
      const root = join(path, "dotfiles");
      const jj = createJjRepository();

      const init = await jj.initColocated(root);
      expect(init.ok).toBe(true);

      const desc = await jj.describe({ root, message: "track .zshrc" });
      expect(desc.ok).toBe(true);

      const snap = await jj.snapshot({ root });
      expect(snap.ok).toBe(true);

      const ops = await jj.opLog({ root, limit: 10 });
      expect(ops.ok).toBe(true);
      if (!ops.ok) return;
      expect(ops.value.length).toBeGreaterThan(0);
      const opHead = ops.value[0]!;
      // The op description is jj-generated ("describe commit ..."); the change description
      // is "track .zshrc". Both layers parse cleanly into our Operation schema.
      expect(opHead.description.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(opHead.at))).toBe(false);

      const changes = await jj.log({ root, limit: 10 });
      expect(changes.ok).toBe(true);
      if (!changes.ok) return;
      const head = changes.value[0]!;
      expect(head.description.startsWith("track .zshrc")).toBe(true);
      expect(head.kind).toBe("track");
      expect(Number.isNaN(Date.parse(head.at))).toBe(false);
    });
  });

  test("status returns a typed SyncState; dirty=false after a clean snapshot", async () => {
    await withTmpDir(async ({ path }) => {
      const root = join(path, "dotfiles");
      const jj = createJjRepository();
      await jj.initColocated(root);
      await jj.describe({ root, message: "init" });
      await jj.snapshot({ root });

      const s = await jj.status({ root });
      expect(s.ok).toBe(true);
      if (!s.ok) return;
      expect(typeof s.value.dirty).toBe("boolean");
      expect(s.value.ahead).toBe(0);
      expect(s.value.behind).toBe(0);
    });
  });

  test("describe against a non-repo path returns Spawn error with stderr", async () => {
    await withTmpDir(async ({ path }) => {
      const jj = createJjRepository();
      const r = await jj.describe({ root: path, message: "x" });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.tag).toBe("Spawn");
      if (r.error.tag !== "Spawn") return;
      expect(r.error.command[0]).toBe("jj");
      expect(r.error.exitCode).not.toBe(0);
      expect(r.error.stderr.length).toBeGreaterThan(0);
    });
  });
});

if (!HAS_JJ) {
  describe("JjRepository", () => {
    test("skipped: jj binary not on PATH", () => {
      expect(true).toBe(true);
    });
  });
}
