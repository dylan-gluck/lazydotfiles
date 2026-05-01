# Spec: /discover route

- Bean: `ldf-2a2i`
- Parent: `ldf-auiv` (Discovery F2)
- ADR: 002 §4.2.

## Goal

Thin file-based route at `src/routes/discover.tsx` that wires `useDiscoveryPanel()` to `<DiscoveryPanel>`. Triggers an initial rescan on mount.

## Public surface

```tsx
// src/routes/discover.tsx
export const Route = createFileRoute("/discover")({ component: Discover });
```

## Internal design

- `Discover()` calls `useDiscoveryPanel()`, then `useEffect(() => { if (model.status === "idle") model.rescan(); }, [])` to kick off the first scan when the actor's state is still initial.
- Renders `<DiscoveryPanel model={model} />`.
- Updates the global keymap entry (in `controllers/keymap.ts`) to add `keys: ["4"]` → navigate to `/discover` so the panel is reachable. Also updates the footer hint in `__root.tsx` accordingly.

## Dependencies

- `src/controllers/discovery.controller.ts`
- `src/views/panels/discovery-panel.tsx`
- `@tanstack/react-router`

## Tests

No dedicated test (route shell is trivial). Snapshot test in `ldf-6jbc` exercises the panel directly.

## Acceptance

- After running `bun run generate-routes`, `routeTree.gen.ts` lists `/discover`.
- TUI navigates to `/discover` via the new keymap binding.

## Review

Approved.
