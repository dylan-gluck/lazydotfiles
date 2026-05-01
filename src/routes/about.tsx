import { TextAttributes } from "@opentui/core";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "../views/theme";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  const t = useTheme();
  return (
    <box flexDirection="column" flexGrow={1}>
      <text fg={t.fg.accent} attributes={TextAttributes.BOLD} marginBottom={1}>
        About
      </text>
      <text fg={t.fg.default}>
        lazydotfiles — a terminal app for discovering, tracking, versioning, and syncing dotfiles.
      </text>
    </box>
  );
}
