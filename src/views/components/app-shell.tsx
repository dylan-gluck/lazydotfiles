import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { useTheme } from "../theme";
import { AppHeader } from "./app-header";
import { HelpDrawer } from "./help-drawer";
import {
  type PanelBinding,
  useActivePanelBindings,
  useActivePanelLabel,
} from "./panel-bindings-context";

export interface AppShellProps {
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
        <Footer label={label} bindings={bindings} />
      )}
    </box>
  );
}

function noop(): void {}

function Footer({
  label,
  bindings,
}: {
  readonly label: string | null;
  readonly bindings: readonly PanelBinding[];
}): ReactNode {
  const t = useTheme();
  const items: readonly PanelBinding[] = [...bindings, HELP_HINT];
  return (
    <box flexDirection="row" paddingLeft={1} paddingRight={1}>
      {label !== null ? (
        <box backgroundColor={t.fg.focus} paddingLeft={1} paddingRight={1}>
          <text fg={t.bg.surface} attributes={TextAttributes.BOLD}>
            {label}
          </text>
        </box>
      ) : null}
      <box flexGrow={1} flexShrink={1} flexDirection="row" overflow="hidden" paddingLeft={2}>
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
    </box>
  );
}
