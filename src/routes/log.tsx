import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useLogPanel } from "../controllers/log.controller";
import { LogPanel } from "../views/panels/log-panel";

export const Route = createFileRoute("/log")({ component: Log });

function Log() {
  const model = useLogPanel();
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    // mount-only refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <LogPanel model={model} />;
}
