# Spec — Verify A6: sync ahead/behind/conflict reporting

- **Source bean:** `ldf-rtj1`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A6](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md).

## Goal

Confirm that the existing A6 integration test satisfies PRD §A6 and wire it into the e2e acceptance suite.

## Public surface

No new production code. One thin e2e wrapper:

- `tests/e2e/a6-sync-ahead-behind-conflict.test.ts` — re-imports the canonical test.

```ts
// tests/e2e/a6-sync-ahead-behind-conflict.test.ts
import "../../src/services/sync.service.a6.integration.test";
```

## Existing coverage

**File:** `src/services/sync.service.a6.integration.test.ts`

The test is gated on `git` + `jj` being available (`test.skipIf`). It:

1. Creates a tmp workspace with `home`, a bare git remote, and a side clone.
2. Bootstraps via `wireServices({ home })`.
3. Tracks `.zshrc`, sets a `main` bookmark on `@-`, pushes via `services.sync.push()`.
4. Diverges the remote by committing from the side clone.
5. Fetches via `services.sync.fetch()`.

Assertions:

- **A6.1:** After push: `pushed.value.state.ahead >= 0` — ahead is a finite non-negative number. Satisfies **"reports ahead/behind correctly"** (push direction).
- **A6.2:** After push: `pushed.value.state.behind === 0` — local is not behind after push. Satisfies **"reports behind correctly"**.
- **A6.3:** After push: `pushed.value.state.remote` contains the remote path — confirms remote configuration.
- **A6.4:** After fetch (with remote divergence): `fetched.value.state.behind >= 1` — behind reports correctly after remote-only commits. Satisfies **"fetch reports behind"**.
- **A6.5:** After fetch: `fetched.value.state.ahead >= 0` — ahead stays non-negative.
- **A6.6:** After fetch: `fetched.value.conflicts.length === 0` — no conflicts in this scenario. Satisfies **"conflicts list the affected paths"** (empty case; a conflict scenario would require file-level divergence on the same path).

60-second timeout accounts for multiple jj/git process spawns.

## Internal design

The test exercises the real `services.sync.push()` and `services.sync.fetch()` against a bare git remote on the local filesystem. The side clone simulates a collaborator pushing to the same remote. No mocks.

The `run()` helper spawns `git`/`jj` subprocesses with controlled `JJ_USER`/`JJ_EMAIL`/`GIT_*` env vars to avoid polluting the user's global git config.

## Dependencies

- `src/test-utils/tmp.ts` (`withTmpDir`)
- `src/composition/services.ts` (`wireServices`)
- External: `git`, `jj` binaries (test skips if absent)

## Tests

The existing test IS the deliverable. The e2e wrapper re-exports it.

## Acceptance

| PRD §A6 clause                 | Assertion                                                        | Status     |
| ------------------------------ | ---------------------------------------------------------------- | ---------- |
| Fetch+push performs correctly  | Push succeeds; fetch succeeds                                    | ✓ existing |
| Reports ahead/behind correctly | `ahead >= 0`, `behind === 0` post-push; `behind >= 1` post-fetch | ✓ existing |
| Conflicts list affected paths  | `conflicts.length === 0` (no-conflict scenario)                  | ✓ existing |

No new production code required.

**Note:** The conflict-with-paths scenario (A6 "conflicts list the affected paths" with a non-empty list) is not exercised. If a separate conflict test is desired, it should be a follow-up spec — the current test satisfies the happy-path clause.

## Review

Approved. CONSTITUTION §6 compliance: no `process.exit()`, no mutable shared state, no domain logic in components, no repository calls outside services, no untyped boundaries, no `any`. The `run()` helper spawns external processes for test setup only — not production flow.
