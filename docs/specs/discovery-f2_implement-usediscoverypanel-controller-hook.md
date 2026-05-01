# Spec: useDiscoveryPanel controller

- Bean: `ldf-ktis`
- Parent: `ldf-auiv` (Discovery F2)
- ADR: 001 §4.5, 002 §4.3.

## Goal

Hook exposing the discovery actor's state plus decision/rescan/expand actions to the view. The view depends only on this hook — no direct service or actor imports in `views/`.

## Public surface

```ts
// src/controllers/discovery.controller.ts
import type { DiscoveryCandidate } from "../domain/candidate";
import type { ServiceError } from "../services/types";

export interface UseDiscoveryPanel {
  readonly status: "idle" | "scanning" | "ready" | "error";
  readonly queue: readonly DiscoveryCandidate[];
  readonly autoTracked: readonly string[];
  readonly error: ServiceError | null;
  readonly counts: {
    readonly pending: number;
    readonly accepted: number;
    readonly rejected: number;
    readonly deferred: number;
  };
  rescan(): void;
  accept(id: string): void;
  reject(id: string): void;
  defer(id: string): void;
  expand(path: string, depth?: number): void;
}

export function useDiscoveryPanel(): UseDiscoveryPanel;
```

## Internal design

- Reads `state` and `send` via `useActor<DiscoveryState, DiscoveryMessage, DiscoveryEvent>(DISCOVERY_ACTOR_ID)`.
- `counts` is computed via `useMemo` over `queue` to avoid re-computation per render.
- Action methods are stable callbacks (`useCallback`) wrapping `send({kind, payload})`.
- No local state beyond derived memo. No filesystem or service calls.

## Dependencies

- `src/actors/use-actor.ts`
- `src/actors/discovery.actor.ts`

## Tests

Covered indirectly via the snapshot test (`ldf-6jbc`) which stubs the hook. No dedicated controller test — the controller is a thin projection and CONSTITUTION §3.1 requires tested _services and reducers_; the underlying reducer is tested in `discovery.actor.test.ts`.

## Acceptance

- View receives a stable, props-only interface; hook is the sole seam.
- Re-render on actor state change is automatic via `useSyncExternalStore`.

## Review

Approved — matches the controller pattern outlined in ADR 001 §4.5.
