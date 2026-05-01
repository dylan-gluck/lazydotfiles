# Spec — Verify A5: SIGTERM mid-add rollback

- **Source bean:** `ldf-vhff`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A5](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md), [SIGTERM spec](./track-and-untrack-with-backups-f3-f4-f7_integration-test-sigterm-mid-add-a5.md).

## Goal

Confirm that the existing A5 integration test satisfies PRD §A5 and wire it into the e2e acceptance suite.

## Public surface

No new production code. One thin e2e wrapper:

- `tests/e2e/a5-sigterm-rollback.test.ts` — re-imports the canonical test.

```ts
// tests/e2e/a5-sigterm-rollback.test.ts
import "../../src/services/track.service.sigterm.integration.test";
```

## Existing coverage

**File:** `src/services/track.service.sigterm.integration.test.ts`
**Helper:** `scripts/track-add-once.ts`

The test runs 5 trials. Each trial:

1. Creates a tmp `$HOME` with `.zshrc` containing `"alias g=jj\n"`.
2. Bootstraps jj repo via `wireServices`.
3. Spawns `scripts/track-add-once.ts` as a child process with `LDF_TEST_HOME` / `LDF_TEST_TARGET`.
4. Sends SIGTERM at a randomized delay (5–80ms) to hit different points in the track sequence.
5. Classifies the post-crash filesystem via `classifyFs` → `"fully-tracked"` or `"fully-restored"`.

Assertions per trial:

- **A5.1:** If `fully-tracked`: recovery `track.add` returns `InvalidTarget("already-symlinked")` — idempotency confirmed. Satisfies **"either fully tracked … never half"**.
- **A5.2:** If `fully-restored`: recovery `track.add` succeeds; post-recovery state classifies as `fully-tracked`. Satisfies **"or fully restored"**.
- **A5.3:** Any other classification (`"broken"`) throws with diagnostic dump — the test fails. Satisfies **"never half"** by explicit rejection.

The 5-trial randomized approach covers different interrupt points without leaking test hooks into production code.

## Internal design

The child process (`scripts/track-add-once.ts`) calls `wireServices` + `services.track.add()` and sets `process.exitCode` on failure — no `process.exit()`. SIGTERM kills the child mid-flight; no signal handlers are installed (PRD §3 N7).

Recovery is performed in-process via the same `services.track.add()` call, exercising the idempotency path.

## Dependencies

- `src/test-utils/tmp.ts` (`withTmpDir`)
- `src/test-utils/fs.ts` (`classifyFs`, `isSymlink`)
- `src/composition/services.ts` (`wireServices`)
- `scripts/track-add-once.ts` (SIGTERM victim script)

## Tests

The existing test IS the deliverable. The e2e wrapper re-exports it.

## Acceptance

| PRD §A5 clause               | Assertion                                                  | Status     |
| ---------------------------- | ---------------------------------------------------------- | ---------- |
| Fully tracked after SIGTERM  | `classifyFs` returns `"fully-tracked"`, recovery is no-op  | ✓ existing |
| Fully restored after SIGTERM | `classifyFs` returns `"fully-restored"`, recovery succeeds | ✓ existing |
| Never half                   | Any other state throws `"broken FS state"`                 | ✓ existing |

No new production code required.

## Review

Approved. CONSTITUTION §6 compliance: `scripts/track-add-once.ts` uses `process.exitCode`, not `process.exit()`. No mutable shared state, no domain logic in components, no repository calls outside services, no untyped boundaries, no `any`.
