import { createFileRoute } from "@tanstack/react-router";
import { CONFIG_ACTOR_ID, type ConfigState } from "../actors/config.actor";
import { useActor } from "../actors/use-actor";
import { useStatusPanel } from "../controllers/status.controller";
import { StatusPanel } from "../views/panels/status-panel";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const model = useStatusPanel();
  const config = useActor<ConfigState>(CONFIG_ACTOR_ID);
  return <StatusPanel model={model} home={config.state.config?.path.home} />;
}
