# Spec: Snapshot tests for every panel (PRD A8)

- **Bean:** `ldf-irka`

## Goal

Every panel and every shared modal has at least one `@opentui/react/test-utils` test rendered through `ThemeProvider` with stubbed model props (PRD A8).

## Coverage matrix

| File                             | Status                                        |
| -------------------------------- | --------------------------------------------- |
| `discovery-panel.test.tsx`       | exists                                        |
| `tracked-panel.test.tsx`         | exists; **extended** with onViewLog assertion |
| `log-panel.test.tsx`             | exists                                        |
| `sync-panel.test.tsx`            | exists                                        |
| `confirm-modal.test.tsx`         | exists                                        |
| `bootstrap-error-panel.test.tsx` | **new**                                       |
| `app-shell.test.tsx`             | **new**                                       |
| `status-panel.test.tsx`          | **new** (see status spec)                     |
| `config-panel.test.tsx`          | **new** (see config spec)                     |
| `help-overlay.test.tsx`          | **new** (see help spec)                       |

## Internal design

Each new test follows the existing `tracked-panel.test.tsx` pattern: build a stub model with sensible defaults, render via `renderToFrame(<ThemeProvider mode="dark">…</ThemeProvider>, { width, height })`, assert frame text, destroy via `destroyTestSetup` in `afterEach`.

## Tests

See per-panel specs.

## Acceptance

- `bun test` runs all panel tests green.
- A8 satisfied.

## Review

Sufficient coverage for PRD A8.
