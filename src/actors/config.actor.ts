import type { Config } from "../domain/config";
import type { ServiceError } from "../services/types";
import type { Services } from "../composition/services";
import type { ActorRuntime } from "./runtime";
import type { Effect, Event, Message, Reducer } from "./types";

export type ConfigStatus = "idle" | "loading" | "ready" | "saving" | "error";

export interface ConfigState {
  readonly status: ConfigStatus;
  readonly config: Config | null;
  readonly error: ServiceError | null;
}

export type ConfigMessage =
  | Message<"load", undefined>
  | Message<"loaded", { config: Config }>
  | Message<"loadFailed", { error: ServiceError }>
  | Message<"set", { option: string; value: unknown }>
  | Message<"setOk", { config: Config }>
  | Message<"setFailed", { error: ServiceError }>;

export type ConfigEvent =
  | Event<"configChanged", { config: Config }>
  | Event<"configFailed", { error: ServiceError }>;

export const CONFIG_ACTOR_ID = "config";

export const initialConfigState: ConfigState = {
  status: "idle",
  config: null,
  error: null,
};

const loadEffect: Effect<ConfigMessage, Services> = async ({ config }) => {
  const r = await config.loadOrInit();
  return r.ok
    ? { kind: "loaded", payload: { config: r.value } }
    : { kind: "loadFailed", payload: { error: r.error } };
};

function setEffect(option: string, value: unknown): Effect<ConfigMessage, Services> {
  return async ({ config }) => {
    const r = await config.set(option, value);
    return r.ok
      ? { kind: "setOk", payload: { config: r.value } }
      : { kind: "setFailed", payload: { error: r.error } };
  };
}

export const configReducer: Reducer<ConfigState, ConfigMessage, ConfigEvent, Services> = (
  state,
  msg,
) => {
  switch (msg.kind) {
    case "load":
      return {
        state: { ...state, status: "loading", error: null },
        events: [],
        effects: [loadEffect],
      };
    case "loaded":
      return {
        state: { status: "ready", config: msg.payload.config, error: null },
        events: [{ kind: "configChanged", payload: { config: msg.payload.config } }],
        effects: [],
      };
    case "loadFailed":
      return {
        state: { ...state, status: "error", error: msg.payload.error },
        events: [{ kind: "configFailed", payload: { error: msg.payload.error } }],
        effects: [],
      };
    case "set":
      return {
        state: { ...state, status: "saving", error: null },
        events: [],
        effects: [setEffect(msg.payload.option, msg.payload.value)],
      };
    case "setOk":
      return {
        state: { status: "ready", config: msg.payload.config, error: null },
        events: [{ kind: "configChanged", payload: { config: msg.payload.config } }],
        effects: [],
      };
    case "setFailed":
      return {
        state: { ...state, status: "error", error: msg.payload.error },
        events: [{ kind: "configFailed", payload: { error: msg.payload.error } }],
        effects: [],
      };
  }
};

export function spawnConfigActor(runtime: ActorRuntime<Services>): void {
  runtime.spawn<ConfigState, ConfigMessage, ConfigEvent>({
    id: CONFIG_ACTOR_ID,
    initial: initialConfigState,
    reducer: configReducer,
  });
}
