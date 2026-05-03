# Spec — `tracked-file.repository` (JSON index)

- **Source bean:** `ldf-7slr`
- **Parent epic:** `ldf-zf8l`
- **References:** [PRD §6, §F3](../prds/001_mvp.md), [ADR-001 §4.3](../adrs/001_project.md).

## Goal

Persist the `TrackedFile` index as one JSON file per id under `<dotfiles>/.ldf/tracked/<id>.json`. Schema-validated reads.

## Public surface

File: `src/repositories/tracked-file.repository.ts`.

```typescript
import type { TrackedFile } from "../domain/tracked-file";
import type { Result } from "../lib/result";
import type { RepoError } from "./types";

export interface TrackedFileRepository {
  readonly kind: "TrackedFileRepository";
  list(): Promise<Result<readonly TrackedFile[], RepoError>>;
  read(id: string): Promise<Result<TrackedFile, RepoError>>;
  upsert(file: TrackedFile): Promise<Result<void, RepoError>>;
  remove(id: string): Promise<Result<void, RepoError>>;
}

export function createTrackedFileRepository(opts: { dotfilesRoot: string }): TrackedFileRepository;
```

Index directory: `${dotfilesRoot}/.ldf/tracked/`.

## Internal design

- `upsert` writes `JSON.stringify(file, null, 2)` via `Bun.write`. Parent dir created with `mkdir({ recursive: true })`.
- `read` resolves `<root>/.ldf/tracked/<id>.json`, returns `NotFound` when missing, `ParseError` on schema failure, `IoError` on read failure.
- `list` reads the directory entries; for each `*.json` runs the same parse path; collects ok values; first parse error short-circuits with `ParseError`.
  - The caller cannot distinguish a partial result from a full one — surfacing the first failure honestly is preferable to silently dropping malformed entries.
- `remove` calls `rm(path, { force: false })`; missing file → `NotFound`; other errors → `IoError`.
- The repository **MUST NOT** validate `id === sha256(target)` (that invariant is the domain factory's job). It validates the schema on read; on write, it trusts the caller.

## Dependencies

- `src/domain/tracked-file.ts` (`TrackedFileSchema`).
- `src/repositories/types.ts` (`RepoError`).
- `Bun.file`, `Bun.write`, `node:fs/promises` `mkdir`, `readdir`, `rm`.

## Tests

Integration `tests/repositories/tracked-file.repository.test.ts` against a tmp dir from `test-utils/tmp.ts`:

- `list()` on an empty index returns `ok([])`.
- `upsert(file)` then `read(file.id)` returns the same record.
- `read("missing")` returns `{ tag: "NotFound" }`.
- A hand-written malformed JSON in the index causes `list()` to return `ParseError` whose `issues` array names the offending field.
- `remove(id)` then `read(id)` returns `NotFound`.

## Acceptance

- One JSON per id under `<dotfiles>/.ldf/tracked/`.
- Reads validate via `TrackedFileSchema` — never `unknown` returned.
- Integration tests green against tmp dir.

## Review

Approved. Honors "every parsed input has a schema" (CONSTITUTION §6.5). The first-error short-circuit on `list()` is intentional — silent drop would violate "code MUST tell the truth" (§2.1).
