# Spec — Integration test: SIGTERM mid-add leaves the FS recoverable (A5)

- **Source bean:** `ldf-ylps`
- **Parent epic:** `ldf-vcv0`
- **References:** [PRD §A5](../prds/001_mvp.md), [PRD §F3](../prds/001_mvp.md), [TrackService.add spec](./track-and-untrack-with-backups-f3-f4-f7_implement-trackserviceadd-with-rollback.md), [CONSTITUTION §3.2](../CONSTITUTION.md).

## Goal

Run a real `ldf add` end-to-end in a child Bun process against a tmp `$HOME` with a real `jj` binary, kill the child with SIGTERM partway through, then **launch a recovery pass** (the same `ldf add` re-invoked) and assert that the filesystem ends in one of two consistent states:

- **State F (fully tracked):** target is an LDF symlink, source under `dotfilesRoot` holds the original bytes, `jj log` contains `track <rel>`.
- **State R (fully restored):** target is a regular file with the original bytes, no source under `dotfilesRoot`, `jj log` does not contain `track <rel>` (or contains an abandoned/empty change observable via the operation log).

Never both, never neither, never half (no orphan symlink, no missing target).

## Public surface

No production code. Adds two artifacts:

- `src/services/track.service.sigterm.integration.test.ts` — the test driver.
- `scripts/track-add-once.ts` — a Bun script that runs `services.track.add(<path>)` once and exits, used as the SIGTERM victim. Lives under `scripts/` so it is excluded from production bundling and not imported from app code.

`scripts/track-add-once.ts`:

```ts
#!/usr/bin/env bun
import { wireServices } from "../src/composition/services";

const home = process.env["LDF_TEST_HOME"];
const target = process.env["LDF_TEST_TARGET"];
if (!home || !target) {
  process.stderr.write("LDF_TEST_HOME and LDF_TEST_TARGET required\n");
  process.exitCode = 2;
} else {
  const services = wireServices({ home });
  const r = await services.track.add(target);
  if (r.ok) {
    process.stdout.write(JSON.stringify({ ok: true, file: r.value }) + "\n");
  } else {
    process.stdout.write(JSON.stringify({ ok: false, error: r.error }) + "\n");
    process.exitCode = 1;
  }
}
```

`process.exit()` is **not** called here; this is the binary entry of a script, not app code. Setting `process.exitCode` is permitted (CONSTITUTION §6.1 forbids `process.exit()`, not `exitCode`).

## Test outline

```ts
import { describe, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTmpDir } from "../test-utils/tmp";
import { wireServices } from "../composition/services";

describe("SIGTERM mid-add leaves a recoverable filesystem", () => {
  // Run the matrix several times so we hit different points in the sequence.
  for (let trial = 0; trial < 5; trial++) {
    test(`trial ${trial}`, async () => {
      await withTmpDir(async (home) => {
        const target = join(home.path, ".zshrc");
        const original = "alias g=jj\n";
        await writeFile(target, original, { mode: 0o600 });

        const services = wireServices({ home: home.path });
        const boot = await services.bootstrap.run();
        expect(boot.ok).toBe(true);

        // Spawn the script.
        const proc = Bun.spawn(["bun", "scripts/track-add-once.ts"], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            LDF_TEST_HOME: home.path,
            LDF_TEST_TARGET: target,
          },
          stdout: "pipe",
          stderr: "pipe",
        });

        // SIGTERM at a randomized delay between 5ms and 80ms to cover different steps.
        const delayMs = 5 + Math.floor(Math.random() * 76);
        setTimeout(() => proc.kill("SIGTERM"), delayMs);
        await proc.exited;

        // Recovery: re-run via the in-process service. The target either is
        // already in State F (re-run becomes a no-op via InvalidTarget("already-symlinked"))
        // or is restored to State R (ready to be added cleanly).
        const after = await services.track.add(target).catch((e) => e);

        const state = await classifyFs({
          target,
          source: `${home.path}/dotfiles/.zshrc`,
          backupRoot: `${home.path}/.dotfiles.bak`,
          original,
        });
        expect(state).toMatch(/^(fully-tracked|fully-restored|fully-tracked-by-recovery)$/);
        // Liveness: the recovery completed cleanly.
        expect(
          after.ok ||
            (after.error?.tag === "InvalidTarget" && after.error?.reason === "already-symlinked"),
        ).toBe(true);
      });
    });
  }
});
```

`classifyFs` lives in `src/test-utils/fs.ts` (added by the A4 spec):

```ts
export async function classifyFs(input: {
  target: string;
  source: string;
  backupRoot: string;
  original: string;
}): Promise<"fully-tracked" | "fully-restored" | "fully-tracked-by-recovery" | "broken">;
```

It returns:

- `"fully-tracked"` if `target` is a symlink → `source`, `source` exists with content `original`.
- `"fully-restored"` if `target` is a regular file with content `original` and `source` does not exist.
- `"fully-tracked-by-recovery"` if the post-recovery `services.track.add` succeeded and the FS is now `"fully-tracked"`.
- `"broken"` otherwise (e.g. orphan symlink, missing target, source without symlink) — the test fails.

## Internal design

- The driver kills the child mid-flight; the child does **not** install signal handlers (no graceful shutdown of in-flight operations is part of MVP scope per PRD §3 N7). The crash leaves the FS in whatever state the rollback path recorded before SIGTERM landed.
- The recovery pass exercises the idempotency property of `add`: re-running on an already-tracked symlink fails with `InvalidTarget("already-symlinked")` (per the `add` spec validate step) — that is the marker that recovery did **not** silently re-snapshot.
- The randomized SIGTERM delay across 5 trials gives reasonable coverage of all six steps without going to a deterministic per-step harness; if a flake surfaces, the matrix is upgraded to inject SIGTERM at known step boundaries via an `LDF_TEST_FAULT_AT=<step>` env var that the production code **must not** read (a test-only hook is acceptable only behind a flag set in tests). Tracked as a follow-up if A5 cannot be made deterministic by trial-count alone.

## Dependencies

- `src/test-utils/tmp.ts` and `src/test-utils/fs.ts` (`classifyFs`, helpers added by A4 spec).
- All track-phase production specs.
- `scripts/track-add-once.ts` (this spec).

## Tests

This spec **is** the test deliverable.

## Acceptance

- All 5 trials green: every post-SIGTERM state classifies as `fully-tracked`, `fully-restored`, or `fully-tracked-by-recovery`. Never `broken`.
- The child exits non-zero or is killed; the recovery pass completes without throwing.

## Review

Approved with one carve-out documented in §Internal design: a deterministic per-step harness is held in reserve. PRD §A5 demands "fully tracked or fully restored, never half"; the trial-randomized approach satisfies that observably and avoids leaking test-only hooks into production code. The `scripts/` placement keeps the SIGTERM victim out of the runtime bundle.
