# Spec: `config` actor

- Source bean: `ldf-bnvh`
- Parent epic: `ldf-hia6`
- References: ADR-002 §4.3, CONSTITUTION §1.1, §3.1

## Goal

Owns the loaded `Config` for the running app. Routes mutations through `ConfigService`. Emits `configChanged` on every successful load or set so other actors / views react without polling.

## Public surface

```ts
// src/actors/config.actor.ts
import type { Config } from "../domain/config";
import type { ServiceError } from "../services/types";
import type { Message, Event } from "./types";
import type { ActorRuntime } from "./runtime";
import type { Services } from "../composition/services";

export type ConfigState = {
  readonly status: "idle" | "loading" | "ready" | "saving" | "error";
  readonly config: Config | null;
  readonly error: ServiceError | null;
};

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
export const initialConfigState: ConfigState;

export function spawnConfigActor(runtime: ActorRuntime<Services>): void;
```

## Internal design

Pure reducer (`(state, msg) => { state, events, effects }`):

- `load`:
  - state → `{ ...state, status: "loading", error: null }`
  - effects → `[ async ({ config }) => { const r = await config.loadOrInit(); return r.ok ? { kind: "loaded", payload: { config: r.value } } : { kind: "loadFailed", payload: { error: r.error } }; } ]`
- `loaded`:
  - state → `{ status: "ready", config: msg.payload.config, error: null }`
  - events → `[ { kind: "configChanged", payload: { config } } ]`
- `loadFailed`:
  - state → `{ status: "error", config: state.config, error: msg.payload.error }`
  - events → `[ { kind: "configFailed", payload: { error } } ]`
- `set`:
  - state → `{ ...state, status: "saving", error: null }`
  - effects → `[ async ({ config }) => { const r = await config.set(option, value); return r.ok ? { kind: "setOk", payload: { config: r.value } } : { kind: "setFailed", payload: { error: r.error } }; } ]`
- `setOk`:
  - state → `{ status: "ready", config: msg.payload.config, error: null }`
  - events → `[ { kind: "configChanged", payload: { config } } ]`
- `setFailed`:
  - state → `{ ...state, status: "error", error: msg.payload.error }`
  - events → `[ { kind: "configFailed", payload: { error } } ]`

`spawnConfigActor` registers the actor on the runtime with `id = CONFIG_ACTOR_ID`, `initial = initialConfigState`, and the reducer above. It does **not** auto-send `load`; the composition root sends `load` after `bootstrap.run()` succeeds (so the cached config is already on disk and `loadOrInit` is a pure read).

## Dependencies

- `src/actors/types.ts`, `src/actors/runtime.ts`.
- `src/services/config.service.ts`, `src/services/types.ts`.
- `src/domain/config.ts`.

## Tests

`tests/actors/config.actor.test.ts` — pure reducer tests + an effect-dispatch test against a fake `Services`:

- `load` produces `loading` state and exactly one effect; no events.
- `loaded` transitions to `ready`, caches config, emits one `configChanged` with the same config reference.
- `loadFailed` transitions to `error`, retains previous `config`, emits `configFailed`.
- `set` produces `saving` and one effect.
- `setOk` transitions to `ready`, updates config, emits `configChanged` with new config.
- `setFailed` transitions to `error`, emits `configFailed`, retains previous config.
- **effect end-to-end** (using the real runtime + a fake `ConfigService`): sending `{kind:"load"}` results in `state.status === "ready"` and a `configChanged` event observed via `runtime.on("configChanged", …)`.

## Acceptance

- `src/actors/config.actor.ts` exports the surface above.
- All tests pass under `bun test`.
- The reducer is pure: no `await`, no `Math.random`, no `Date.now` inside the reducer body. All side effects are returned as `Effect<Msg, Services>`.

## Review

- PRD §F1, §6, §7.1, A1 coverage verified across this spec set.
- Inter-spec interfaces (ConfigService ↔ BootstrapService ↔ ConfigRepository ↔ FsRepository ↔ JjRepository ↔ config actor) typecheck on paper.
- No duplicated abstractions; default-config literal lives only in `domain/config.ts`.
- Constitution §6 non-negotiables respected: no process.exit, no width/height for layout flow, schemas at every boundary, Result returns.
- Approved for implementation.
