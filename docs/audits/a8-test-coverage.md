# A8 — Test-Coverage Audit

| Revision | Date       | Author |
| -------- | ---------- | ------ |
| 1        | 2026-05-01 | QA     |

**Scope.** Every non-test, non-type-only `.ts`/`.tsx` production module under `src/` is mapped to
its test file(s) and marked **covered**, **partial**, or **missing**.

**References.** [PRD §A8](../prds/001_mvp.md), [CONSTITUTION §3.1](../CONSTITUTION.md),
[Spec `ldf-sa57`](../specs/acceptance-and-qa-a1-a9_verify-a8-test-coverage-gaps.md).

---

## Services (`src/services/`)

| Module                     | Test file(s)                                                                                                                                                     | Status  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `backup.service.ts`        | `src/services/backup.service.test.ts`                                                                                                                            | covered |
| `bootstrap.service.ts`     | `tests/services/bootstrap.service.test.ts`                                                                                                                       | covered |
| `config.service.ts`        | `tests/services/config.service.test.ts`                                                                                                                          | covered |
| `discovery.service.ts`     | `src/services/discovery.service.test.ts`                                                                                                                         | covered |
| `operation.service.ts`     | `src/services/operation.service.test.ts`                                                                                                                         | covered |
| `repo.service.ts`          | `src/services/repo.service.test.ts`                                                                                                                              | covered |
| `restore.service.ts`       | `src/services/restore.service.test.ts`, `src/services/restore.service.a7.integration.test.ts`                                                                    | covered |
| `sync.conflict-markers.ts` | `src/services/sync.conflict-markers.test.ts`                                                                                                                     | covered |
| `sync.editor.ts`           | `src/services/sync.editor.test.ts`                                                                                                                               | covered |
| `sync.scheduler.ts`        | `src/services/sync.scheduler.test.ts`                                                                                                                            | covered |
| `sync.service.ts`          | `src/services/sync.service.test.ts`, `src/services/sync.service.a6.integration.test.ts`                                                                          | covered |
| `track.service.ts`         | `src/services/track.service.test.ts`, `src/services/track.service.sigterm.integration.test.ts`, `src/services/track.service.untrack-history.integration.test.ts` | covered |

All services: **covered**. No §3.1 violations.

## Repositories (`src/repositories/`)

| Module                       | Test file(s)                                                                                                                                            | Status  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `backup.repository.ts`       | `src/repositories/backup.repository.test.ts`                                                                                                            | covered |
| `config.repository.ts`       | `tests/repositories/config.repository.test.ts`                                                                                                          | covered |
| `fs-scanner.repository.ts`   | `src/repositories/fs-scanner.classify.test.ts`, `tests/fs-scanner.repository.test.ts`                                                                   | covered |
| `fs.repository.ts`           | `src/repositories/fs.repository.test.ts`, `tests/repositories/fs.repository.test.ts`                                                                    | covered |
| `jj.repository.ts`           | `src/repositories/jj.repository.parse.test.ts`, `src/repositories/jj.repository.diff-summary.parse.test.ts`, `tests/repositories/jj.repository.test.ts` | covered |
| `symlink.repository.ts`      | `src/repositories/symlink.repository.test.ts`                                                                                                           | covered |
| `tracked-file.repository.ts` | `tests/repositories/tracked-file.repository.test.ts`                                                                                                    | covered |

All repositories: **covered**. No §3.1 violations.

## Actors (`src/actors/`)

| Module               | Test file(s)                                 | Status  |
| -------------------- | -------------------------------------------- | ------- |
| `config.actor.ts`    | `tests/actors/config.actor.test.ts`          | covered |
| `discovery.actor.ts` | `src/actors/discovery.actor.test.ts`         | covered |
| `repo.actor.ts`      | `src/actors/repo.actor.test.ts`              | covered |
| `sync.actor.ts`      | `src/actors/sync.actor.test.ts`              | covered |
| `track.actor.ts`     | `src/actors/track.actor.test.ts`             | covered |
| `runtime.ts`         | `tests/actors/runtime.test.ts`               | covered |
| `use-actor.ts`       | _(tested transitively via actor test files)_ | partial |

