# cli-surface-f8 — `ldf log` (paged)

- **Bean:** ldf-xhpo
- **Parent epic:** ldf-zfcv
- **PRD:** §F5, §F8
- **ADR:** ADR-001 §4.5
- **Constitution:** §2.1, §6.4

## Goal

Print the operation log newest-first, supporting page bounds. Pager wiring is the user's job (`| less`); `--limit` and `--offset` flags slice the output.

## Public surface

```ts
// src/cli/handlers/log.ts
export function logHandler(
  rest: readonly string[],
  deps: import("../index").CliDeps,
): Promise<number>;
```

Flags (`util.parseArgs` strict per-handler):

- `--limit <n>` (default 50)
- `--offset <n>` (default 0)

Per-row stdout format:

```
<shortHash>  <kind>     <relAge>  <description>
                                 [<filesTouched joined ', ' truncated 80c>]
```

`shortHash` = first 8 chars of `opId`; `kind` left-padded to 7 chars.

## Internal design

1. Parse flags; bad value → stderr `bad value for --limit`, exit 1.
2. `services.operation.list({ limit, offset })`.
3. On err → exit 2.
4. Print rows; if zero rows print `(no operations)` and exit 0.

## Dependencies

- `services.operation.list`.
- `lib/format.ts`: `relativeAge`, `padRight`, `formatServiceError`, `truncate`.

## Tests

- `log` against a fresh bootstrapped repo → at least one `init` row; exit 0.
- `log --limit 1` returns exactly one row.
- Bad `--limit foo` → exit 1, stderr "bad value".

## Acceptance

- F8 log row.

## Review

Approved. Default limit 50 matches `OperationService` default; pager omitted (user pipes to `$PAGER`).
