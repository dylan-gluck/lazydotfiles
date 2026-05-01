# Spec — Verify A2: discovery surfaces dotfiles and auto-tracks non-glob includes

- **Source bean:** `ldf-elp1`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A2](../prds/001_mvp.md), [CONSTITUTION §6](../CONSTITUTION.md).

## Goal

Confirm that the existing A2 integration test satisfies PRD §A2 and wire it into the e2e acceptance suite.

## Public surface

No new production code. One thin e2e wrapper:

- `tests/e2e/a2-discovery-auto-track.test.ts` — re-imports the canonical test.

```ts
// tests/e2e/a2-discovery-auto-track.test.ts
// Re-runs the canonical A2 scenario inside the e2e acceptance suite.
import "../discovery.a2.test";
```

## Existing coverage

**File:** `tests/discovery.a2.test.ts`

Assertions made:

1. `.zshrc` (a non-glob include) is auto-tracked via the `autoTrack` callback — satisfies **A2 "auto-track on a non-glob include lands the file without queue interaction"**.
2. `.zshrc` does NOT appear in the queued candidates list — confirms auto-track removed it from the queue.
3. `.config/fish/config.fish` appears in the queued candidates — satisfies **A2 "surfaces ~/.config/fish/config.fish"**.
4. `.config/fish/functions/greet.fish` appears in the queued candidates — satisfies **A2 "at least the siblings of any accepted file"** (glob expansion).
5. `expandSiblings` on `config.fish` returns `greet.fish` with reason `"sibling-of"` — satisfies **A2 sibling expansion**.

All five assertions map directly to PRD §A2 clauses. Coverage is complete.

## Internal design

The test constructs a tmp `$HOME` with `.zshrc`, `.config/fish/config.fish`, and `.config/fish/functions/greet.fish`. It configures discovery with `auto_track: true` and `include: [".zshrc", ".config/**/*"]`. The `autoTrack` callback is a spy that records calls. `createDiscoveryService` + `createFsScannerRepository` are wired directly (no `wireServices` needed — this tests the service layer in isolation with a real filesystem).

No side effects beyond the tmp directory. No signal handling, no jj, no git.

## Dependencies

- `src/test-utils/tmp.ts` (`makeTmpDir`)
- `src/domain/config.ts` (`defaultConfig`)
- `src/repositories/fs-scanner.repository.ts`
- `src/services/discovery.service.ts`

## Tests

The existing test IS the deliverable. The e2e wrapper re-exports it so `bun test tests/e2e/` includes A2 coverage.

## Acceptance

| PRD §A2 clause                        | Assertion                                               | Status     |
| ------------------------------------- | ------------------------------------------------------- | ---------- |
| Surfaces `~/.zshrc`                   | `autoTracked` contains `.zshrc` path                    | ✓ existing |
| Surfaces `~/.config/fish/config.fish` | `queuedPaths` contains `config.fish`                    | ✓ existing |
| Siblings of accepted file             | `expandSiblings` returns `greet.fish` with `sibling-of` | ✓ existing |
| Auto-track non-glob include           | `.zshrc` is auto-tracked, not queued                    | ✓ existing |

No new production code required.

## Review

Approved. The e2e wrapper is a single re-import; Bun discovers and re-runs the `describe`/`test` blocks declared at module load in the canonical file. CONSTITUTION §6 compliance: no `process.exit()`, no mutable shared state, no domain logic in components, no repository calls outside services, no untyped boundaries, no `any`.