All actors with reducers: **covered**. `use-actor.ts` is a React hook tested transitively — acceptable.

## Controllers (`src/controllers/`)

| Module                    | Test file(s)                                        | Status  |
| ------------------------- | --------------------------------------------------- | ------- |
| `config.controller.ts`    | _(via `src/views/panels/config-panel.test.tsx`)_    | partial |
| `discovery.controller.ts` | _(via `src/views/panels/discovery-panel.test.tsx`)_ | partial |
| `log.controller.ts`       | `src/controllers/log.controller.test.tsx`           | covered |
| `status.controller.ts`    | _(via `src/views/panels/status-panel.test.tsx`)_    | partial |
| `sync.controller.ts`      | _(via `src/views/panels/sync-panel.test.tsx`)_      | partial |
| `track.controller.ts`     | _(via `src/views/panels/tracked-panel.test.tsx`)_   | partial |
| `keymap.ts`               | `tests/controllers/keymap.test.ts`                  | covered |

Controllers are hooks. Per spec, indirect coverage via panel snapshot tests is acceptable for hooks.
No follow-up beans required.

## View Panels (`src/views/panels/`)

| Module                      | Test file(s)                     | Status  |
| --------------------------- | -------------------------------- | ------- |
| `bootstrap-error-panel.tsx` | `bootstrap-error-panel.test.tsx` | covered |
| `config-panel.tsx`          | `config-panel.test.tsx`          | covered |
| `discovery-panel.tsx`       | `discovery-panel.test.tsx`       | covered |
| `log-panel.tsx`             | `log-panel.test.tsx`             | covered |
| `status-panel.tsx`          | `status-panel.test.tsx`          | covered |
| `sync-panel.tsx`            | `sync-panel.test.tsx`            | covered |
| `tracked-panel.tsx`         | `tracked-panel.test.tsx`         | covered |

All view panels: **covered** (snapshot tests).

## View Components (`src/views/components/`)

| Module                     | Test file(s)                        | Status  |
| -------------------------- | ----------------------------------- | ------- |
| `app-shell.tsx`            | `app-shell.test.tsx`                | covered |
| `confirm-modal.tsx`        | `confirm-modal.test.tsx`            | covered |
| `global-keys.tsx`          | _(tested via `app-shell.test.tsx`)_ | partial |
| `help-overlay.tsx`         | `help-overlay.test.tsx`             | covered |
| `help-overlay-context.tsx` | `help-overlay-context.test.tsx`     | covered |
| `summarize-error.ts`       | _(no dedicated test)_               | partial |

`global-keys.tsx` is tested as part of the app-shell integration. `summarize-error.ts` is a
small utility; neither is a service, reducer, or repository, so no §3.1 violation.

## View Lib (`src/views/lib/`)

| Module            | Test file(s)           | Status  |
| ----------------- | ---------------------- | ------- |
| `relative-age.ts` | `relative-age.test.ts` | covered |

## Domain (`src/domain/`)

| Module            | Test file(s)                  | Status  |
| ----------------- | ----------------------------- | ------- |
| `backup.ts`       | `backup.test.ts`              | covered |
| `candidate.ts`    | `candidate.test.ts`           | covered |
| `config.ts`       | `tests/domain/config.test.ts` | covered |
| `errors.ts`       | `tests/domain/errors.test.ts` | covered |
| `repo.ts`         | `repo.test.ts`                | covered |
| `schema.ts`       | `tests/domain/schema.test.ts` | covered |
| `tracked-file.ts` | `tracked-file.test.ts`        | covered |

All domain modules: **covered**.

---

## Conclusion

**A8 PRD criterion is satisfied.** Every service, repository, actor (with reducer), and domain
module has dedicated test coverage. Controller hooks are tested indirectly via panel snapshots,
which is acceptable per spec. View panels each have at least one snapshot test.

No CONSTITUTION §3.1 violations remain. The `sync.editor.ts` gap identified in the pre-audit
snapshot has been closed (`src/services/sync.editor.test.ts` added this phase).

Two view-layer utilities (`global-keys.tsx`, `summarize-error.ts`) are marked **partial** but
are not subject to §3.1 (they are neither services, reducers, nor repositories). No follow-up
beans are required for coverage gaps.
