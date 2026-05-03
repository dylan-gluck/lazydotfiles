import { describe, expect, test } from "bun:test";
import { createActorRuntime } from "../../src/actors/runtime";
import type { Effect, Event, Message, Reducer } from "../../src/actors/types";

type State = { n: number };
type Msg =
  | Message<"inc", undefined>
  | Message<"bumped", undefined>
  | Message<"trigger", undefined>
  | Message<"silent", undefined>;
type Evt = Event<"counted", { n: number }>;
type Services = { bumper: () => Promise<Msg | null> };

const reducer: Reducer<State, Msg, Evt, Services> = (state, msg) => {
  switch (msg.kind) {
    case "inc":
      return {
        state: { n: state.n + 1 },
        events: [{ kind: "counted", payload: { n: state.n + 1 } }],
        effects: [],
      };
    case "bumped":
      return { state: { n: state.n + 10 }, events: [], effects: [] };
    case "trigger": {
      const eff: Effect<Msg, Services> = (s) => s.bumper();
      return { state, events: [], effects: [eff] };
    }
    case "silent": {
      const eff: Effect<Msg, Services> = async () => null;
      return { state, events: [], effects: [eff] };
    }
  }
};

function spawnCounter(
  services: Services = { bumper: async () => ({ kind: "bumped", payload: undefined }) },
) {
  const rt = createActorRuntime({ services });
  const actor = rt.spawn<State, Msg, Evt>({ id: "counter", initial: { n: 0 }, reducer });
  return { rt, actor };
}

describe("ActorRuntime", () => {
  test("getState returns initial", () => {
    const { actor } = spawnCounter();
    expect(actor.getState()).toEqual({ n: 0 });
  });

  test("send increments and notifies subscribers", () => {
    const { actor } = spawnCounter();
    const seen: number[] = [];
    actor.subscribe((s) => seen.push(s.n));
    actor.send({ kind: "inc", payload: undefined });
    expect(actor.getState().n).toBe(1);
    expect(seen).toEqual([0, 1]);
  });

  test("multiple subscribers receive updates", () => {
    const { actor } = spawnCounter();
    const a: number[] = [];
    const b: number[] = [];
    actor.subscribe((s) => a.push(s.n));
    actor.subscribe((s) => b.push(s.n));
    actor.send({ kind: "inc", payload: undefined });
    expect(a).toEqual([0, 1]);
    expect(b).toEqual([0, 1]);
  });

  test("unsubscribe stops further notifications", () => {
    const { actor } = spawnCounter();
    const seen: number[] = [];
    const off = actor.subscribe((s) => seen.push(s.n));
    off();
    actor.send({ kind: "inc", payload: undefined });
    expect(seen).toEqual([0]);
  });

  test("effect-replied message is dispatched", async () => {
    const { actor } = spawnCounter();
    actor.send({ kind: "trigger", payload: undefined });
    await new Promise((r) => setTimeout(r, 10));
    expect(actor.getState().n).toBe(10);
  });

  test("effect returning null causes no follow-up", async () => {
    const { actor } = spawnCounter();
    actor.send({ kind: "silent", payload: undefined });
    await new Promise((r) => setTimeout(r, 10));
    expect(actor.getState().n).toBe(0);
  });

  test("bus.on receives event", () => {
    const { rt, actor } = spawnCounter();
    const seen: number[] = [];
    rt.on<Evt>("counted", (e) => seen.push(e.payload.n));
    actor.send({ kind: "inc", payload: undefined });
    expect(seen).toEqual([1]);
  });

  test("dispose is idempotent and stops notifications", () => {
    const { rt, actor } = spawnCounter();
    const seen: number[] = [];
    actor.subscribe((s) => seen.push(s.n));
    rt.dispose();
    rt.dispose();
    actor.send({ kind: "inc", payload: undefined });
    expect(seen).toEqual([0]);
  });
});
