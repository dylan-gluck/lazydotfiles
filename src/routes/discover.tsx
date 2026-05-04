import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { CONFIG_ACTOR_ID, type ConfigState } from "../actors/config.actor";
import { useActor } from "../actors/use-actor";
import { useDiscoveryPanel } from "../controllers/discovery.controller";
import { DiscoveryPanel } from "../views/panels/discovery-panel";

export const Route = createFileRoute("/discover")({
  component: Discover,
});

function Discover() {
  const model = useDiscoveryPanel();
  const config = useActor<ConfigState>(CONFIG_ACTOR_ID);
  useEffect(() => {
    if (model.status === "idle") model.rescan();
    // model.status / model.rescan are stable; we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const paths = config.state.config?.path;
  return (
    <DiscoveryPanel
      model={model}
      home={paths?.home}
      dotfiles={paths?.dotfiles}
      backupRoot={paths?.backup}
    />
  );
}
