import { createFileRoute } from "@tanstack/react-router";
import { useStatusPanel } from "../controllers/status.controller";
import { StatusPanel } from "../views/panels/status-panel";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const model = useStatusPanel();
  return <StatusPanel model={model} />;
}
