# cli-surface-f8 — `ldf sync`

- **Bean:** ldf-h5xr
- **Parent epic:** ldf-zfcv
- **PRD:** §F6, §F8, §A6
- **ADR:** ADR-001 §4.5
- **Constitution:** §2.1, §6.4

## Goal

Run `services.sync.sync()` once and report. Non-zero on conflict or push failure.

## Public surface

```ts
// src/cli/handlers/sync.ts
export function syncHandler(
  rest: readonly string[],
  deps: import("../index").CliDeps,
): Promise<number>;
```

Stdout (success):

```
sync ok  remote=<url|none>  ahead=<a> behind=<b>  last=<relAge>
```

Stdout when conflicts present:

```
sync conflicts (<n>):
  <path>
  ...
```

…and exit code `2`.

Stderr on push/fetch failure: typed `formatServiceError` line; exit `2`.

## Internal design

- No flags in MVP (`fetch`/`push` separately are TUI-only; spec deliberately omits them from CLI).
- Call `services.sync.sync()`. On `err` → stderr + exit 2. On `ok` and `outcome.conflicts.length > 0` → exit 2. Else exit 0.

## Dependencies

- `services.sync.sync`.
- `lib/format.ts::relativeAge, formatServiceError`.

## Tests

Skipped at unit level (requires a remote). The smoke test exercises the bootstrap + invoke path against tmp `$HOME` with a local file remote (per A6 integration test pattern from sync epic). If the local-remote fixture is unavailable in CI, the test asserts exit code is `0` or `2` and stdout starts with `sync `.

## Acceptance

- F8 sync row; A6 partial (full A6 already covered by `sync.service.a6.integration.test.ts`).

## Review

Approved. Limiting to `sync` only (no per-half fetch/push) keeps CLI surface scoped to PRD §F8.
