# Spec — `repo.service`

- **Source bean:** `ldf-keti`
- **Parent epic:** `ldf-zf8l`
- **References:** [ADR-001 §4.4](../adrs/001_project.md), [PRD §F5, §F7](../prds/001_mvp.md).

## Goal

Expose a reducer-friendly orchestration over the `jj` and `tracked-file` repositories. Translate `RepoError` into `ServiceError`. No `jj` strings leak.

## Public surface

File: `src/services/repo.service.ts`.

```typescript
import type { Operation, SyncState } from "../domain/repo";
import type { TrackedFile } from "../domain/tracked-file";
import type { Result } from "../lib/result";
import type { ServiceError } from "./types";

export interface RepoService {
  /** Most-recent op (op log limit 1). */
  head(): Promise<Result<Operation, ServiceError>>;
  /** Op log, newest-first. `limit` defaults to 50. */
  operations(opts?: { limit?: number }): Promise<Result<readonly Operation[], ServiceError>>;
  /** Working-copy / remote summary. */
  syncState(): Promise<Result<SyncState, ServiceError>>;
  /** True when the working copy has uncommitted changes. */
  dirty(): Promise<Result<boolean, ServiceError>>;
  /** `jj op restore <id>` — re-points the working copy. */
  restoreOp(id: string): Promise<Result<void, ServiceError>>;
  /** Snapshot of the persisted tracked-file list. */
  trackedFiles(): Promise<Result<readonly TrackedFile[], ServiceError>>;
}

export function createRepoService(deps: {
  jj: JjRepository;
  tracked: TrackedFileRepository;
  root: string; // dotfiles repo root, taken from Config.path.dotfiles
}): RepoService;
```

## Internal design

- `head()` calls `jj.opLog({ root, limit: 1 })`; `ok([])` from the underlying repo becomes `{ tag: "NotFound", resource: "Operation", id: "@" }` because a healthy initialized repo always has at least the `init` op.
- `operations()` is `jj.opLog({ root, limit })` lifted into `ServiceError`.
- `syncState()` is `jj.status({ root })` lifted.
- `dirty()` is `syncState()`'s `dirty` field.
- `restoreOp(id)` is `jj.opRestore({ root, opId: id })`.
- `trackedFiles()` is `tracked.list()`.
- Every `RepoError` becomes `{ tag: "Repository", cause: <RepoError> }`. A `RepoError` with `tag: "NotFound"` from `tracked.read` is **not** auto-translated — `read` is not on the public surface. `list()` empty is `ok([])`, never an error.

The service **MUST NOT** call `Bun.spawn` directly, **MUST NOT** read filesystem outside a repository, and **MUST NOT** import a concrete repository factory.

## Dependencies

- `src/repositories/jj.repository.ts` (interface only).
- `src/repositories/tracked-file.repository.ts` (interface only).
- `src/domain/repo.ts`, `src/domain/tracked-file.ts`.

## Tests

Unit tests `src/services/repo.service.test.ts` use **fake** repositories (real implementations with in-memory backing, per CONSTITUTION §3.1):

- `head()` returns the first op when the fake yields a non-empty op log.
- `head()` returns `ServiceError { tag: "NotFound", resource: "Operation" }` on empty op log.
- `operations({limit: 5})` forwards the limit to the fake.
- `dirty()` reflects the fake's `SyncState.dirty`.
- `syncState()` errors lift `RepoError` into `ServiceError { tag: "Repository", cause }`.
- `restoreOp("abc")` calls the fake's `opRestore` with `{ root, opId: "abc" }`.
- `trackedFiles()` returns the union of upserts performed against the fake.

## Acceptance

- All methods return `Promise<Result<T, ServiceError>>`.
- No `jj` argument arrays or `Operation` raw text appear above this layer.
- Unit tests green against fakes.

## Review

Approved. Boundary translation per ADR-001 §4.4. NotFound mapping for `head()` is justified above.
