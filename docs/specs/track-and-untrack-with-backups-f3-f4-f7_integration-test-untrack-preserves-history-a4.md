# Spec — Integration test: untrack preserves jj history (A4)

- **Source bean:** `ldf-9hf0`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §A4](../prds/001_mvp.md), [PRD §F4](../prds/001_mvp.md), [TrackService.remove spec](./track-and-untrack-with-backups-f3-f4-f7_implement-trackserviceremove.md).

## Goal

End-to-end test, real `jj` binary, real filesystem in a tmp `$HOME`: track a file, untrack it, and assert (1) the original location holds a regular file with the latest committed content, (2) `jj log` retains both the `track <rel>` and `untrack <rel>` changes, (3) the symlink and the file under `dotfilesRoot` are both gone from the working copy.

## Public surface

No production code. Adds `src/services/track.service.untrack-history.integration.test.ts` (suffix matches test-runner conventions; co-located per ADR-001 §4.7).

## Test outline

```ts
import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTmpDir } from "../test-utils/tmp";
import { wireServices } from "../composition/services";
import { createJjRepository } from "../repositories/jj.repository";

describe("track→untrack preserves jj history", () => {
  test("file restored at original location; jj log retains track + untrack", async () => {
    await withTmpDir(async (home) => {
      const target = join(home.path, ".zshrc");
      await writeFile(target, "alias g=jj\n", { mode: 0o600 });

      const services = wireServices({ home: home.path });
      const bootstrap = await services.bootstrap.run();
      expect(bootstrap.ok).toBe(true);

      const added = await services.track.add(target);
      expect(added.ok).toBe(true);
      expect(await readSymlinkTarget(target)).toContain(`${home.path}/dotfiles/.zshrc`);

      const removed = await services.track.remove(target);
      expect(removed.ok).toBe(true);

      // (A4.1) target is now a regular file with the latest content.
      const restored = await Bun.file(target).text();
      expect(restored).toBe("alias g=jj\n");
      expect(await isSymlink(target)).toBe(false);

      // (A4.2) jj log retains both changes.
      const log = await createJjRepository().log({
        root: `${home.path}/dotfiles`,
        limit: 50,
      });
      expect(log.ok).toBe(true);
      const descriptions = log.value.map((op) => op.description);
      expect(descriptions).toContain("track .zshrc");
      expect(descriptions).toContain("untrack .zshrc");

      // (A4.3) source removed from the working copy.
      expect(await fileExists(`${home.path}/dotfiles/.zshrc`)).toBe(false);
    });
  });
});
```

Helpers (`readSymlinkTarget`, `isSymlink`, `fileExists`) live in `src/test-utils/fs.ts` (new) so other integration tests reuse them.

## Internal design

- `wireServices` is extended (per the TrackService spec) to expose `services.track`. The integration test relies on the **real** wiring used by `src/index.tsx` — no fakes — to detect any composition-root regression.
- The test runs against the real `jj` binary; the suite is gated on `which jj` so CI surfaces a clear skip if jj is missing. Initial implementation: assume jj is present (matching the existing `jj.repository` integration tests in `repo-and-vcs-adapter-jj` phase) and let absence raise.
- `now` is injected through `services` only when needed; here we accept real time because the test asserts log content, not exact stamps.

## Dependencies

- `src/test-utils/tmp.ts`, `src/test-utils/fs.ts` (new helpers).
- All track-phase production specs.

## Tests

This spec is itself a test. No further sub-tests.

## Acceptance

- PRD A4 demonstrably true: file restored, jj log retains history.
- Test passes against the real `jj` binary.

## Review

Approved. Uses the real composition root (no service substitution), so the test is also a smoke check for the composition-root wiring delta introduced by this phase. Helpers extracted to `test-utils/fs.ts` rather than duplicated — DRY per CONSTITUTION §1.3.
