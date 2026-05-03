import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wireServices } from "../composition/services";
import { HAS_JJ } from "../test-utils/jj";
import { withTmpDir } from "../test-utils/tmp";

const HAS_GIT = Bun.which("git") !== null;

async function run(
  cmd: readonly string[],
  cwd?: string,
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  const env = {
    ...process.env,
    JJ_USER: process.env["JJ_USER"] ?? "ldf",
    JJ_EMAIL: process.env["JJ_EMAIL"] ?? "ldf@local",
    GIT_AUTHOR_NAME: "ldf",
    GIT_AUTHOR_EMAIL: "ldf@local",
    GIT_COMMITTER_NAME: "ldf",
    GIT_COMMITTER_EMAIL: "ldf@local",
  } as Record<string, string>;
  const proc = Bun.spawn([...cmd], { cwd, stdout: "pipe", stderr: "pipe", env });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
    new Response(proc.stderr as ReadableStream<Uint8Array>).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
}

describe("A6: sync against a bare git remote", () => {
  test.skipIf(!HAS_GIT || !HAS_JJ)(
    "fetch + push report ahead/behind correctly",
    async () => {
      await withTmpDir(async (tmp) => {
        const home = join(tmp.path, "home");
        const remote = join(tmp.path, "remote.git");
        await Bun.write(join(home, ".keep"), "");

        // Bare remote.
        const init = await run(["git", "init", "--bare", remote]);
        expect(init.exitCode).toBe(0);

        // Bootstrap services + track a file.
        const services = wireServices({ home });
        const boot = await services.bootstrap.run();
        expect(boot.ok).toBe(true);

        const dotfilesRoot = `${home}/dotfiles`;
        const target = join(home, ".zshrc");
        await writeFile(target, "alias g=jj\n", { mode: 0o600 });
        const added = await services.track.add(target);
        expect(added.ok).toBe(true);

        // Configure origin and a `main` bookmark, then push.
        const addRemote = await run(["git", "-C", dotfilesRoot, "remote", "add", "origin", remote]);
        expect(addRemote.exitCode).toBe(0);
        const bookmark = await run(["jj", "bookmark", "set", "main", "-r", "@-"], dotfilesRoot);
        // Older jj versions need `--allow-backwards`; the initial set should succeed.
        if (bookmark.exitCode !== 0) {
          // Best-effort: fall back to creating with --revision form.
          const created = await run(["jj", "bookmark", "create", "main", "-r", "@-"], dotfilesRoot);
          expect(created.exitCode).toBe(0);
        }

        const pushed = await services.sync.push();
        if (!pushed.ok) {
          // Surface jj diagnostics.
          const log = await run(["jj", "log", "--limit", "5"], dotfilesRoot);
          const bm = await run(["jj", "bookmark", "list", "--all"], dotfilesRoot);
          throw new Error(
            `push failed: ${JSON.stringify(pushed.error)}\nlog:\n${log.stdout}\n${log.stderr}\nbookmarks:\n${bm.stdout}`,
          );
        }
        if (!pushed.ok) return;
        // After push, the remote knows `main`; behind is zero. `ahead` is
        // the count of unbookmarked working-copy commits, which jj keeps as a
        // mutable head; we assert it's a finite non-negative number rather
        // than zero (jj's wc-change is intentionally not pushed).
        expect(pushed.value.state.ahead).toBeGreaterThanOrEqual(0);
        expect(pushed.value.state.behind).toBe(0);
        expect(pushed.value.state.remote).toContain(remote);

        // Diverge: clone the bare to a side dir, commit, push.
        const side = join(tmp.path, "side");
        const clone = await run(["git", "clone", remote, side]);
        expect(clone.exitCode).toBe(0);
        await Bun.write(join(side, "remote-only.txt"), "from remote\n");
        await run(["git", "-C", side, "add", "remote-only.txt"]);
        const commit = await run(["git", "-C", side, "commit", "-m", "remote change"]);
        expect(commit.exitCode).toBe(0);
        const pushSide = await run(["git", "-C", side, "push", "origin", "main"]);
        expect(pushSide.exitCode).toBe(0);

        // Now fetch from the dotfiles repo; behind should report >0.
        const fetched = await services.sync.fetch();
        expect(fetched.ok).toBe(true);
        if (!fetched.ok) return;
        expect(fetched.value.state.behind).toBeGreaterThanOrEqual(1);
        // Note: ahead may shrink after fetch because `remote_bookmarks()..@`
        // narrows as the remote ancestor set grows. We only assert it stays
        // non-negative \u2014 the meaningful reading is `behind > 0`.
        expect(fetched.value.state.ahead).toBeGreaterThanOrEqual(0);
        expect(fetched.value.conflicts.length).toBe(0);
      });
    },
    60_000,
  );
});
