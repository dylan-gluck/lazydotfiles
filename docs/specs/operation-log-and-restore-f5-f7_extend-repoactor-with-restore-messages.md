# repo.actor restore extension

- **Source bean**: `ldf-8ubg`
- **Parent epic**: `ldf-z560`
- **PRD**: §F5, §F7, §A7
- **ADR**: ADR-001 §4.4 (actors), CONSTITUTION §1.1

## Goal

Extend `repo.actor` so the UI can dispatch restore intents through actor messages and observe outcomes via events. The actor delegates I/O to `restore.service`; the reducer remains pure.

## Public surface

`src/actors/repo.actor.ts` (extension)

```ts
// New messages
| Message<"restoreToOp", { opId: string }>
| Message<"restoreFromBackup", { backupId: string }>
| Message<"restoreOk", { kind: "op" | "backup" }>
| Message<"restoreFailed", { error: ServiceError }>

// New events
| Event<"restored", { kind: "op" | "backup" }>
| Event<"restoreFailed", { error: ServiceError }>

// New state slice
export interface RepoState {
  // ...existing fields
  readonly restoring: { kind: "op" | "backup" } | null;
}
```

The `Services` interface gains `restore: RestoreService`.

## Internal design

1. **`restoreToOp`** transition: if `restoring !== null`, drop the message (single-flight). Else set `restoring = { kind: "op" }`, no events, one effect that calls `services.restore.restoreToOp(opId)`. The effect's reply is `restoreOk` or `restoreFailed`.
2. **`restoreFromBackup`** mirrors above with `kind: "backup"`.
3. **`restoreOk`** clears `restoring`, emits `restored`, and **chains a `refresh`** by appending the existing `refreshEffect` so the panel state catches up without a separate UI roundtrip. (Alternative considered: emit the event and let `useTrackedPanel` listen — rejected because the log panel does not subscribe to that path.)
4. **`restoreFailed`** clears `restoring`, sets `state.error`, emits `restoreFailed`.
5. The reducer remains a pure function; the effect is a closure capturing `opId` / `backupId`.

## Dependencies

- `src/services/restore.service.ts` (must land first).
- `src/services/types.ts` (`ServiceError`).
- Existing `repo.actor` machinery.

## Tests

`src/actors/repo.actor.test.ts` (extend existing file)

- **`restoreToOp` while idle transitions to `restoring={kind:"op"}` and dispatches one effect.**
- **A second `restoreToOp` while `restoring !== null` is dropped (state unchanged, no effect).**
- **`restoreOk` clears `restoring`, emits `restored`, and dispatches a `refresh` effect.**
- **`restoreFailed` records `error`, emits `restoreFailed`, and clears `restoring`.**
- **End-to-end with a fake `RestoreService` returning ok: actor reaches `ready` after the chained refresh and emits both `restored` and `operationsLoaded` events.**

## Acceptance

- All five reducer tests pass.
- The runtime test demonstrates the chained refresh.
- No new state mutations outside the reducer.

## Review

- Rewrites: none.
- Approval: pending Step 4 cross-spec consistency review.
