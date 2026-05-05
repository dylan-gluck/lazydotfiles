import { describe, expect, test } from "bun:test";
import {
  createSyncScheduler,
  INTERVAL_MS,
  type SchedulerDeps,
} from "../../src/services/sync.scheduler";

interface FakeTimer {
  readonly id: number;
  readonly cb: () => void;
  readonly ms: number;
}

function makeFakeClock(): { deps: SchedulerDeps; timers: FakeTimer[]; tick: (id: number) => void } {
  const timers: FakeTimer[] = [];
  let nextId = 1;
  const deps: SchedulerDeps = {
    setInterval: (cb, ms) => {
      const id = nextId++;
      timers.push({ id, cb, ms });
      return id;
    },
    clearInterval: (h) => {
      const idx = timers.findIndex((t) => t.id === h);
      if (idx !== -1) timers.splice(idx, 1);
    },
  };
  const tick = (id: number) => {
    const t = timers.find((x) => x.id === id);
    if (t === undefined) throw new Error(`no timer ${id}`);
    t.cb();
  };
  return { deps, timers, tick };
}

describe("createSyncScheduler", () => {
  test("start arms a timer with the configured interval", () => {
    const clock = makeFakeClock();
    const s = createSyncScheduler(clock.deps);
    let n = 0;
    s.start("hourly", () => n++);
    expect(clock.timers).toHaveLength(1);
    expect(clock.timers[0]!.ms).toBe(INTERVAL_MS.hourly);
    clock.tick(clock.timers[0]!.id);
    expect(n).toBe(1);
  });

  test("start twice with the same interval is a no-op", () => {
    const clock = makeFakeClock();
    const s = createSyncScheduler(clock.deps);
    s.start("daily", () => {});
    s.start("daily", () => {});
    expect(clock.timers).toHaveLength(1);
  });

  test("start with a different interval cancels the prior timer", () => {
    const clock = makeFakeClock();
    const s = createSyncScheduler(clock.deps);
    s.start("hourly", () => {});
    s.start("weekly", () => {});
    expect(clock.timers).toHaveLength(1);
    expect(clock.timers[0]!.ms).toBe(INTERVAL_MS.weekly);
  });

  test("stop clears the timer; isRunning reflects state", () => {
    const clock = makeFakeClock();
    const s = createSyncScheduler(clock.deps);
    expect(s.isRunning()).toBe(false);
    s.start("hourly", () => {});
    expect(s.isRunning()).toBe(true);
    s.stop();
    expect(s.isRunning()).toBe(false);
    expect(clock.timers).toHaveLength(0);
  });

  test("stop is idempotent when not running", () => {
    const clock = makeFakeClock();
    const s = createSyncScheduler(clock.deps);
    expect(() => s.stop()).not.toThrow();
  });
});
