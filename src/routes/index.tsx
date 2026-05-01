import { TextAttributes } from "@opentui/core";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "../views/theme";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const t = useTheme();
  return (
    <box alignItems="center" justifyContent="center" flexGrow={1}>
      <box justifyContent="center" alignItems="flex-end">
        <ascii-font font="tiny" text="lazydotfiles" />
        <text fg={t.fg.dim} attributes={TextAttributes.DIM}>
          discover · track · sync · restore
        </text>
      </box>
    </box>
  );
}
