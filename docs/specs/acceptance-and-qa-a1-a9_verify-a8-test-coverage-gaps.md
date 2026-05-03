# Spec — Verify A8: test-coverage audit and gap report

- **Source bean:** `ldf-sa57`
- **Parent epic:** `ldf-swfv`
- **References:** [PRD §A8](../prds/001_mvp.md), [CONSTITUTION §3.1](../CONSTITUTION.md).

## Goal

Produce a written audit mapping every production module under `src/` to its test file(s), flag modules with no corresponding test, and file follow-up beans for real gaps.

## Public surface

Deliverable: `docs/audits/a8-test-coverage.md` — a markdown table with columns `Module | Test file(s) | Status`.

No production code changes. No new tests unless the audit discovers an untested service or reducer (constitution §3.1 violation).

## Internal design

### Audit scope

Scan every `.ts` / `.tsx` file (excluding `*.test.ts(x)`, `*.d.ts`, barrel `index.ts`) in:

| Layer           | Directory               |
| --------------- | ----------------------- |
| Services        | `src/services/`         |
| Repositories    | `src/repositories/`     |
| Actors          | `src/actors/`           |
| Controllers     | `src/controllers/`      |
| View panels     | `src/views/panels/`     |
| View components | `src/views/components/` |
| View lib        | `src/views/lib/`        |
| Domain          | `src/domain/`           |

For each module `foo.ts`, look for `foo.test.ts`, `foo.test.tsx`, or any `*.test.ts(x)` that imports from `./foo`. Mark as:

- **covered** — at least one dedicated test file exists.
- **partial** — tested indirectly (imported by another module's test) but no dedicated test.
- **missing** — no test coverage found.

### Known gaps (pre-audit snapshot)

Based on current file listing, expected gaps include:

| Module                       | Layer          | Notes                                                     |
| ---------------------------- | -------------- | --------------------------------------------------------- |
| `config.service.ts`          | service        | **§3.1 violation** — services MUST have tests             |
| `bootstrap.service.ts`       | service        | **§3.1 violation**                                        |
| `sync.editor.ts`             | service        | **§3.1 violation**                                        |
| `config.actor.ts`            | actor          | **§3.1 violation** — actors with reducers MUST have tests |
| `status.controller.ts`       | controller     | hook; tested indirectly via panel snapshot — mark partial |
| `config.controller.ts`       | controller     | hook; likely partial via config-panel test                |
| `sync.controller.ts`         | controller     | hook; likely partial via sync-panel test                  |
| `track.controller.ts`        | controller     | hook; likely partial via tracked-panel test               |
| `discovery.controller.ts`    | controller     | hook; likely partial via discovery-panel test             |
| `config.repository.ts`       | repository     | needs integration test                                    |
| `tracked-file.repository.ts` | repository     | needs integration test                                    |
| `fs-scanner.repository.ts`   | repository     | has `classify.test.ts` only; scan/walk untested           |
| `summarize-error.ts`         | view component | utility; may warrant a unit test                          |
| `global-keys.tsx`            | view component | tested via app-shell — mark partial                       |
| `use-actor.ts`               | actor infra    | hook; tested transitively via actor tests — partial       |
| `runtime.ts`                 | actor infra    | tested transitively — partial                             |

The implementer MUST verify each gap by checking imports in existing test files before marking final status.

### Procedure

1. Run the scan (script or manual enumeration).
2. Write `docs/audits/a8-test-coverage.md` with the full table.
3. For every **missing** module that is a service, reducer, or repository (constitution §3.1 mandates), file a follow-up bean via `beans add`.
4. For **partial** modules that are controller hooks tested only through panel snapshots, note them but do NOT file beans — indirect coverage is acceptable for hooks.

## Dependencies

- All prior build-phase specs (the modules must exist).

## Tests

This spec is an audit deliverable, not a test deliverable. The audit document itself is the artifact. If gaps are found, follow-up beans are filed — not inline fixes.

## Acceptance

- `docs/audits/a8-test-coverage.md` exists with a row for every non-test module in the scanned directories.
- Every service, actor (with reducer), and repository module is either **covered** or has a filed follow-up bean.
- No false positives: modules marked **missing** genuinely lack a test (verified by `grep` for imports).

## Review

Approved. Constitution §3.1 ("No untested service or reducer") is the enforcement gate. The audit surfaces violations; follow-up beans close them. The audit does not expand QA scope — it documents the current state and tracks remediation.
