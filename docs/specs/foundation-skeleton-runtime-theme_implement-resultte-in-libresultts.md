# Spec: `Result<T, E>` in `lib/result.ts`

- Source bean: `ldf-g1dp`
- Parent epic: `ldf-j9pe`
- References: CONSTITUTION §2.1, ADR-001 §4.3–§4.4

## Goal

Provide a tiny tagged-union `Result<T, E>` type plus constructors and combinators used by every repository and service.

## Public surface

```ts
// src/lib/result.ts
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T>;
export function err<E>(error: E): Err<E>;

export function isOk<T, E>(r: Result<T, E>): r is Ok<T>;
export function isErr<T, E>(r: Result<T, E>): r is Err<E>;

export function map<T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E>;
export function flatMap<T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>): Result<U, E>;
export function mapErr<T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F>;
export function match<T, E, R>(r: Result<T, E>, on: { ok: (t: T) => R; err: (e: E) => R }): R;
```

## Internal design

- All constructors return frozen objects via `Object.freeze` for cheap defensive immutability.
- Combinators are pure; they never throw; they never mutate inputs.
- No runtime dependencies.

## Dependencies

- None.

## Tests

- `tests/lib/result.test.ts`:
  - `ok(x)` produces `{ ok: true, value: x }`.
  - `err(e)` produces `{ ok: false, error: e }`.
  - `isOk` / `isErr` discriminate correctly.
  - `map` transforms `Ok` payload, leaves `Err` untouched.
  - `flatMap` chains `Ok→Ok`, short-circuits on `Err`.
  - `mapErr` transforms `Err` payload, leaves `Ok` untouched.
  - `match` calls the right branch and returns its value.

## Acceptance

- File exists at `src/lib/result.ts` with the surface above.
- Tests in `tests/lib/result.test.ts` all pass under `bun test`.
- No consumer in this phase imports `Result` from anywhere else.
