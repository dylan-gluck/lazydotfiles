# Spec: TUI-scoped sync scheduler

| Field         | Value                                       |
| ------------- | ------------------------------------------- |
| Bean          | `ldf-59kv`                                  |
| Parent epic   | `ldf-egel` (Sync F6)                        |
| PRD reference | §F6 (auto_sync_interval), §N7 (no daemon)   |
| ADR reference | ADR-002 §4.1 (lifecycle), Constitution §2.4 |

## Goal

Run a sync tick at `auto_sync_interval` only while the TUI is mounted. Started by the sync actor on mount, stopped on dispose.

## Public surface

`src/services/sync.scheduler.ts`:

```ts
import type { Interval } from "../domain/config";

export interface SyncScheduler {
  /** Idempotent: re-calling with the same interval is a no-op. */
  start(interval: Interval, onTick: () => void): void;
  /** Idempotent: safe to call when not running. */
  stop(): void;
  isRunning(): boolean;
}

export interface SchedulerDeps {
  /** Test seam; defaults to globalThis.setInterval / clearInterval. */
  readonly setInterval?: typeof globalThis.setInterval;
  readonly clearInterval?: typeof globalThis.clearInterval;
}

export function createSyncScheduler(deps?: SchedulerDeps): SyncScheduler;

export const INTERVAL_MS: Readonly<Record<Interval, number>> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};
```

## Internal design

- Holds a single timer handle. `start()` with the same interval as the active timer is a no-op; with a different interval it `stop()`s and re-arms.
- Ticks call `onTick()` synchronously. The actor schedules the actual `runSync` message via its own send. The scheduler does **not** know about actors or services.
- `isRunning()` reflects "timer is armed".
- The scheduler does **not** fire immediately on `start()` — first tick is one interval later; the actor performs initial sync via a separate explicit `runSync` if desired.

## Dependencies

- `domain/config.Interval`.
- No service/repo dependencies.

## Tests

`src/services/sync.scheduler.test.ts`:

- `start("hourly", cb)` arms a timer with the hourly ms; advancing fake time fires `cb`.
- `start` twice with the same interval results in one timer handle.
- `start` then `start` with a different interval cancels the first timer.
- `stop()` clears the timer; subsequent ticks do not fire `cb`.
- `isRunning()` reflects start/stop transitions.

Use injected fake `setInterval`/`clearInterval` to keep the test deterministic.

## Acceptance

- A scheduler started with `"daily"` fires once per 86_400_000 ms (asserted via injected fake clock).
- `stop()` is idempotent and prevents further callbacks.
- No global state — each `createSyncScheduler` is independent.

## Review

- Cross-spec interfaces verified: `ConflictDescriptor` (domain) → `SyncState.conflicts` → `SyncOutcome` → `SyncActorState.conflicts` → `SyncPanel`. `ResolveChoice` exported from sync.service consumed by actor and panel.
- PRD coverage: F6 (fetch/push/sync/resolve/auto-sync) + A6 (round-trip integration) covered.
- Constitution checks: no `process.exit`, no width/height for layout flow, no hex literals in components, every boundary returns `Result<T, ServiceError>`.
- Approved.
