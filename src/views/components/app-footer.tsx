import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { type SyncActorState, SYNC_ACTOR_ID } from "../../actors/sync.actor";
import { useActorStateSafe } from "../../actors/use-actor";
import { useTheme } from "../theme";
import type { PanelBinding } from "./panel-bindings-context";

export interface AppFooterProps {
  /** View label chip (e.g. "status", "files", "logs"). */
  readonly label: string | null;
  /** Context-sensitive bindings rendered in the center slot. */
  readonly bindings: readonly PanelBinding[];
}

const SEP = " · ";
const HELP_HINT: PanelBinding = { keys: "?", description: "help" };

/**
 * Bottom-of-frame footer rendered globally inside {@link AppShell}. v2 layout:
 *
 *   [chip]   ↑/↓ select · enter details · u untrack · ? help     ↑0 ↓0
 *
 * Ahead/behind pulls live from the sync actor — this is the only place those
 * counters appear in the chrome.
 */
export function AppFooter({ label, bindings }: AppFooterProps): ReactNode {
  const t = useTheme();
  const sync = useActorStateSafe<SyncActorState>(SYNC_ACTOR_ID);
  const ahead = sync?.state.ahead ?? 0;
  const behind = sync?.state.behind ?? 0;
  const counterFg = ahead === 0 && behind === 0 ? t.fg.muted : t.fg.default;
  const items: readonly PanelBinding[] = [...bindings, HELP_HINT];
  return (
    <box
      flexShrink={0}
      flexDirection="row"
      paddingLeft={1}
      paddingRight={1}
      justifyContent="space-between"
      border={["top"]}
      borderColor={t.fg.muted}
    >
      {label !== null ? (
        <box backgroundColor={t.fg.focus} paddingLeft={1} paddingRight={1} flexShrink={0}>
          <text fg={t.bg.surface} attributes={TextAttributes.BOLD}>
            {label}
          </text>
        </box>
      ) : (
        <box flexShrink={0} />
      )}
      <box
        flexGrow={1}
        flexShrink={1}
        flexDirection="row"
        overflow="hidden"
        paddingLeft={2}
        paddingRight={2}
      >
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
            <text key={`k-${i}`} fg={t.fg.default}>
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
      <box flexShrink={0}>
        <text fg={counterFg} attributes={TextAttributes.BOLD}>{`↑${ahead} ↓${behind}`}</text>
      </box>
    </box>
  );
}
