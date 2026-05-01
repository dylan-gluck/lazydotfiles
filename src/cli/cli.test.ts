import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wireServices } from "../composition/services";
import { fileExists, isSymlink } from "../test-utils/fs";
import { withTmpDir } from "../test-utils/tmp";
import { runCli } from "./index";

interface Capture {
  out: string;
  err: string;
}

function capture(home: string): { io: Parameters<typeof runCli>[1]["io"]; cap: Capture } {
  const cap: Capture = { out: "", err: "" };
  return {
    cap,
    io: {
      stdout: (s) => {
        cap.out += s;
      },
      stderr: (s) => {
        cap.err += s;
      },
      env: { HOME: home },
      cwd: home,
    },
  };
}

describe("runCli", () => {
  test("--help prints usage", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io, cap } = capture(home.path);
      const code = await runCli(["--help"], { services, io });
      expect(code).toBe(0);
      expect(cap.out).toContain("usage:");
    });
  });

  test("unknown subcommand → exit 1", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io, cap } = capture(home.path);
      const code = await runCli(["bogus"], { services, io });
      expect(code).toBe(1);
      expect(cap.err).toContain("unknown command");
    });
  });

  test("status on cold $HOME → exit 0 with structured fields", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io, cap } = capture(home.path);
      const code = await runCli(["status"], { services, io });
      expect(code).toBe(0);
      expect(cap.out).toContain("tracked: 0 files");
      expect(cap.out).toContain("queue:");
      expect(cap.out).toContain("sync:");
    });
  });

  test("config get/set roundtrip", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io: io1, cap: cap1 } = capture(home.path);
      expect(await runCli(["config", "discovery.auto_track"], { services, io: io1 })).toBe(0);
      expect(cap1.out.trim()).toBe("true");

      const { io: io2 } = capture(home.path);
      expect(await runCli(["config", "discovery.auto_track", "false"], { services, io: io2 })).toBe(
        0,
      );

      const { io: io3, cap: cap3 } = capture(home.path);
      expect(await runCli(["config", "discovery.auto_track"], { services, io: io3 })).toBe(0);
      expect(cap3.out.trim()).toBe("false");
    });
  });

  test("config bogus key → exit 1", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io, cap } = capture(home.path);
      const code = await runCli(["config", "bogus.key"], { services, io });
      expect(code).toBe(1);
      expect(cap.err).toContain("unknown option");
    });
  });

  test("add then rm roundtrip", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const target = join(home.path, ".zshrc");
      await writeFile(target, "export FOO=1\n", { mode: 0o600 });

      const { io: addIo, cap: addCap } = capture(home.path);
      const addCode = await runCli(["add", target], { services, io: addIo });
      expect(addCode).toBe(0);
      expect(addCap.out).toContain("tracked .zshrc");
      expect(await isSymlink(target)).toBe(true);

      const { io: rmIo, cap: rmCap } = capture(home.path);
      const rmCode = await runCli(["rm", target], { services, io: rmIo });
      expect(rmCode).toBe(0);
      expect(rmCap.out).toContain("untracked .zshrc");
      expect(await isSymlink(target)).toBe(false);
      expect(await fileExists(target)).toBe(true);
    });
  }, 30_000);

  test("add missing path → exit 1", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io, cap } = capture(home.path);
      const code = await runCli(["add", join(home.path, "no-such-file")], { services, io });
      expect(code).toBe(1);
      expect(cap.err).toContain("missing");
    });
  });

  test("log on fresh repo → exit 0, mentions an op", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io, cap } = capture(home.path);
      const code = await runCli(["log"], { services, io });
      expect(code).toBe(0);
      // Either there is at least one op (jj init) or the empty marker.
      expect(cap.out.length).toBeGreaterThan(0);
    });
  });

  test("log bad --limit → exit 1", async () => {
    await withTmpDir(async (home) => {
      const services = wireServices({ home: home.path });
      const { io, cap } = capture(home.path);
      const code = await runCli(["log", "--limit", "foo"], { services, io });
      expect(code).toBe(1);
      expect(cap.err).toContain("bad value");
    });
  });
});
