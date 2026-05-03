# Spec — Verify A7: op-log restore rewinds working copy and re-materializes symlinks

- **Source bean:** `ldf-o0py`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A7](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md).

## Goal

Confirm that the existing A7 integration test satisfies PRD §A7 and wire it into the e2e acceptance suite.

## Public surface

No new production code. One thin e2e wrapper:

- `tests/e2e/a7-op-log-restore.test.ts` — re-imports the canonical test.

```ts
// tests/e2e/a7-op-log-restore.test.ts
import "../../src/services/restore.service.a7.integration.test";
```

## Existing coverage

**File:** `src/services/restore.service.a7.integration.test.ts`

Assertions:

1. `services.bootstrap.run()` succeeds — jj repo + backup dir created.
2. `services.track.add(target)` succeeds — `.zshrc` tracked.
3. Target is a symlink after add — symlink materialization confirmed.
4. `services.operation.list({ limit: 50 })` returns ops; `headOp` captured — op log is readable.
5. `services.track.remove(target)` succeeds — file untracked (advances history past the track op).
6. Target is NOT a symlink after remove — file restored to regular.
7. Source `dotfiles/.zshrc` does not exist after remove — working copy clean.
8. **A7.1:** `services.restore.restoreToOp(headOp.opId)` succeeds — satisfies **"restoring from jj op log rewinds the working copy"**.
9. **A7.2:** `restoreOutcome.value.rematerialized` contains target — satisfies **"re-materializes symlinks"**.
10. **A7.3:** Target is a symlink after restore — symlink re-created.
11. **A7.4:** Symlink points to `<home>/dotfiles/.zshrc` — correct target.
12. **A7.5:** `dotfiles/.zshrc` content equals `"alias g=jj\n"` — original content restored.

The sequence is: bootstrap → track → capture op → untrack → restore-to-op → verify. This exercises the full restore cycle without leaving the service layer (satisfies **"user does not need to leave the TUI"** — the TUI calls the same `services.restore.restoreToOp`).

## Internal design

The test uses `withTmpDir` → `wireServices({ home })` → real jj operations. The restore path calls `jj op restore` under the hood and then re-materializes symlinks by reading the tracked-file index. No mocks.

30-second timeout for jj process latency.

## Dependencies

- `src/test-utils/tmp.ts` (`withTmpDir`)
- `src/test-utils/fs.ts` (`fileExists`, `isSymlink`, `readSymlinkTarget`)
- `src/composition/services.ts` (`wireServices`)

## Tests

The existing test IS the deliverable. The e2e wrapper re-exports it.

## Acceptance

| PRD §A7 clause                   | Assertion                                           | Status      |
| -------------------------------- | --------------------------------------------------- | ----------- |
| Rewinds working copy             | `restoreToOp` succeeds                              | ✓ existing  |
| Re-materializes symlinks         | `rematerialized` contains target; target is symlink | ✓ existing  |
| Symlink points to correct source | `readSymlinkTarget` → `dotfiles/.zshrc`             | ✓ existing  |
| Content preserved                | `dotfiles/.zshrc` content equals original           | ✓ existing  |
| User stays in TUI                | Service-layer call; no shell-out required by user   | ✓ by design |

No new production code required.

## Review

Approved. CONSTITUTION §6 compliance: no `process.exit()`, no mutable shared state, no domain logic in components, no repository calls outside services, no untyped boundaries, no `any`.
