import type { ReactNode } from "react";
import { globalKeymap } from "../../controllers/keymap";
import { useTheme } from "../theme";

export interface AppShellProps {
  readonly currentPath: string;
  readonly children: ReactNode;
}

/**
 * Top-level frame: route content fills the available space; a single
 * height={1} footer at the bottom advertises the global keymap. No header.
 * Each panel may render its own status/toast line above this footer.
 */
export function AppShell({ currentPath, children }: AppShellProps): ReactNode {
  const t = useTheme();
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
        <text fg={t.fg.dim}>
          {globalKeymap
            .map((b) => `[${b.keys.join("/")}] ${b.description.toLowerCase()}`)
            .join("  ")}
        </text>
        <text fg={t.fg.dim}>{currentPath}</text>
      </box>
    </box>
  );
}
