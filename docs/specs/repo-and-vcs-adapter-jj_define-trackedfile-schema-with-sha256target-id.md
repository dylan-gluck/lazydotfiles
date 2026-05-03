# Spec — TrackedFile schema with sha256(target) id

- **Source bean:** `ldf-6j9f`
- **Parent epic:** `ldf-zf8l`
- **References:** [PRD §6](../prds/001_mvp.md), [ADR-001 §4.2](../adrs/001_project.md), [CONSTITUTION §1.4](../CONSTITUTION.md).

## Goal

Define `TrackedFile`, its enums (`DotfileKind`, `Status`), and a factory that enforces `id = sha256(target)`.

## Public surface

File: `src/domain/tracked-file.ts`.

```typescript
import type { Schema, Infer } from "./schema";

export const DotfileKindSchema: Schema<"file" | "directory" | "template">;
export type DotfileKind = Infer<typeof DotfileKindSchema>;

export const TrackedStatusSchema: Schema<"tracked" | "untracked">;
export type TrackedStatus = Infer<typeof TrackedStatusSchema>;

export const TrackedFileSchema: Schema<{
  id: string; // sha256 hex of `target`
  source: string; // absolute path inside the dotfiles repo
  target: string; // absolute path in $HOME; canonical identity
  kind: DotfileKind;
  addedAt: string; // ISO-8601
  status: TrackedStatus;
}>;
export type TrackedFile = Infer<typeof TrackedFileSchema>;

/** Compute the canonical id for a target path. Pure. */
export function trackedFileId(target: string): string;

/** Construct a TrackedFile, asserting `id === sha256(target)`. */
export function makeTrackedFile(input: {
  source: string;
  target: string;
  kind: DotfileKind;
  addedAt: string;
  status?: TrackedStatus;
}): TrackedFile;
```

## Internal design

- `trackedFileId` uses Bun's `Bun.CryptoHasher("sha256").update(target).digest("hex")`. No `node:crypto`.
- `makeTrackedFile` defaults `status` to `"tracked"`. It does not validate the schema again — it constructs a known-shape object whose `id` is derived. The repository validates on the way in/out.
- Identity is `target` (absolute path on the user's machine). This matches PRD §6: "id = sha256(target)" is "stable across moves of the dotfiles repo".

## Dependencies

- `src/domain/schema.ts`.
- `Bun.CryptoHasher` (Bun builtin).

## Tests

`src/domain/tracked-file.test.ts`:

- `trackedFileId("/Users/x/.zshrc")` is 64 hex characters; deterministic across calls.
- Two distinct targets produce distinct ids.
- `makeTrackedFile({...})` returns a record whose `id === trackedFileId(target)` and whose default `status` is `"tracked"`.
- `TrackedFileSchema` rejects records missing `id`; rejects unknown `kind`; rejects unknown `status`.

## Acceptance

- `id = sha256(target)` invariant enforced by the factory and asserted by tests.
- Schema validates cleanly for `{kind: "file"|"directory"|"template"}`.
- `bun test src/domain/tracked-file.test.ts` passes.

## Review

Approved. PRD §6 invariant matched; no aggregate-root invariant collision (uniqueness of `target` is enforced at the repository layer via id collision).
