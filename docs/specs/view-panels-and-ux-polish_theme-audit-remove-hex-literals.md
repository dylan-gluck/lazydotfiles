# Spec: Theme audit — no hex literals outside views/theme/

- **Bean:** `ldf-394b`
- **PRD:** A9
- **CONSTITUTION:** §2.3, §6 non-negotiable.

## Goal

Verify and lock-in the rule that hex color literals appear only in `src/views/theme/`. Add a regression test that scans the source tree.

## Audit results

`grep -nE "#[0-9a-fA-F]{3,8}" src/views src/routes src/controllers src/actors src/services src/repositories src/composition`:

- only matches under `src/views/theme/tokens.ts`. Compliant. No code changes.

## Public surface

`src/views/theme/no-hex-literals.test.ts` — repository-level lint test.

## Internal design

The test recursively walks `src/` with `Bun.Glob("**/*.{ts,tsx}")`, excludes `src/views/theme/**` and `src/routeTree.gen.ts`, reads each file as text, and asserts no match for `/#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?\b/`. The test name describes the violation if it fails.

## Tests

- `no hex literals outside views/theme/`.

## Acceptance

- Test passes on current tree.
- A future PR that introduces a hex literal in a component fails CI.

## Review

Aligns with CONSTITUTION §6 #6 spirit (non-violability through tests).
