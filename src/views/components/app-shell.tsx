import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { useTheme } from "../theme";

export interface AppShellProps {
  readonly title: string;
  readonly currentPath: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

export function AppShell({ title, currentPath, hint, children }: AppShellProps): ReactNode {
  const t = useTheme();
  const footer = hint ?? "[?] help · [q] quit";
  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={t.bg.default}>
      <box
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
        borderStyle={t.border.default}
        border={["bottom"]}
      >
        <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
          {title}
        </text>
        <text fg={t.fg.dim}>{currentPath}</text>
      </box>
      <box flexGrow={1} padding={t.space.sm}>
        {children}
      </box>
      <box
        height={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={t.fg.dim}>{currentPath}</text>
        <text fg={t.fg.dim}>{footer}</text>
      </box>
    </box>
  );
}
