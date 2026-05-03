# Spec: DiscoveryCandidate schema

- Bean: `ldf-clwm`
- Parent: `ldf-auiv` (Discovery F2)
- PRD: §6 (DiscoveryCandidate), §F2.
- ADR: 001 §4.2 (entity-first), CONSTITUTION §1.4.

## Goal

Define the domain entity `DiscoveryCandidate` with schema, derived types, and pure construction helper. Exported from `src/domain/candidate.ts`.

## Public surface

```ts
// src/domain/candidate.ts
import type { Schema, Infer } from "./schema";
import type { DotfileKind } from "./tracked-file";

export const ReasonSchema: Schema<"include" | "sibling-of" | "auto">;
export type Reason = Infer<typeof ReasonSchema>;

export const CandidateStatusSchema: Schema<"pending" | "accepted" | "rejected" | "deferred">;
export type CandidateStatus = Infer<typeof CandidateStatusSchema>;

export const DiscoveryCandidateSchema: Schema<{
  id: string;
  path: string; // absolute
  kind: DotfileKind; // "file" | "directory" | "template"
  reason: Reason;
  siblings: string[]; // absolute paths under same parent dir
  status: CandidateStatus;
}>;
export type DiscoveryCandidate = Infer<typeof DiscoveryCandidateSchema>;

export interface MakeCandidateInput {
  path: string;
  kind: DotfileKind;
  reason: Reason;
  siblings?: string[];
  status?: CandidateStatus;
}

/** id = sha256(path). Pure. */
export function candidateId(path: string): string;
export function makeCandidate(input: MakeCandidateInput): DiscoveryCandidate;
```

## Internal design

- `candidateId` uses `Bun.CryptoHasher("sha256")` over the absolute path. Matches the `TrackedFile.id` convention so accepted candidates can resolve to their tracked counterpart by path.
- `makeCandidate` defaults `siblings = []`, `status = "pending"`.
- `DotfileKind` is reused from `domain/tracked-file.ts` — no parallel kind concept.
- Reuses `union`/`literal`/`object`/`array`/`string` primitives from `domain/schema.ts`. No new schema combinators introduced.

## Dependencies

- `src/domain/schema.ts`
- `src/domain/tracked-file.ts` (`DotfileKindSchema`, `DotfileKind`)

## Tests

`src/domain/candidate.test.ts`:

- `DiscoveryCandidateSchema` validates a well-formed object and returns the parsed value.
- `DiscoveryCandidateSchema` rejects an unknown `reason` and reports a `reason` issue path.
- `DiscoveryCandidateSchema` rejects an unknown `status`.
- `candidateId` is stable: same input → same hex id; different paths produce different ids.
- `makeCandidate` defaults `siblings = []` and `status = "pending"`.
- `makeCandidate` populates `id = candidateId(path)`.

## Acceptance

- `DiscoveryCandidate.path` is absolute and unique (caller asserts uniqueness; the entity owns identity via id).
- All fields required by PRD §6 are present and typed exactly per the diagram.

## Review

Self-reviewed against constitution §6: no width/height, no process.exit relevance; pure data + pure helpers. Approved.
