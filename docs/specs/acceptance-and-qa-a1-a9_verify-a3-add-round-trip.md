# Spec — Verify A3: add round-trip with backup assertion

- **Source bean:** `ldf-29wo`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A3](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md), [TrackService.add spec](./track-and-untrack-with-backups-f3-f4-f7_implement-trackserviceadd-with-rollback.md).

## Goal

Assert all four PRD A3 invariants via the CLI surface in a single e2e test, closing the gap in `src/cli/cli.test.ts` which validates the symlink but not the backup directory.

## Public surface

**File:** `tests/e2e/a3-add-round-trip.test.ts`

### Existing coverage

`src/cli/cli.test.ts` — "add then rm roundtrip" asserts:

- `addCode === 0`, output contains `"tracked .zshrc"`.
- `target` is a symlink after add.
- `target` is a regular file after rm.

**Gap:** no assertion on `$HOME/.dotfiles.bak/<id>/<ts>-add/` contents, no assertion on `jj` commit description.

### New test

```ts
import { describe, expect, test } from "bun:test";
import { readFile, lstat } from "node:fs/promises";
import { join } from "node:path";
import { withE2eHome } from "./harness";

const HAS_JJ = Bun.which("jj") !== null;

describe.if(HAS_JJ)("A3 — add round-trip", () => {
  test("add seeds backup, moves file, creates symlink, commits to jj", async () => {
    await withE2eHome(async ({ home, services, runCli }) => {
      const original = "# zshrc\nexport PATH=/usr/bin\n";
      const target = join(home, ".zshrc");
      await Bun.write(target, original, { mode: 0o600 });

      // Act
      const { code, out } = await runCli(["add", target]);
      expect(code).toBe(0);
      expect(out).toContain("tracked .zshrc");

      // --- Invariant (a): backup exists ---
      // Derive the tracked-file ID the same way production does: SHA-256
      // of the home-relative path. Use the service to enumerate backups.
      const tracked = await services.repo.list();
      expect(tracked.ok).toBe(true);
      if (!tracked.ok) return;
      const entry = tracked.value.find((f) => f.relPath === ".zshrc");
      expect(entry).toBeDefined();
      if (!entry) return;

      const backups = await services.backups.list(entry.id);
      expect(backups.ok).toBe(true);
      if (!backups.ok) return;
      expect(backups.value).toHaveLength(1);

      const rec = backups.value[0]!;
      expect(rec.trigger).toBe("add");

      // Verify payload matches original bytes.
      const payloadPath = join(home, ".dotfiles.bak", entry.id, rec.dirName, "payload");
      const payload = await readFile(payloadPath, "utf-8");
      expect(payload).toBe(original);

      // --- Invariant (b): source file in dotfiles repo ---
      const source = join(home, "dotfiles", ".zshrc");
      const srcStat = await lstat(source);
      expect(srcStat.isFile()).toBe(true);
      const srcContent = await readFile(source, "utf-8");
      expect(srcContent).toBe(original);

      // --- Invariant (c): target is a symlink → source ---
      const targetStat = await lstat(target);
      expect(targetStat.isSymbolicLink()).toBe(true);

      // --- Invariant (d): jj log contains "track .zshrc" ---
      const { code: logCode, out: logOut } = await runCli(["log"]);
      expect(logCode).toBe(0);
      expect(logOut).toContain("track .zshrc");
    });
  });
});

if (!HAS_JJ) {
  describe("A3 — add round-trip", () => {
    test("skipped: jj binary not on PATH", () => {
      expect(true).toBe(true);
    });
  });
}
```

### Design notes

- **`services.backups.list(id)`** returns `Result<readonly BackupRecord[], RepoError>`. Each `BackupRecord` carries `dirName` (the `<ts>-<trigger>` segment) used to construct the payload path.
- **`services.repo.list()`** returns all tracked files. We find `.zshrc` by `relPath` to get the `id` needed for backup enumeration.
- The test calls `runCli(["log"])` rather than `services.repo.head()` to exercise the user-visible surface for invariant (d).
- `Bun.write` with `mode: 0o600` seeds the file with controlled permissions.

## Internal design

No production code changes. The test composes existing CLI and service APIs.

## Dependencies

- `tests/e2e/harness.ts` (spec: `build-e2e-harness`).
- `jj` binary on `$PATH`.
- Backup repository path layout: `<home>/.dotfiles.bak/<trackedFileId>/<formatBackupTimestamp>-<trigger>/payload`.

## Tests

This spec **is** the test deliverable.

## Acceptance

- `tests/e2e/a3-add-round-trip.test.ts` exists and passes when `jj` is available.
- All four PRD §A3 invariants are asserted:
  1. Backup directory exists with correct `payload` and trigger.
  2. Source file at `<home>/dotfiles/.zshrc` matches original bytes.
  3. Target is a symlink.
  4. `ldf log` output contains `track .zshrc`.

## Review

Approved. CONSTITUTION §6 compliance: no `process.exit()`, no domain logic, no repository calls outside services (backup enumeration goes through `BackupService`), no `any`, no mutable shared state. Uses `lstat` for symlink detection (not `stat`), matching existing test-utils pattern.
