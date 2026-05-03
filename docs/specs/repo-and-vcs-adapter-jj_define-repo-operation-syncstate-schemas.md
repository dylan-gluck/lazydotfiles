# Spec — Repo / Operation / SyncState schemas

- **Source bean:** `ldf-wq37`
- **Parent epic:** `ldf-zf8l` Repo and VCS adapter (jj)
- **References:** [PRD §6](../prds/001_mvp.md), [ADR-001 §4.2](../adrs/001_project.md), [CONSTITUTION §1.4, §2.1](../CONSTITUTION.md).

## Goal

Define the domain schemas for the repository aggregate root: `Repo`, `Operation`, `OperationKind`, and `SyncState`. These types are the contract every higher layer (service, actor, view) reads and every repository implementation produces.

## Public surface

File: `src/domain/repo.ts`.

```typescript
import type { Schema, Infer } from "./schema";

export const OperationKindSchema: Schema<"init" | "track" | "untrack" | "edit" | "sync">;
export type OperationKind = Infer<typeof OperationKindSchema>;

export const OperationSchema: Schema<{
  id: string; // jj operation id (short hash)
  parentId: string | undefined; // undefined for root op
  kind: OperationKind;
  description: string;
  at: string; // ISO-8601 UTC; serialized to TrackedFile/log entries verbatim
  filesTouched: readonly string[]; // repo-relative paths
}>;
export type Operation = Infer<typeof OperationSchema>;

export const SyncStateSchema: Schema<{
  lastSyncAt: string | null; // ISO-8601 or null when never synced
  ahead: number; // commits ahead of remote (>= 0)
  behind: number; // commits behind (>= 0)
  dirty: boolean; // working copy has uncommitted changes
  remote: string | null; // configured remote URL or null
}>;
export type SyncState = Infer<typeof SyncStateSchema>;

export const RepoSchema: Schema<{
  root: string; // absolute path to the dotfiles repo
  vcs: "jj"; // PRD N5: jj only in MVP
  head: Operation; // current head op (parsed from `jj op log -n 1`)
}>;
export type Repo = Infer<typeof RepoSchema>;
```

Helpers (same file):

```typescript
export function parseOperationKind(raw: string): OperationKind | null;
```

`parseOperationKind` maps a `jj describe` message prefix (`track …`, `untrack …`, `sync`, `init`) to an `OperationKind`. Anything else → `"edit"`. Pure; total over `string`.

## Internal design

- The schemas are built from `domain/schema.ts` primitives — no new schema combinators are introduced. If `optional`/nullable union shapes are needed (`parentId`, `lastSyncAt`, `remote`), use `union([T, literal(null)])` or `optional(T)` exactly as `domain/config.ts` does.
- `Operation.at` is a string, not `Date`, because `Date` does not round-trip through Standard Schema cleanly and our serialization layer (file logs, JSON repos) is text-first. Conversion to `Date` is the view's job.
- `parseOperationKind` is colocated with the domain because it expresses a domain rule about how human descriptions map to canonical kinds.
- `RepoSchema.head` references `OperationSchema`; the schema **MUST** be defined before `RepoSchema` so its validator is registered when `RepoSchema` is constructed.

## Dependencies

- `src/domain/schema.ts` (existing primitives).
- No external libraries.

## Tests

Co-located unit test `src/domain/repo.test.ts`:

- `OperationKindSchema` accepts each of the five literal kinds and rejects an unknown string.
- `OperationSchema` round-trips a fully populated record.
- `OperationSchema` rejects when `at` is not a string and when `filesTouched` is not an array.
- `SyncStateSchema` accepts `lastSyncAt = null` and `remote = null`.
- `RepoSchema.validate({...nested operation...})` succeeds; an unknown `vcs` literal is rejected.
- `parseOperationKind("track .zshrc")` → `"track"`; `"untrack ..."` → `"untrack"`; `"sync"` → `"sync"`; `"init"` → `"init"`; `"edited config"` → `"edit"`.

## Acceptance

- All schemas exported from `src/domain/repo.ts`.
- `bun test src/domain/repo.test.ts` passes.
- No other layer files imported (`domain/*` self-contained per ADR-001 §4.1).

## Review

Approved. Re-validated against PRD §6 — fields match the class diagram one-for-one. No constitution non-negotiables triggered.
