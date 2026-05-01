# Spec: Extend SyncState with conflict descriptors

| Field         | Value                                          |
| ------------- | ---------------------------------------------- |
| Bean          | `ldf-p4vs`                                     |
| Parent epic   | `ldf-egel` (Sync F6)                           |
| PRD reference | §6 SyncState, §F6 Sync, §A6                    |
| ADR reference | ADR-001 §4.2 (entity-first), Constitution §1.4 |

## Goal

Add a typed conflict descriptor to the `SyncState` aggregate so the actor and view can render per-file conflict choices without re-parsing strings.

## Public surface

`src/domain/repo.ts`:

```ts
export const ConflictKindSchema: Schema<"ours" | "theirs" | "edit-pending"> = union([
  literal("ours"),
  literal("theirs"),
  literal("edit-pending"),
]);
export type ConflictKind = Infer<typeof ConflictKindSchema>;

export const ConflictDescriptorSchema = object({
  path: string(), // dotfiles-repo-relative path of the conflicted file
  kind: ConflictKindSchema, // pending choice; "edit-pending" means user opened $EDITOR
});
export type ConflictDescriptor = Infer<typeof ConflictDescriptorSchema>;

export const SyncStateSchema = object({
  lastSyncAt: nullableString(),
  ahead: number(),
  behind: number(),
  dirty: boolean(),
  remote: nullableString(),
  conflicts: array(ConflictDescriptorSchema), // [] when none
});
```

`SyncState` consumers (`repo.service.ts`, `repo.actor.ts`, `JjRepository.status`) **MUST** treat `conflicts: []` as the default for clean repos.

## Internal design

- `ConflictDescriptor.path` is **always** dotfiles-repo-relative (matches `jj diff --summary` paths). Absolute paths are **PROHIBITED** so the descriptor stays portable across machines.
- `ConflictKind = "edit-pending"` is a UI hint that the file was sent to `$EDITOR` and not yet re-checked. It is set by the sync actor on `resolveConflict {choice: "edit"}`; cleared by the next refresh that finds the file no longer conflicted.
- No methods on the schema; pure data.

## Dependencies

- Internal: `domain/schema.ts` (`object`, `array`, `union`, `literal`, `string`, `number`, `boolean`, the `nullableString` helper already present in `repo.ts`).
- External: none.

## Tests

`src/domain/repo.test.ts` (extend if exists, else create):

- `SyncStateSchema` validates a full payload with `conflicts: [{path:"a", kind:"ours"}]`.
- `SyncStateSchema` rejects `conflicts: [{path:"a"}]` (missing `kind`) with a Validation issue.
- `ConflictKindSchema` rejects `"resolved"` (only ours/theirs/edit-pending).
- `SyncStateSchema` accepts `conflicts: []` and `dirty: false` (clean repo).

## Acceptance

- `Infer<typeof SyncStateSchema>` includes `readonly conflicts: readonly ConflictDescriptor[]`.
- `repo.service.syncState()` returns `SyncState` with `conflicts: []` on a clean repo (regression already covered by `repo.service.test.ts`; updated to assert `conflicts === []`).
- `bun test src/domain/repo.test.ts` is green.

## Review

- Cross-spec interfaces verified: `ConflictDescriptor` (domain) → `SyncState.conflicts` → `SyncOutcome` → `SyncActorState.conflicts` → `SyncPanel`. `ResolveChoice` exported from sync.service consumed by actor and panel.
- PRD coverage: F6 (fetch/push/sync/resolve/auto-sync) + A6 (round-trip integration) covered.
- Constitution checks: no `process.exit`, no width/height for layout flow, no hex literals in components, every boundary returns `Result<T, ServiceError>`.
- Approved.
