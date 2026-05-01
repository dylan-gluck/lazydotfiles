# Spec: discovery actor

- Bean: `ldf-jo8a`
- Parent: `ldf-auiv` (Discovery F2)
- PRD: §4.2 actor table, §F2.
- ADR: 002 §4.3 (actor protocol).

## Goal

Own the discovery candidate queue, scan progress, and decisions. Pure reducer + effect dispatch via the `DiscoveryService`. Mirrors the shape of `repo.actor.ts` and `config.actor.ts`.

## Public surface

```ts
// src/actors/discovery.actor.ts
import type { DiscoveryCandidate } from "../domain/candidate";
import type { ServiceError } from "../services/types";
import type { ActorRuntime } from "./runtime";
import type { Effect, Event, Message, Reducer } from "./types";

export type ScanStatus = "idle" | "scanning" | "ready" | "error";

export interface DiscoveryState {
  readonly status: ScanStatus;
  readonly queue: readonly DiscoveryCandidate[];
  readonly autoTracked: readonly string[];
  readonly error: ServiceError | null;
}

export type DiscoveryMessage =
  | Message<"rescan", undefined>
  | Message<"scanOk", { queued: readonly DiscoveryCandidate[]; autoTracked: readonly string[] }>
  | Message<"scanFailed", { error: ServiceError }>
  | Message<"expand", { path: string; depth?: number }>
  | Message<"expandOk", { siblings: readonly DiscoveryCandidate[] }>
  | Message<"expandFailed", { error: ServiceError }>
  | Message<"accept", { id: string }>
  | Message<"reject", { id: string }>
  | Message<"defer", { id: string }>;

export type DiscoveryEvent =
  | Event<"scanProgress", { status: ScanStatus }>
  | Event<"candidateAdded", { count: number; reason: "include" | "sibling-of" | "auto" }>
  | Event<"candidateDecided", { id: string; decision: "accept" | "reject" | "defer" }>;

export const DISCOVERY_ACTOR_ID = "discovery";
export const initialDiscoveryState: DiscoveryState;
export const discoveryReducer: Reducer<DiscoveryState, DiscoveryMessage, DiscoveryEvent, Services>;

export function spawnDiscoveryActor(runtime: ActorRuntime<Services>): void;
```

(`Services` imported from `composition/services.ts`; the runtime requires the service bag to expose `discovery: DiscoveryService` and `config: ConfigService`.)

## Internal design

- **rescan**: transition to `scanning`, emit `scanProgress({status:"scanning"})`, dispatch one effect that:
  1. reads current config via `services.config` (uses `loadOrInit` — already idempotent post-bootstrap).
  2. calls `services.discovery.scan(config)`.
  3. replies with `scanOk` or `scanFailed`.
- **scanOk**: replace `queue` with payload, set `autoTracked`, status `ready`. Emit `scanProgress({status:"ready"})` and `candidateAdded({ count: queued.length, reason: "include" })` when queued non-empty (sibling/auto counted separately on their own paths).
- **scanFailed**: status `error`, store error, emit `scanProgress({status:"error"})`.
- **expand**: dispatch effect `services.discovery.expandSiblings(path, depth)` → `expandOk | expandFailed`. Reducer does not change status (sibling expansion is non-blocking).
- **expandOk**: append siblings to `queue`, deduplicate by `id` (siblings already present are ignored). Emit `candidateAdded({ count: appended, reason: "sibling-of" })` if any new entries landed.
- **expandFailed**: store error, no queue change. Emit no progress event (sibling expand failure is informational).
- **accept / reject / defer**: pure transitions. Find candidate by `id`, replace with `services.discovery.decide(c, decision)` (decide is pure → injected via Services). Emit `candidateDecided({ id, decision })`.
  - `accept`: status flips to `accepted`. The track service wiring is intentionally NOT in this phase; consumer of `candidateDecided` (the future track-phase actor wiring) will dispatch the add. This phase ships only the decision projection.
- All side effects live in `Effect<DiscoveryMessage, Services>` thunks. Reducer is total over the message union and pure.

## Dependencies

- `src/actors/runtime.ts`, `src/actors/types.ts`
- `src/composition/services.ts` (`Services`)
- `src/services/discovery.service.ts`
- `src/domain/candidate.ts`

## Tests

`src/actors/discovery.actor.test.ts`:

- Reducer:
  - `rescan` → state.status = "scanning", events include `scanProgress`, exactly 1 effect.
  - `scanOk` with two queued candidates → state.queue length 2, status "ready", events include `scanProgress` and `candidateAdded`.
  - `scanFailed` → state.status "error", error stored, no progress event for queue but `scanProgress({status:"error"})` emitted.
  - `expandOk` deduplicates by id when a sibling already in queue.
  - `accept` updates the targeted candidate's status to `accepted`; `reject` → `rejected`; `defer` → `deferred`.
  - `accept` on a non-existent id is a no-op (state unchanged, no event).
- Effect: with a fake `DiscoveryService` returning `ok({queued:[c1,c2], autoTracked:[]})` and a fake `ConfigService` returning a usable config, `actor.send({kind:"rescan"})` eventually moves state to `ready` with two queued candidates. (Pattern matches `repo.actor.test.ts`.)

## Acceptance

- Reducer purity: same `(state,msg)` always produces same output.
- All side effects routed through service via `Effect`.
- Re-scan keybinding `r` does not block UI thread (effect-driven). [Verified by the actor effect test ensuring `send` returns synchronously while state remains `scanning` until the effect resolves.]

## Review

Verified against ADR 002 §4.3: discriminated unions, pure reducer, effects return reply messages. No cross-actor direct calls. Approved.
