# Spec: /sync route

| Field         | Value                  |
| ------------- | ---------------------- |
| Bean          | `ldf-0cd4`             |
| Parent epic   | `ldf-egel` (Sync F6)   |
| PRD reference | §8.5                   |
| ADR reference | ADR-002 §4.2 (routing) |

## Goal

Thin TanStack route wiring the sync actor + controller hook to `SyncPanel`. Update global keymap to navigate to `/sync`.

## Public surface

`src/routes/sync.tsx`:

```ts
export const Route = createFileRoute("/sync")({ component: Sync });
function Sync(): ReactNode;
```

`src/controllers/keymap.ts` (extended):

```ts
{ keys: ["7"], description: "Sync", run: ({ router }) => { void router.navigate({ to: "/sync" }) } },
```

`src/routes/__root.tsx` hint extended with `· [7] sync`.

## Internal design

`Sync` mounts `useSyncPanel` and renders `<SyncPanel model={model} />`. Sends `refresh` to the sync actor on mount (the controller already does this; the route stays minimal).

`routeTree.gen.ts` is regenerated via `bun run generate-routes`.

## Dependencies

- Specs: sync-panel, sync-actor.
- Code: `routes/__root.tsx`, `controllers/keymap.ts`, route generator.

## Tests

- The route compiles and `routeTree.gen.ts` includes `/sync` (verified by `bun check`).
- An integration spot-check: navigating to `/sync` in a smoke test mounts `SyncPanel` (covered by the existing pattern, no dedicated test required — keymap test already exists for prior routes).
- `controllers/keymap.test.ts` (extend if exists; else unit-test by checking the binding shape) verifies `7` navigates to `/sync`.

## Acceptance

- `bun check` passes with the new route.
- Pressing `7` in the TUI navigates to `/sync`.
- Footer hint includes `[7] sync`.

## Review

- Cross-spec interfaces verified: `ConflictDescriptor` (domain) → `SyncState.conflicts` → `SyncOutcome` → `SyncActorState.conflicts` → `SyncPanel`. `ResolveChoice` exported from sync.service consumed by actor and panel.
- PRD coverage: F6 (fetch/push/sync/resolve/auto-sync) + A6 (round-trip integration) covered.
- Constitution checks: no `process.exit`, no width/height for layout flow, no hex literals in components, every boundary returns `Result<T, ServiceError>`.
- Approved.
