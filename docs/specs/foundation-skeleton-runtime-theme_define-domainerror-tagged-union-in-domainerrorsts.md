# Spec: `DomainError` tagged union in `domain/errors.ts`

- Source bean: `ldf-8eug`
- Parent epic: `ldf-j9pe`
- References: ADR-001 §4.2, CONSTITUTION §2.1

## Goal

Define the discriminated union of domain-level errors and a thin constructor + class wrapper so domain code can `throw new DomainError(...)` while service code translates it to `Result`.

## Public surface

```ts
// src/domain/errors.ts
export type DomainErrorTag =
  | "DUPLICATE_TARGET"
  | "INVARIANT_VIOLATION"
  | "PARSE_ERROR"
  | "NOT_FOUND";

export type DomainErrorDetails = {
  DUPLICATE_TARGET: { target: string };
  INVARIANT_VIOLATION: { reason: string };
  PARSE_ERROR: {
    path?: string;
    issues: readonly { message: string; path?: readonly PropertyKey[] }[];
  };
  NOT_FOUND: { resource: string; id: string };
};

export type DomainErrorOf<K extends DomainErrorTag> = {
  readonly tag: K;
} & DomainErrorDetails[K];

export type DomainErrorUnion = { [K in DomainErrorTag]: DomainErrorOf<K> }[DomainErrorTag];

export class DomainError<K extends DomainErrorTag = DomainErrorTag> extends Error {
  readonly tag: K;
  readonly details: DomainErrorDetails[K];
  constructor(tag: K, details: DomainErrorDetails[K]);
  toJSON(): DomainErrorOf<K>;
}

export function isDomainError(e: unknown): e is DomainError;
```

## Internal design

- `DomainError` extends `Error` so stack traces work; its message is `${tag}: ${JSON.stringify(details)}`.
- `details` is frozen.
- `isDomainError` checks `e instanceof DomainError`.

## Dependencies

- None. (Future `services/types.ts::ServiceError` will absorb `DomainError` cases; not in this phase.)

## Tests

- `tests/domain/errors.test.ts`:
  - Constructing `new DomainError("DUPLICATE_TARGET", { target: "x" })` yields `tag === "DUPLICATE_TARGET"` and exposes `details.target`.
  - `toJSON()` returns `{ tag, target: "x" }`.
  - `isDomainError(new DomainError(...))` is `true`; `isDomainError(new Error())` is `false`.

## Acceptance

- File ships at `src/domain/errors.ts` with the surface above.
- Tests pass.
