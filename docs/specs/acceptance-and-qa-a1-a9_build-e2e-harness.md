# Spec — Build e2e acceptance harness

- **Source bean:** `ldf-7994`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §9](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md).

## Goal

Provide a shared harness for all `tests/e2e/a*.test.ts` acceptance tests so each scenario is three lines: seed, act via CLI, assert.

## Public surface

**File:** `tests/e2e/harness.ts`

```ts
export interface E2eContext {
  readonly home: string;
  readonly services: Services;
  runCli(argv: string[]): Promise<{ code: number; out: string; err: string }>;
}

export function withE2eHome(fn: (ctx: E2eContext) => Promise<void>): Promise<void>;
```

### Behaviour

1. Calls `withTmpDir` (from `src/test-utils/tmp.ts`) to create an isolated `$HOME`.
2. Calls `wireServices({ home: dir.path })` (from `src/composition/services.ts`).
3. Calls `services.bootstrap.run()` and asserts `result.ok === true`. Throws on failure — no test should proceed without a bootstrapped repo.
4. Constructs a capturing `CliIO` identical to the pattern in `src/cli/cli.test.ts`:
   ```ts
   const cap = { out: "", err: "" };
   const io: CliIO = {
     stdout: (s) => {
       cap.out += s;
     },
     stderr: (s) => {
       cap.err += s;
     },
     env: { HOME: dir.path },
     cwd: dir.path,
   };
   ```
5. Wraps `runCli` (from `src/cli/index.ts`) into:
   ```ts
   async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
     cap.out = "";
     cap.err = "";
     const code = await runCli(argv, { services, io });
     return { code, out: cap.out, err: cap.err };
   }
   ```
   Each call resets `cap` so sequential invocations in one test get clean output.
6. Passes `{ home: dir.path, services, runCli: run }` to `fn`.

### What it does NOT do

- No new IO abstraction. Reuses `CliIO` from `src/cli/index.ts`.
- No `process.exit()`. No renderer. No TUI launch path.
- No test runner registration — it is a helper, not a test file.

## Internal design

The harness is pure composition: `withTmpDir` → `wireServices` → `bootstrap.run()` → capture IO → delegate. No new abstractions, no mocks.

Because `runCli` calls `bootstrap.run()` internally, and we also call it in the harness, bootstrap is effectively called twice. The second call is idempotent (the repo already exists). This is deliberate — the harness guarantees bootstrap succeeded before handing control to the test, while `runCli` does not expose its bootstrap result.

## Dependencies

- `src/test-utils/tmp.ts` — `withTmpDir`.
- `src/composition/services.ts` — `wireServices`, `Services`.
- `src/cli/index.ts` — `runCli`, `CliIO`.

## Tests

No dedicated tests for the harness itself. It is exercised transitively by every `tests/e2e/a*.test.ts` file. A broken harness fails every downstream test.

## Acceptance

- `tests/e2e/harness.ts` exists and exports `withE2eHome`.
- At least one e2e test (A1 or A3) imports it and passes.
- No `process.exit()` call in the file.

## Review

Approved. CONSTITUTION §6 compliance: no `process.exit()`, no domain logic, no repository calls, no mutable shared state, no `any`, no hand-rolled dimensions. The harness is pure service composition reusing existing tested infrastructure.
