import { createFileRoute } from "@tanstack/react-router";
import { useSyncPanel } from "../controllers/sync.controller";
import { SyncPanel } from "../views/panels/sync-panel";

export const Route = createFileRoute("/sync")({ component: Sync });

function Sync() {
  const model = useSyncPanel();
  return <SyncPanel model={model} />;
}
