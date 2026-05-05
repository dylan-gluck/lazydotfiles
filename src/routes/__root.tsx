import { TextAttributes } from "@opentui/core";
import { createRootRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../views/components/app-shell";
import { GlobalKeys } from "../views/components/global-keys";
import { useHelpOverlay } from "../views/components/help-overlay-context";
import { useTheme } from "../views/theme";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function NotFound() {
  const t = useTheme();
  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box flexDirection="column" alignItems="center">
        <text fg={t.fg.danger} attributes={TextAttributes.BOLD}>
          Screen Not Found
        </text>
        <text fg={t.fg.dim}>Press [1] to go to status</text>
      </box>
    </box>
  );
}

/**
 * Bridges TanStack Router's history into the OpenTUI React reconciler.
 *
 * The router's internal `Transitioner` relies on `useSyncExternalStore`
 * subscriptions to drive `router.load()` and to re-render `<Outlet />` after
 * a navigation. In the OpenTUI React reconciler, those out-of-React store
 * notifications do not reliably re-render — so navigation mutates history
 * without ever swapping the rendered route.
 *
 * We bridge it manually:
 *   1. subscribe to `router.history` (sync, fires inside `router.navigate`),
 *   2. drive `router.load()` ourselves (what `Transitioner` would do),
 *   3. bump local state so React schedules a real re-render,
 *   4. key `<Outlet />` by pathname so it remounts and re-resolves matches.
 */
function RootLayout() {
  const router = useRouter();
  const [, bumpTick] = useState(0);
  const [path, setPath] = useState(router.state.location.pathname);
  useEffect(() => {
    return router.history.subscribe(() => {
      router.load().finally(() => {
        setPath(router.state.location.pathname);
        bumpTick((t) => t + 1);
      });
    });
  }, [router]);
  const help = useHelpOverlay();
  return (
    <>
      <GlobalKeys />
      <AppShell helpOpen={help.open} onCloseHelp={help.close}>
        <Outlet key={path} />
      </AppShell>
    </>
  );
}
