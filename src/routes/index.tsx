import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useHomePanel } from "../controllers/home.controller";
import { StatusPanel } from "../views/panels/status-panel";

export const Route = createFileRoute("/")({
  component: Status,
});

function Status() {
  const model = useHomePanel();
  const router = useRouter();
  return (
    <StatusPanel
      model={model}
      onViewLog={() => {
        void router.navigate({ to: "/logs" });
      }}
      onOpenFiles={() => {
        void router.navigate({ to: "/files" });
      }}
    />
  );
}
