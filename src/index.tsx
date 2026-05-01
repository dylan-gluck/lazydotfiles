import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { CONFIG_ACTOR_ID } from "./actors/config.actor";
import type { ActorRuntime } from "./actors/runtime";
import { ActorRuntimeContext } from "./actors/use-actor";
import { wireActors } from "./composition/actors";
import { wireServices } from "./composition/services";
import { ServicesProvider } from "./composition/services-context";
import { routeTree } from "./routeTree.gen";
import { GlobalKeys } from "./views/components/global-keys";
import { BootstrapErrorPanel } from "./views/panels/bootstrap-error-panel";
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

const outcome = await services.bootstrap.run();
if (outcome.ok) {
  actors.get(CONFIG_ACTOR_ID).send({ kind: "load", payload: undefined });
  await router.load();
}

const renderer = await createCliRenderer({ exitOnCtrlC: true });

function App() {
  useEffect(() => () => actors.dispose(), []);
  return (
    <ThemeProvider mode="dark">
      <ServicesProvider services={services}>
        <ActorRuntimeContext.Provider value={actors as unknown as ActorRuntime<unknown>}>
          {outcome.ok ? (
            <>
              <GlobalKeys />
              <RouterProvider router={router} />
            </>
          ) : (
            <BootstrapErrorPanel error={outcome.error} />
          )}
        </ActorRuntimeContext.Provider>
      </ServicesProvider>
    </ThemeProvider>
  );
}

createRoot(renderer).render(<App />);
