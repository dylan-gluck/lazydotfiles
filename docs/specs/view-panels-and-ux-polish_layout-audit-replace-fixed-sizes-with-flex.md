# Spec: Layout audit — flex only

- **Bean:** `ldf-t12j`
- **PRD:** A9
- **CONSTITUTION:** §2.2, §6 non-negotiable #6.

## Goal

Verify and lock in: no hand-rolled `width={N}` / `height={N>1}` for layout flow. The single allowed exception is `height={1}` for fixed status/toast bars.

## Audit results

`grep -nE "\\b(width|height)=\\{" src/views src/routes`:

- All matches are `height={1}` in status bars (`app-shell.tsx`, `discovery-panel.tsx`, `log-panel.tsx`, `sync-panel.tsx`, `tracked-panel.tsx`). Compliant.

## Public surface

`src/views/layout-discipline.test.ts`.

## Internal design

The test scans `src/views/` and `src/routes/` for occurrences of `width={` or `height={N}` where `N` is any token other than `1`, ignoring test files. It allows percentage strings (e.g. `"100%"`, permitted by §2.2 when parent has explicit size) and `flexBasis`/`flexGrow`/`flexShrink`. Failure message names the file + line.

## Tests

- `no hand-rolled width or height greater than 1 outside tests`.

## Acceptance

- Test passes on current tree.

## Review

Allowed exception (`height={1}` status rails) is explicitly documented in §2.2. Test mirrors the rule.
