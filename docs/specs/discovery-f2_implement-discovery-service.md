# Spec: discovery service

- Bean: `ldf-yc7b`
- Parent: `ldf-auiv` (Discovery F2)
- PRD: §F2, A2.
- ADR: 001 §4.4 (services).

## Goal

Provide `DiscoveryService` with `scan`, `expandSiblings`, and `decide` operations. Pure orchestration over `FsScannerRepository`; routes auto-track candidates to the (future) track service via an injected callback so this phase does not couple to the not-yet-built track service.

## Public surface

```ts
// src/services/discovery.service.ts
import type { Result } from "../lib/result";
import type { DiscoveryCandidate, CandidateStatus } from "../domain/candidate";
import type { Config } from "../domain/config";
import type { ServiceError } from "./types";

export type DecisionKind = "accept" | "reject" | "defer";

export interface DiscoveryScanResult {
  /** Candidates that hit the queue (glob-include matches). */
  readonly queued: readonly DiscoveryCandidate[];
  /** Paths the service auto-tracked (non-glob include matches). */
  readonly autoTracked: readonly string[];
}

export interface DiscoveryService {
  scan(config: Config): Promise<Result<DiscoveryScanResult, ServiceError>>;
  expandSiblings(
    path: string,
    depth?: number,
  ): Promise<Result<readonly DiscoveryCandidate[], ServiceError>>;
  decide(candidate: DiscoveryCandidate, decision: DecisionKind): DiscoveryCandidate; // pure: returns a new candidate with updated status
}

export interface DiscoveryServiceDeps {
  readonly scanner: FsScannerRepository;
  /** Invoked for non-glob include matches when `auto_track` is true. */
  readonly autoTrack?: (path: string) => Promise<Result<void, ServiceError>>;
}

export function createDiscoveryService(deps: DiscoveryServiceDeps): DiscoveryService;

/** Pure: split include patterns into bare paths (auto-track) vs globs (queue). */
export function isGlobPattern(pattern: string): boolean;
```

## Internal design

- **scan**:
  1. iterate `scanner.scan({ home, include, exclude })` from `config.path.home` and `config.discovery`.
  2. For each yielded absolute path, decide queue vs auto:
     - if `config.discovery.auto_track` is true AND the path corresponds to a non-glob include (via `isGlobPattern`), call `deps.autoTrack?.(path)` (if present); record path in `autoTracked`.
     - otherwise push a `DiscoveryCandidate` with `reason: "include"`, `kind: "file"`, `siblings: []`, `status: "pending"` into `queued`.
  3. Returns `ok({ queued, autoTracked })`. Auto-track failures collapse the whole scan to `err({tag:"Repository", cause})` because partial state is forbidden by CONSTITUTION §2.1.
- **expandSiblings**:
  1. `scanner.siblings({ path, depth: depth ?? 4 })`.
  2. Map each sibling absolute path → `makeCandidate({ path, kind: "file", reason: "sibling-of" })`.
- **decide**: pure mapper from `DecisionKind` to `CandidateStatus`:
  - `accept → accepted`, `reject → rejected`, `defer → deferred`.
- **isGlobPattern**: returns `true` if the pattern contains `*`, `?`, `[`, or `{`. Otherwise the pattern is treated as a literal include candidate for auto-track gating.

## Dependencies

- `src/repositories/fs-scanner.repository.ts`
- `src/domain/candidate.ts`
- `src/domain/config.ts`
- `src/services/types.ts`

## Tests

`src/services/discovery.service.test.ts` (unit, fake scanner):

- `scan` with `auto_track=true`, includes `[".zshrc", ".config/**/*"]`: a fake scanner yielding `/h/.zshrc` and `/h/.config/fish/config.fish` produces `autoTracked=["/h/.zshrc"]` and `queued` containing one candidate for the fish file with `reason="include"`.
- `scan` with `auto_track=false` queues the bare-path candidate too (no auto-track).
- `scan` invokes `autoTrack` exactly once per auto-tracked path, with the absolute path.
- `scan` propagates `autoTrack` failure as `err({tag:"Repository"})`.
- `expandSiblings` with depth 4 calls `scanner.siblings` with `{path, depth:4}` and returns sibling candidates with `reason="sibling-of"`.
- `expandSiblings` defaults depth to 4 when omitted.
- `decide` maps each `DecisionKind` to the corresponding `CandidateStatus` and never mutates input.
- `isGlobPattern` returns true for `**/*`, `[abc]`, `{a,b}`; false for `.zshrc`, `.config/fish/config.fish`.

## Acceptance

- Auto-track on non-glob include lands the path via `autoTrack` callback (PRD A2).
- Glob includes always queue (PRD §F2).
- `expandSiblings` default depth is 4 (PRD §F2).

## Review

Service does not import a concrete repository (DIP). `autoTrack` is optional — the discovery phase ships with `undefined`; the future track-phase wires the real callback at the composition root, no parallel API needed. Approved.
