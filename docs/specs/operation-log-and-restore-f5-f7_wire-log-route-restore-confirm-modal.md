# /log route + restore confirm modal wiring

- **Source bean**: `ldf-9640`
- **Parent epic**: `ldf-z560`
- **PRD**: §F5
- **ADR**: ADR-002 §2 (routes are thin shells)

## Goal

Add the `/log` route as a thin shell that hosts `LogPanel`, refreshes the repo actor on mount, and surfaces a global `[6] log` keybinding. Both restore paths route through the existing `ConfirmModal`.

## Public surface

- `src/routes/log.tsx` — `createFileRoute("/log")` exporting `Route`.
- `src/controllers/keymap.ts` — adds `{ keys: ["6"], description: "Log" }` mapping to `/log`.
- `routeTree.gen.ts` — regenerated; not hand-edited.
- `src/views/components/app-shell.tsx` — `__root.tsx` hint string updated to include `[6] log`.

## Internal design

```tsx
// src/routes/log.tsx
export const Route = createFileRoute("/log")({ component: Log });
function Log() {
  const model = useLogPanel();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
  }, []); // mount-only
  return <LogPanel model={model} />;
}
```

- `LogPanel` already owns its own modals; the route does not embed `ConfirmModal` directly.
- `__root.tsx` hint becomes `"[1] status · [2] about · [3] settings · [4] discover · [5] tracked · [6] log · [?] help · [q] quit"`.

## Dependencies

- `src/views/panels/log-panel.tsx`
- `src/controllers/log.controller.ts`
- `src/actors/repo.actor.ts`

## Tests

`src/routes/log.test.tsx` (lightweight)

- **Route renders without throwing when wired with a stub controller hook.**
- Achieved by rendering `<RouterProvider router={router} />` against a memory history `["/log"]` with a fake `Services` and asserting the panel's empty-state copy is in the frame.

`src/controllers/keymap.test.ts` (extend existing if present, else new)

- **Pressing `6` invokes `router.navigate({ to: "/log" })`.**

## Acceptance

- `bun run generate-routes` includes `/log` in `routeTree.gen.ts`.
- Pressing `6` from any other route navigates to `/log`.
- Visual: header shows `/log`; footer shows the new hint.

## Review

- Rewrites: none.
- Approval: pending Step 4 cross-spec consistency review.
