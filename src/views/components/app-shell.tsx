import type { ReactNode } from "react";
import { useTheme } from "../theme";
import { AppFooter } from "./app-footer";
import { AppHeader } from "./app-header";
import { HelpDrawer } from "./help-drawer";
import { useActivePanelBindings, useActivePanelLabel } from "./panel-bindings-context";

export interface AppShellProps {
  readonly helpOpen?: boolean;
  readonly onCloseHelp?: () => void;
  readonly children: ReactNode;
}

/**
 * Top-level frame: global header at the top, route content fills available
 * space, global footer at the bottom. When help is open, the help drawer
 * replaces the footer and pushes the body up.
 */
export function AppShell({ helpOpen, onCloseHelp, children }: AppShellProps): ReactNode {
  const t = useTheme();
  const bindings = useActivePanelBindings();
  const label = useActivePanelLabel();
  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={t.bg.default}>
      <AppHeader />
      <box flexGrow={1} flexShrink={1} overflow="hidden">
        {children}
      </box>
      {helpOpen === true ? (
        <HelpDrawer activeLabel={label} activeBindings={bindings} onClose={onCloseHelp ?? noop} />
      ) : (
        <AppFooter label={label} bindings={bindings} />
      )}
    </box>
  );
}

function noop(): void {}
