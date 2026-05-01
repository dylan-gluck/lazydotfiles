# Spec: Standard-Schema validator in `domain/schema.ts`

- Source bean: `ldf-mmob`
- Parent epic: `ldf-j9pe`
- References: ADR-001 §4.2 (Schema choice), CONSTITUTION §1.4, [standardschema.dev](https://standardschema.dev)

## Goal

Provide a minimal in-tree implementation of the `StandardSchemaV1` interface that validates every shape this MVP needs (`string`, `number`, `boolean`, `literal`, `union`, `object`, `array`, `optional`).

## Public surface

```ts
// src/domain/schema.ts
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Schema<T> = StandardSchemaV1<unknown, T> & {
  readonly "~standard": StandardSchemaV1.Props<unknown, T>;
};

export type Infer<S> = S extends Schema<infer T> ? T : never;

export function string(): Schema<string>;
export function number(): Schema<number>;
export function boolean(): Schema<boolean>;
export function literal<const L extends string | number | boolean>(value: L): Schema<L>;
export function union<S extends readonly Schema<unknown>[]>(members: S): Schema<Infer<S[number]>>;
export function object<F extends Record<string, Schema<unknown>>>(
  fields: F,
): Schema<{ [K in keyof F]: Infer<F[K]> }>;
export function array<S extends Schema<unknown>>(item: S): Schema<Infer<S>[]>;
export function optional<S extends Schema<unknown>>(inner: S): Schema<Infer<S> | undefined>;
```

We do **not** add `@standard-schema/spec` as a runtime dep; we re-declare the minimal subset of the spec inline if the package is unavailable. If the package is in `node_modules` at install time we use it; otherwise we ship our own one-line interface declaration. This phase ships the inline version (no new dep).

```ts
// inline minimal spec subset (no external dep)
namespace StandardSchemaV1 {
  export interface Props<I, O> {
    readonly version: 1;
    readonly vendor: "lazy-dotfiles";
    readonly validate: (value: unknown) => Result | Promise<Result>;
    readonly types?: { readonly input: I; readonly output: O };
  }
  export type Result =
    | { readonly value: unknown; readonly issues?: undefined }
    | { readonly value?: undefined; readonly issues: readonly Issue[] };
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
  }
}
```

## Internal design

- Each combinator returns an object with `~standard.validate(value)` that returns `{ value }` on success or `{ issues }` on failure (synchronous).
- `object` validates each field; `optional` allows `undefined`; `union` succeeds on the first member that succeeds, otherwise returns the union's combined issues.
- Path threading: nested validators prepend their key so error paths read like `["dotfiles", 0, "target"]`.
- No throws; all failures are `issues`.

## Dependencies

- None at runtime. Consumed by `domain/errors.ts` indirectly (for `ParseError` shape), and by every later domain entity.

## Tests

- `tests/domain/schema.test.ts`:
  - `string().~standard.validate("a")` → `{ value: "a" }`; for `1` → `{ issues }`.
  - `number()` happy / sad.
  - `boolean()` happy / sad.
  - `literal("x")` accepts `"x"`, rejects `"y"`.
  - `union([literal("a"), literal("b")])` accepts `"a"` and `"b"`, rejects `"c"`.
  - `object({ id: string(), n: number() })` validates nested; reports path `["n"]` on bad type.
  - `array(string())` validates each element; reports path `[1]` on bad item.
  - `optional(string())` accepts `undefined` and a string.
  - Deeply nested `object({ list: array(object({ name: string() })) })` reports path `["list", 0, "name"]`.

## Acceptance

- All test cases pass.
- The exported types satisfy `Schema<T>` such that `Infer<typeof X>` evaluates to the expected TS type.
- No `any` outside the inline spec namespace.
