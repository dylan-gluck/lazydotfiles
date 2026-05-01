# Spec: Rewrite `src/index.tsx` composition root

- Source bean: `ldf-payt`
- Parent epic: `ldf-j9pe`
- References: ADR-002 §4.1, CONSTITUTION §2.4, §6

## Goal

Replace the bootstrap `index.tsx` with a single composition root that wires services + actors + theme + global keys, owns the renderer lifecycle, and disposes actors on unmount.

## Public surface

```ts
// src/composition/services.ts
export interface Services {
  /* empty for now; later phases extend */
}
export function wireServices(deps: { home: string }): Services;

// src/composition/actors.ts
import type { ActorRuntime } from "../actors/runtime";
import type { Services } from "./services";
export function wireActors(services: Services): ActorRuntime<Services>;
```

```tsx
// src/index.tsx
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { ActorRuntimeContext } from "./actors/use-actor";
import { wireActors } from "./composition/actors";
import { wireServices } from "./composition/services";
import { routeTree } from "./routeTree.gen";
import { GlobalKeys } from "./views/components/global-keys";
import { ThemeProvider } from "./views/theme";

const services = wireServices({ home: process.env["HOME"] ?? "" });
const actors = wireActors(services);

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
  context: { services, actors },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

await router.load();

const renderer = await createCliRenderer({ exitOnCtrlC: true });

function App() {
  useEffect(() => () => actors.dispose(), []);
  return (
    <ThemeProvider mode="dark">
      <ActorRuntimeContext.Provider value={actors}>
        <GlobalKeys />
        <RouterProvider router={router} />
      </ActorRuntimeContext.Provider>
    </ThemeProvider>
  );
}

createRoot(renderer).render(<App />);
```

## Internal design

- `wireServices` returns `{}` for now; later phases extend.
- `wireActors` calls `createActorRuntime({ services })` and returns the runtime; later phases register actors here.
- The `App` component's `useEffect` cleanup calls `actors.dispose()` on unmount, satisfying CONSTITUTION §2.4 (subscriptions torn down).
- The router context carries `services` + `actors` for future loaders.
- No `process.exit` anywhere. Quit happens via `renderer.destroy()` from `globalKeymap["q"]`.

## Dependencies

- All other specs in this phase.

## Tests

- No new unit tests for this file — it is a composition root. Verified by smoke test: `bun dev` boots and `q` exits cleanly. (Smoke test is part of phase validation, Step 6.)

## Acceptance

- `src/index.tsx` matches the surface above.
- `bun dev` starts and `q` exits with code 0.
- The tree boots inside `<ThemeProvider>` and `<ActorRuntimeContext.Provider>`.

## Route migration (mandated by ADR-002 §4.2)

The root layout (`src/routes/__root.tsx`) **MUST** drop its inline `useKeyboard` and footer; the `<AppShell>` from this phase replaces both. The three demo routes (`/`, `/about`, `/settings`) keep their existing tiny views — controller hooks land later phases.
