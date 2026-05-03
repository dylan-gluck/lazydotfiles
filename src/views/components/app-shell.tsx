import type { ReactNode } from "react";
import { useTheme } from "../theme";
import { useActivePanelBindings } from "./panel-bindings-context";

export interface AppShellProps {
  readonly currentPath: string;
  readonly children: ReactNode;
}

/**
 * Top-level frame: route content fills the available space; a single
 * height={1} footer at the bottom shows the active panel's keys plus a
 * `?` hint for the full keymap. Panels publish their bindings via
 * {@link usePublishPanelBindings}.
 */
export function AppShell({ currentPath, children }: AppShellProps): ReactNode {
  const t = useTheme();
  const bindings = useActivePanelBindings();
  const panelLine = bindings
    .map((b) => `${b.keys} ${b.description}`)
    .join("  ·  ");
  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={t.bg.default}>
      <box flexGrow={1}>{children}</box>
      <box
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={t.fg.dim}>{panelLine}</text>
        <text fg={t.fg.dim}>{`? help  ·  ${currentPath}`}</text>
      </box>
    </box>
  );
}
