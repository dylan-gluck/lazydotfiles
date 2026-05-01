# Spec: Scaffold layered directory skeleton

- Source bean: `ldf-2atp`
- Parent epic: `ldf-j9pe`
- References: ADR-001 §4.1, CONSTITUTION §1.1–§1.2

## Goal

Create the empty layered directory skeleton under `src/` (and `tests/`) so every later phase has a stable home for its files.

## Public surface

Directories created (each with a placeholder `.gitkeep` only when the layer ships no real file in this phase; otherwise no `.gitkeep`):

```
src/domain/
src/repositories/
src/services/
src/controllers/
src/actors/
src/views/
src/views/components/
src/views/panels/
src/views/theme/
src/lib/
src/composition/
src/test-utils/
tests/
```

No barrel `index.ts` files in this task — barrels appear when a layer has ≥2 exports worth grouping.

## Internal design

- Directories are created as a side-effect of dependent specs writing files into them. No explicit `mkdir` step.
- For directories that have no files in this phase (`src/repositories`, `src/services`, `src/views/panels`, `tests/`), add a `.gitkeep` so they are tracked by git/jj.

## Dependencies

- None. This task is satisfied entirely by the file-writing side-effects of the other specs in this phase, plus the `.gitkeep` files for empty layers.

## Tests

- None for this task; verified by directory presence after Step 5.

## Acceptance

- `find src tests -type d -maxdepth 3` lists every directory above.
- No layer is missing.
- Empty layers carry exactly one `.gitkeep`.
