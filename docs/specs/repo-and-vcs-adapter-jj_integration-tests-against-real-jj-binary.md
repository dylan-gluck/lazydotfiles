# Spec — Integration tests against real `jj` binary

- **Source bean:** `ldf-9mrb`
- **Parent epic:** `ldf-zf8l`
- **References:** [PRD §F5, §A8](../prds/001_mvp.md), [CONSTITUTION §3.1](../CONSTITUTION.md).

## Goal

Prove the `jj.repository` round-trips against the real `jj` binary in a tmp colocated repo. Prove typed `RepoError` on spawn failure.

## Public surface

Test file: `tests/repositories/jj.repository.test.ts`.

Uses `withTmpDir` from `src/test-utils/tmp.ts`. Skips the suite when `Bun.which("jj") === null`, mirroring `tests/composition/services.test.ts`.

## Internal design

- Each test gets a fresh tmp dir as the colocated repo root.
- Round-trip test:
  1. `jj.initColocated(root)` — `ok`.
  2. `jj.describe({ root, message: "track .zshrc" })` — `ok`.
  3. `jj.snapshot({ root })` — `ok`.
  4. `jj.opLog({ root, limit: 5 })` — `ok([Operation, ...])`. Assert:
     - the most recent op's `description` starts with `"track .zshrc"`,
     - its `kind` is `"track"`,
     - `at` parses as a Date (`!Number.isNaN(Date.parse(at))`),
     - the op list contains the initial `init` op as the oldest entry.
- Spawn-error test: call a private method or call `runJj` indirectly by giving `describe` a path with no `.jj` directory. The result `MUST` be `err({ tag: "Spawn", command: ["jj", "describe", "-m", ...], exitCode: <non-zero>, stderr: <non-empty> })`. The test asserts the discriminant is `"Spawn"`, not `"IoError"`, and that `stderr` is included.
- Status test: after one `describe + snapshot`, `jj.status({ root }).value.dirty` is `false` (the change is captured); after `Bun.write(${root}/extra.txt, "x")` without snapshot, `dirty` is `true`.

## Dependencies

- `src/repositories/jj.repository.ts`.
- `src/test-utils/tmp.ts`.
- Real `jj` binary on `$PATH` (skipped otherwise).

## Tests

Listed above; one suite, three tests.

## Acceptance

- `bun test tests/repositories/jj.repository.test.ts` green when `jj` is available.
- `Operation[]` returned matches the change made; the parser actually executes against real `jj` template output.
- The spawn-error path returns `RepoError { tag: "Spawn" }` — never throws, never returns a string.

## Review

Approved. Mirrors PRD §A8 ("integration tests against `fs.mkdtemp` directories") and the bean's stated acceptance.
