# cli-surface-f8 — `ldf status`

- **Bean:** ldf-3q2g
- **Parent epic:** ldf-zfcv
- **PRD:** §F8 (status row), §F1, §F6
- **ADR:** ADR-001 §4.5
- **Constitution:** §2.1, §6.4

## Goal

Print a concise health summary using only service reads. No domain logic.

## Public surface

```ts
// src/cli/handlers/status.ts
export function statusHandler(
  rest: readonly string[],
  deps: import("../index").CliDeps,
): Promise<number>;
```

Stdout format (one field per line, `<label>: <value>`):

```
repo:    <dotfilesRoot>  [clean|dirty]
tracked: <N> files
queue:   <M> candidates
sync:    last <relativeAge|never>, ahead <A>, behind <B>, remote <url|none>
backups: <K> snapshots
```

## Internal design

1. Read `Config` via `services.config.current()` (post-bootstrap it is loaded). If `null`, return `services.config.loadOrInit()`.
2. `services.repo.trackedFiles()` → count entries with `status === "tracked"`.
3. `services.discovery.scan(config)` → `queued.length` for candidate count.
4. `services.sync.state()` → format remote, last sync, ahead/behind.
5. `services.repo.syncState()` → `dirty` boolean (already returned by `sync.state()`; reuse).
6. Backups count: `services.backups.list?.()` if available; otherwise fall back to enumerating the backup directory via the existing repository (out of scope: report `?` only if no path; see review note).

Any `Result.err` from a service call → `deps.io.stderr(formatServiceError(err))`, return 2.

`relativeAge` already exists at `src/views/lib/relative-age.ts` — re-export from `lib/format.ts` so CLI does not import from `views/`.

## Dependencies

- `services.config`, `services.repo`, `services.discovery`, `services.sync`, `services.backups`.
- `lib/format.ts`: `relativeAge`, `formatServiceError`.

## Tests

- `status` against a bootstrapped tmp `$HOME` with zero tracked, zero candidates → output contains `tracked: 0 files` and `queue: 0 candidates`, exit 0.
- After a successful `track.add`, status reports `tracked: 1 files` and `dirty` flag is `clean` (post-snapshot+new-change).
- Bootstrap run before `status` is idempotent (second invocation yields identical output).

## Acceptance

- F8 status row works as documented.
- No `console.*` calls; output goes through `deps.io`.

## Review

Approved. Backups count is best-effort; if the service exposes no `count()`, the line reports `?`.
