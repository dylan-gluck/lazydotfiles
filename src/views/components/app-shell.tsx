import type { ReactNode } from "react";
import { useTheme } from "../theme";
import { AppFooter } from "./app-footer";
import { AppHeader } from "./app-header";
import { HelpDrawer } from "./help-drawer";
import {
  useActivePanelBindings,
  useActivePanelExtras,
  useActivePanelLabel,
} from "./panel-bindings-context";

export interface AppShellProps {
  readonly helpOpen?: boolean;
  readonly onCloseHelp?: () => void;
  readonly children: ReactNode;
}

/**
 * Top-level frame: global header, route content, global footer. When help is
 * open, the help drawer replaces the footer.
 */
export function AppShell({ helpOpen, onCloseHelp, children }: AppShellProps): ReactNode {
  const t = useTheme();
  const bindings = useActivePanelBindings();
  const extras = useActivePanelExtras();
  const label = useActivePanelLabel();
  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={t.bg.default}>
      <AppHeader />
      <box flexGrow={1} flexShrink={1} overflow="hidden">
        {children}
      </box>
      {helpOpen === true ? (
        <HelpDrawer
          activeLabel={label}
          activeBindings={bindings}
          activeExtras={extras}
          onClose={onCloseHelp ?? noop}
        />
      ) : (
        <AppFooter label={label} bindings={bindings} />
      )}
    </box>
  );
}

function noop(): void {}
