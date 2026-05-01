import { TextAttributes } from "@opentui/core";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "../views/theme";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  const t = useTheme();
  return (
    <box flexDirection="column" flexGrow={1}>
      <text fg={t.fg.accent} attributes={TextAttributes.BOLD} marginBottom={1}>
        Settings
      </text>
      <box flexDirection="column" marginBottom={1}>
        <text fg={t.fg.default}>Theme: Dark</text>
      </box>
      <text fg={t.fg.dim} attributes={TextAttributes.DIM}>
        Settings panel arrives in a later phase.
      </text>
    </box>
  );
}
