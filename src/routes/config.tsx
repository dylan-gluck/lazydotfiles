import { createFileRoute } from "@tanstack/react-router";
import { useConfigPanel } from "../controllers/config.controller";
import { ConfigPanel } from "../views/panels/config-panel";

export const Route = createFileRoute("/config")({ component: Config });

function Config() {
  const model = useConfigPanel();
  return <ConfigPanel model={model} />;
}
