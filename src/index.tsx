import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { ActorRuntimeContext } from "./actors/use-actor";
import type { ActorRuntime } from "./actors/runtime";
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
      <ActorRuntimeContext.Provider value={actors as unknown as ActorRuntime<unknown>}>
        <GlobalKeys />
        <RouterProvider router={router} />
      </ActorRuntimeContext.Provider>
    </ThemeProvider>
  );
}

createRoot(renderer).render(<App />);
