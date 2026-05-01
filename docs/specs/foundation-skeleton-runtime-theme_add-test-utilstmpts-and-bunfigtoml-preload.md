# Spec: `test-utils/tmp.ts` and `bunfig.toml` `[test] preload`

- Source bean: `ldf-cwme`
- Parent epic: `ldf-j9pe`
- References: ADR-001 §4.7, CONSTITUTION §3

## Goal

Provide `withTmpDir` for integration tests that need a real filesystem, and a `bunfig.toml` `[test]` preload pointing at the test-utils setup.

## Public surface

```ts
// src/test-utils/tmp.ts
export interface TmpDir {
  readonly path: string;
  cleanup(): Promise<void>;
}

export async function makeTmpDir(prefix?: string): Promise<TmpDir>;

export async function withTmpDir<T>(fn: (dir: TmpDir) => Promise<T>, prefix?: string): Promise<T>;
```

```toml
# bunfig.toml
[test]
preload = ["./src/test-utils/setup.ts"]
```

```ts
// src/test-utils/setup.ts — currently empty hook for future shared setup
export {};
```

## Internal design

- `makeTmpDir(prefix = "ldf-")` calls `await fs.mkdtemp(path.join(os.tmpdir(), prefix))` (`node:fs/promises` since Bun has no `Bun.mkdtemp` yet — explicit ADR-001 §4.3 carve-out).
- `cleanup()` calls `fs.rm(path, { recursive: true, force: true })`.
- `withTmpDir(fn)` runs `fn(dir)` inside `try { return await fn(dir); } finally { await dir.cleanup(); }`.

## Dependencies

- `node:fs/promises`, `node:os`, `node:path` (Bun-supported).

## Tests

- `tests/test-utils/tmp.test.ts`:
  - `makeTmpDir` returns an existing directory; `cleanup` removes it.
  - `withTmpDir` cleans up on success and on thrown error.

## Acceptance

- `bunfig.toml` exists; `bun test` discovers it; no test fails because of preload.
- Tests pass.
