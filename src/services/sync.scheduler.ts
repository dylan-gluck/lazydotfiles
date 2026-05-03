import type { Interval } from "../domain/config";

export const INTERVAL_MS: Readonly<Record<Interval, number>> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export interface SyncScheduler {
  /** Idempotent: re-calling with the same interval is a no-op. */
  start(interval: Interval, onTick: () => void): void;
  /** Idempotent. */
  stop(): void;
  isRunning(): boolean;
}

export interface SchedulerDeps {
  readonly setInterval?: (cb: () => void, ms: number) => unknown;
  readonly clearInterval?: (handle: unknown) => void;
}

export function createSyncScheduler(deps: SchedulerDeps = {}): SyncScheduler {
  const setI = deps.setInterval ?? ((cb, ms) => globalThis.setInterval(cb, ms));
  const clearI =
    deps.clearInterval ??
    ((h) => globalThis.clearInterval(h as ReturnType<typeof globalThis.setInterval>));

  let handle: unknown = null;
  let activeInterval: Interval | null = null;

  return {
    start(interval, onTick) {
      if (handle !== null && activeInterval === interval) return;
      if (handle !== null) clearI(handle);
      activeInterval = interval;
      handle = setI(() => onTick(), INTERVAL_MS[interval]);
    },
    stop() {
      if (handle === null) return;
      clearI(handle);
      handle = null;
      activeInterval = null;
    },
    isRunning() {
      return handle !== null;
    },
  };
}
