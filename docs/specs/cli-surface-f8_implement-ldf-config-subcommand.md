# cli-surface-f8 — `ldf config`

- **Bean:** ldf-gmt5
- **Parent epic:** ldf-zfcv
- **PRD:** §F8
- **ADR:** ADR-001 §4.5
- **Constitution:** §2.1, §6.4

## Goal

Print or set a config option through `services.config`. No domain logic.

## Public surface

```ts
// src/cli/handlers/config.ts
export function configHandler(
  rest: readonly string[],
  deps: import("../index").CliDeps,
): Promise<number>;
```

Forms:

- `ldf config` → print every known option as `<key> = <JSON value>`, one per line. Exit 0.
- `ldf config <key>` → print `<JSON value>`. Unknown key → exit 1.
- `ldf config <key> <value>` → coerce `<value>` then call `services.config.set(key, coerced)`. Exit 0 on `ok`. Validation error → exit 1.

Coercion rules (`<value>` is a single arg):

- `"true"|"false"` → boolean.
- Pure numeric (`/^-?\d+(\.\d+)?$/`) → number.
- Starts with `[` → `JSON.parse` (must be array of strings); fail-parse → exit 1 stderr `bad value (expected JSON array)`.
- Otherwise → string.

## Internal design

- Known keys defined in `config.service.ts` (`KNOWN_OPTIONS`); the handler imports nothing private — uses `services.config.get(key)` to detect membership (returns `NotFound` for unknowns).
- Listing all keys: hardcode the same list locally? **No** — re-export `KNOWN_OPTIONS` from `services/config.service.ts` so the handler stays a single-source-of-truth consumer.

## Dependencies

- `services.config.get`, `services.config.set`.
- `KNOWN_OPTIONS` re-exported from `services/config.service.ts`.

## Tests

- `config` lists ≥1 option in `<key> = <value>` form.
- `config discovery.auto_track` prints `true` (default).
- `config discovery.auto_track false` succeeds and a follow-up `get` returns `false`.
- `config bogus.key` → exit 1, stderr `unknown option`.
- `config discovery.include "[\"a\",\"b\"]"` updates the array.
- `config discovery.auto_track maybe` → exit 1 (validation rejects non-bool).

## Acceptance

- F8 config row.

## Review

Approved. Re-export of `KNOWN_OPTIONS` is the only outward change to `config.service.ts`; no semantics change.
