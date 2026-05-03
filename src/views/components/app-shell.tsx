import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { useTheme } from "../theme";
import { HelpDrawer } from "./help-drawer";
import {
  type PanelBinding,
  useActivePanelBindings,
  useActivePanelLabel,
} from "./panel-bindings-context";

export interface AppShellProps {
  readonly currentPath: string;
  readonly helpOpen?: boolean;
  readonly onCloseHelp?: () => void;
  readonly children: ReactNode;
}

const SEP = " · ";
const HELP_HINT: PanelBinding = { keys: "?", description: "more" };

/**
 * Top-level frame: route content fills available space; the bottom rail is
 * either a one-line footer (label chip + active-panel keybinds + `? more`) or,
 * when help is open, a multi-line drawer that pushes the body up. Panels
 * publish their label and bindings via {@link usePublishPanelLabel} and
 * {@link usePublishPanelBindings}.
 */
export function AppShell({
  currentPath,
  helpOpen,
  onCloseHelp,
  children,
}: AppShellProps): ReactNode {
  const t = useTheme();
  const bindings = useActivePanelBindings();
  const label = useActivePanelLabel();
  return (
    <box flexDirection="column" flexGrow={1} backgroundColor={t.bg.default}>
      <box flexGrow={1} overflow="hidden">
        {children}
      </box>
      {helpOpen === true ? (
        <HelpDrawer activeLabel={label} activeBindings={bindings} onClose={onCloseHelp ?? noop} />
      ) : (
        <Footer label={label} bindings={bindings} currentPath={currentPath} />
      )}
    </box>
  );
}

function noop(): void {}

function Footer({
  label,
  bindings,
  currentPath,
}: {
  readonly label: string | null;
  readonly bindings: readonly PanelBinding[];
  readonly currentPath: string;
}): ReactNode {
  const t = useTheme();
  const items: readonly PanelBinding[] = [...bindings, HELP_HINT];
  return (
    <box height={1} flexDirection="row" alignItems="center">
      {label !== null ? (
        <box backgroundColor={t.fg.focus} paddingLeft={1} paddingRight={1}>
          <text fg={t.bg.default} attributes={TextAttributes.BOLD}>
            {label}
          </text>
        </box>
      ) : null}
      <box flexGrow={1} flexShrink={1} flexDirection="row" overflow="hidden" paddingLeft={1}>
        {items.flatMap((b, i) => {
          const segs: ReactNode[] = [];
          if (i > 0) {
            segs.push(
              <text key={`sep-${i}`} fg={t.fg.subtle}>
                {SEP}
              </text>,
            );
          }
          segs.push(
            <text key={`k-${i}`} fg={t.fg.focus}>
              {b.keys}
            </text>,
          );
          segs.push(
            <text key={`d-${i}`} fg={t.fg.muted}>
              {` ${b.description}`}
            </text>,
          );
          return segs;
        })}
      </box>
      {currentPath.length > 0 ? <text fg={t.fg.subtle}>{`${currentPath} `}</text> : null}
    </box>
  );
}
