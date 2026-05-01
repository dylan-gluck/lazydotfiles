import { TextAttributes } from "@opentui/core";
import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "../views/components/app-shell";
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

function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell
      title="lazydotfiles"
      currentPath={path}
      hint="[1] status · [2] about · [3] settings · [4] discover · [5] tracked · [6] log · [?] help · [q] quit"
    >
      <Outlet />
    </AppShell>
  );
}
