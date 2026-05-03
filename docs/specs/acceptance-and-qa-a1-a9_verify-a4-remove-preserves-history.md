# Spec — Verify A4: remove preserves jj history

- **Source bean:** `ldf-dbab`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A4](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md).

## Goal

Confirm that the existing A4 integration test satisfies PRD §A4 and wire it into the e2e acceptance suite.

## Public surface

No new production code. One thin e2e wrapper:

- `tests/e2e/a4-remove-preserves-history.test.ts` — re-imports the canonical test.

```ts
// tests/e2e/a4-remove-preserves-history.test.ts
import "../../src/services/track.service.untrack-history.integration.test";
```

## Existing coverage

**File:** `src/services/track.service.untrack-history.integration.test.ts`

Assertions made:

1. `services.bootstrap.run()` succeeds — prerequisite: jj repo + backup dir created.
2. `services.track.add(target)` succeeds — file is tracked.
3. Target is a symlink after add — confirms symlink materialization.
4. Symlink target points to `<home>/dotfiles/.zshrc` — confirms correct dotfiles placement.
5. `services.track.remove(target)` succeeds — untrack operation completes.
6. **A4.1:** Target is no longer a symlink — file restored as regular file. Satisfies **"restores the file at its original location"**.
7. **A4.1:** Target content equals original `"alias g=jj\n"` — satisfies **"with the latest committed content"**.
8. **A4.2:** `jj log` descriptions contain `"track .zshrc"` — satisfies **"jj log retains history"** (track entry).
9. **A4.2:** `jj log` descriptions contain `"untrack .zshrc"` — satisfies **"jj log retains history"** (untrack entry).
10. **A4.3:** Source file `<home>/dotfiles/.zshrc` no longer exists — working copy cleaned up.

## Internal design

The test uses `withTmpDir` → `wireServices({ home })` → real jj operations (bootstrap, track, untrack) against a tmp `$HOME`. `createJjRepository().log()` reads real jj history to verify descriptions. No mocks.

30-second timeout accounts for jj process spawn latency.

## Dependencies

- `src/test-utils/tmp.ts` (`withTmpDir`)
- `src/test-utils/fs.ts` (`fileExists`, `isSymlink`, `readSymlinkTarget`)
- `src/composition/services.ts` (`wireServices`)
- `src/repositories/jj.repository.ts` (`createJjRepository`)

## Tests

The existing test IS the deliverable. The e2e wrapper re-exports it.

## Acceptance

| PRD §A4 clause                     | Assertion                                              | Status     |
| ---------------------------------- | ------------------------------------------------------ | ---------- |
| Restores file at original location | Target is regular file with original content           | ✓ existing |
| Latest committed content           | Content equals `"alias g=jj\n"`                        | ✓ existing |
| `jj log` retains history           | Descriptions contain `track .zshrc` + `untrack .zshrc` | ✓ existing |
| Source removed from working copy   | `dotfiles/.zshrc` does not exist                       | ✓ existing |

No new production code required.

## Review

Approved. CONSTITUTION §6 compliance: no `process.exit()`, no mutable shared state, no domain logic in components, no repository calls outside services (test uses `createJjRepository` directly for verification only — not production flow), no untyped boundaries, no `any`.
