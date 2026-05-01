import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import type { Binding } from "../../controllers/keymap";
import { useTheme } from "../theme";

export interface HelpOverlayProps {
  readonly bindings: readonly Binding[];
  onClose(): void;
}

export function HelpOverlay({ bindings, onClose }: HelpOverlayProps): ReactNode {
  const t = useTheme();
  useKeyboard((event) => {
    if (event.name === "escape" || event.name === "?") onClose();
  });
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center" backgroundColor={t.bg.default}>
      <box
        backgroundColor={t.bg.elevated}
        borderStyle={t.border.emphasis}
        flexDirection="column"
        padding={t.space.md}
        gap={t.space.sm}
      >
        <text fg={t.fg.accent} attributes={TextAttributes.BOLD}>
          Keybindings
        </text>
        <box flexDirection="row" gap={t.space.lg}>
          <box flexDirection="column" gap={t.space.xs}>
            {bindings.map((b) => (
              <text key={b.keys.join(",")} fg={t.fg.accent}>
                {b.keys.join(", ")}
              </text>
            ))}
          </box>
          <box flexDirection="column" gap={t.space.xs}>
            {bindings.map((b) => (
              <text key={b.keys.join(",")} fg={t.fg.default}>
                {b.description}
              </text>
            ))}
          </box>
        </box>
        <text fg={t.fg.dim}>esc / ? to close</text>
      </box>
    </box>
  );
}
