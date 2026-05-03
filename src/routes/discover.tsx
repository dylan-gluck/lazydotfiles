import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useDiscoveryPanel } from "../controllers/discovery.controller";
import { DiscoveryPanel } from "../views/panels/discovery-panel";

export const Route = createFileRoute("/discover")({
  component: Discover,
});

function Discover() {
  const model = useDiscoveryPanel();
  useEffect(() => {
    if (model.status === "idle") model.rescan();
    // model.status / model.rescan are stable; we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <DiscoveryPanel model={model} />;
}
