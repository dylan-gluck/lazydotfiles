# operation.service projection

- **Source bean**: `ldf-2l2q`
- **Parent epic**: `ldf-z560` (Operation log and restore F5, F7)
- **PRD**: §F5, §A7
- **ADR**: ADR-001 §4.3 (services), ADR-002 §3 (panel data flow)

## Goal

Project `jj op log` + `jj log` into a single, paginated, domain-typed `OperationView[]` stream consumed by the `/log` view, the CLI `ldf log`, and `restore.service`.

## Public surface

`src/domain/repo.ts` (extension)

```ts
export const OperationViewSchema = object({
  /** jj operation id (short) — used by `jj op restore`. */
  opId: string(),
  /** jj change id (short) when this op produced/edited a commit; null otherwise. */
  changeId: nullableString(),
  parentOpId: nullableString(),
  kind: OperationKindSchema,
  /** User-visible description (change description if present, else op description). */
  description: string(),
  at: string(),
  filesTouched: array(string()),
});
export type OperationView = Infer<typeof OperationViewSchema>;
```

`src/services/operation.service.ts`

```ts
export interface OperationService {
  /** Paginated, newest-first. `limit` defaults to 50, `offset` defaults to 0. */
  list(opts?: {
    limit?: number;
    offset?: number;
  }): Promise<Result<readonly OperationView[], ServiceError>>;
  /** Unified diff for a single change, in `git` format. Empty string for ops with no changeId. */
  diff(opId: string): Promise<Result<string, ServiceError>>;
}

export function createOperationService(deps: { jj: JjRepository; root: string }): OperationService;
```

`src/repositories/jj.repository.ts` (extension)

```ts
// Adds three methods to the existing JjRepository interface.
logAtOp(opts: { root: string; opId: string }): Promise<Result<Operation | null, RepoError>>;
diffSummaryAtOp(opts: { root: string; opId: string }): Promise<Result<readonly string[], RepoError>>;
diffAtOp(opts: { root: string; opId: string }): Promise<Result<string, RepoError>>;
```

## Internal design

1. **Operation list build (`OperationService.list`)**
   1. Fetch `jj op log --no-graph -T <OP_LOG_TEMPLATE> --limit <limit + offset>` (already exists; extend template to include args).
   2. For each op, run `jj log --at-op <opId> --no-graph -r @ -T <LOG_TEMPLATE>` to recover the `@` change as of that op. The change's description is the user-written one (e.g. `track .zshrc`), the `change_id.short()` is `changeId`, and `kind = parseOperationKind(description)`.
   3. Run `jj diff --at-op <opId> --summary -r @` to enumerate touched files (one short line per file: `<status> <path>`); paths are relative to `dotfilesRoot`.
   4. If `--at-op` lookup yields no change (root op, `add workspace`), set `changeId = null`, `description = <op description>`, `kind = "init"` for `add workspace`/init-like ops, else `"edit"`. `filesTouched = []`.
   5. Drop the leading `--limit limit+offset` window's first `offset` entries.
2. **Diff loader (`OperationService.diff`)**
   1. Run `jj diff --at-op <opId> --git -r @`.
   2. Empty stdout → `ok("")`. Otherwise return stdout verbatim.
3. **Repository extensions**
   - `logAtOp({ root, opId })` runs `jj log --at-op <opId> --no-graph -r @ -T <LOG_TEMPLATE>`, returning `Operation | null` (null when the op has no `@` change, e.g. `add workspace`). Reuses `parseOperationStream`.
   - `diffSummaryAtOp({ root, opId })` runs `jj diff --at-op <opId> --summary -r @`. Returns `readonly string[]` of file paths (one per line, the leading status letter + space stripped).
   - `diffAtOp({ root, opId })` runs `jj diff --at-op <opId> --git -r @`. Returns stdout.
4. **Errors**
   - All child-process failures collapse to `ServiceError = { tag: "Repository", cause: RepoError }`.
   - Parse failures from op-show / diff use `{ tag: "ParseError", path: "(jj op show)", issues }`.
5. **Pagination**
   - `list({ limit, offset })` re-runs jj queries each call. Pure projection; no caching across calls.
   - The view uses windowing on top of `list({ limit: 50 })` for MVP; offset is wired but not used by the panel.

## Dependencies

- `src/repositories/jj.repository.ts` (extended).
- `src/domain/repo.ts` (`OperationViewSchema`, reuses `OperationKind`, `nullableString`, `parseOperationKind`).
- `src/lib/result.ts`.
- `src/services/types.ts` for `ServiceError`.

## Tests

`src/services/operation.service.test.ts`

- **`list` with one describe op produces a row whose kind/description/files come from `jj log --at-op` + `jj diff --summary --at-op`.** Inject a fake `JjRepository` whose `opLog` returns three ops; `logAtOp` returns the change for the describe op with description `track .zshrc`, and `diffSummaryAtOp` returns `[".zshrc"]`.
- **`list` collapses ops with no `@` change to `changeId=null`, `filesTouched=[]`, kind from op description (`add workspace` → `init`, `snapshot working copy` → `edit`).**
- **`list({ offset: 1, limit: 2 })` returns the second-and-third entry of the underlying op log.**
- **`diff` for an op with no changeId returns `ok("")` without calling `jj diff`.**
- **`diff` for an op with a `@` change returns the stdout of `jj diff --at-op <opId> --git -r @`.**
- **Repository error from `jj.opLog` surfaces as `ServiceError.Repository`.**

`src/repositories/jj.repository.diff-summary.parse.test.ts`

- **Parses `jj diff --summary` output into a `string[]` of paths, stripping the leading status letter.**
- **Returns an empty array for empty stdout.**

## Acceptance

- `OperationService.list()` returns a non-empty stream after a `track` and a `snapshot`, with the track row carrying `description = "track <rel>"`, `kind = "track"`, and `filesTouched` containing the relative path.
- `OperationService.diff(opId)` returns a `git`-style diff string that includes the moved file path on a track op.
- All seven test cases above are red before implementation, green after.

## Review

- Rewrites: none.
- Approval: pending Step 4 cross-spec consistency review.
