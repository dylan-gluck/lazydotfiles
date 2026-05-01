# cli-surface-f8 — Smoke tests

- **Bean:** ldf-61uo
- **Parent epic:** ldf-zfcv
- **PRD:** §F8, §A1, §A3, §A4
- **ADR:** ADR-001 §4.5
- **Constitution:** §3.1, §3.2

## Goal

End-to-end smoke tests that spawn `bun run bin/ldf.ts <args>` against a tmp `$HOME` and assert stdout + exit code. These are the proof that the binary entry, dispatcher, services wiring, and handlers compose correctly.

## Public surface

`src/cli/cli.smoke.integration.test.ts` — single test file, one `describe("ldf cli", …)`.

## Internal design

- Use `withTmpDir` from `test-utils/tmp.ts` to build `$HOME`.
- Spawn pattern:
  ```ts
  const proc = Bun.spawn(["bun", "run", "bin/ldf.ts", ...args], {
    env: { ...process.env, HOME: tmp.path, EDITOR: "true" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  ```
- Each case is independent (fresh tmp `$HOME` per case via `beforeEach`/`withTmpDir`).
- Cases:
  1. `ldf status` on cold start → exit 0, stdout has `tracked: 0`, `queue:`.
  2. `ldf log` on cold start → exit 0, stdout has at least `init` line or `(no operations)`.
  3. `ldf add <tmp>/.zshrc` (after writing the file) → exit 0, stdout begins `tracked `; symlink at `<tmp>/.zshrc` exists.
  4. `ldf rm <tmp>/.zshrc` after step 3 → exit 0, stdout begins `untracked `; original file restored.
  5. `ldf add /no/such/path` → exit 1, stderr non-empty.
  6. `ldf config discovery.auto_track` → stdout `true`, exit 0.
  7. `ldf config discovery.auto_track false` → exit 0; follow-up `get` returns `false`.
  8. `ldf unknown` → exit 1, stderr contains `unknown command`.
  9. (Optional, behind `process.env.LDF_HAS_REMOTE`) `ldf sync` against a tmp git remote → exit 0 or 2 deterministically.

## Dependencies

- `test-utils/tmp.ts::withTmpDir`, `Bun.spawn`, `node:fs/promises`.

## Tests

(This file IS the test.) No additional unit tests needed beyond per-handler tests in their specs.

## Acceptance

- All non-skipped cases pass deterministically against tmp `$HOME`.
- No real `$HOME` is touched (`HOME` overridden in spawn env per CONSTITUTION integration-test rule).

## Review

Approved. Sync case is opt-in to keep CI deterministic without a network/remote.
