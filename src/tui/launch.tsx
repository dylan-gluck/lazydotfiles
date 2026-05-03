import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { CONFIG_ACTOR_ID } from "../actors/config.actor";
import type { ActorRuntime } from "../actors/runtime";
import { ActorRuntimeContext } from "../actors/use-actor";
import type { Services } from "../composition/services";
import { ServicesProvider } from "../composition/services-context";
import { routeTree } from "../routeTree.gen";
import { HelpOverlayProvider } from "../views/components/help-overlay-context";
import { InputFocusProvider } from "../views/components/input-focus-context";
import { PanelBindingsProvider } from "../views/components/panel-bindings-context";
import { BootstrapErrorPanel } from "../views/panels/bootstrap-error-panel";
import { ThemeProvider } from "../views/theme";

export interface LaunchTuiOptions {
  readonly services: Services;
  readonly actors: ActorRuntime<Services>;
}

export async function launchTui({ services, actors }: LaunchTuiOptions): Promise<number> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    context: { services, actors },
  });

  const outcome = await services.bootstrap.run();
  if (outcome.ok) {
    actors.get(CONFIG_ACTOR_ID).send({ kind: "load", payload: undefined });
    await router.load();
  }

  const renderer = await createCliRenderer({ exitOnCtrlC: true });

  function App() {
    return (
      <ThemeProvider mode="dark">
        <ServicesProvider services={services}>
          <ActorRuntimeContext.Provider value={actors as unknown as ActorRuntime<unknown>}>
            {outcome.ok ? (
              <HelpOverlayProvider>
                <InputFocusProvider>
                  <PanelBindingsProvider>
                    <RouterProvider router={router} />
                  </PanelBindingsProvider>
                </InputFocusProvider>
              </HelpOverlayProvider>
            ) : (
              <BootstrapErrorPanel error={outcome.error} />
            )}
          </ActorRuntimeContext.Provider>
        </ServicesProvider>
      </ThemeProvider>
    );
  }

  createRoot(renderer).render(<App />);

  return new Promise<number>((resolve) => {
    renderer.once("destroy", () => resolve(outcome.ok ? 0 : 2));
  });
}
