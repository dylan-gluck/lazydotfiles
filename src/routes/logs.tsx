import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useLogPanel } from "../controllers/log.controller";
import { yankToClipboard } from "../lib/clipboard";
import { LogsPanel } from "../views/panels/logs-panel";

export const Route = createFileRoute("/logs")({ component: Logs });

function Logs() {
  const model = useLogPanel();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <LogsPanel model={model} onYank={(text) => void yankToClipboard(text)} />;
}
