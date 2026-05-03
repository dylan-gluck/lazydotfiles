import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { REPO_ACTOR_ID, type RepoMessage } from "../actors/repo.actor";
import { useActor } from "../actors/use-actor";
import { useLogPanel } from "../controllers/log.controller";
import { LogPanel } from "../views/panels/log-panel";

interface LogSearch {
  readonly file?: string;
}

export const Route = createFileRoute("/log")({
  component: Log,
  validateSearch: (search: Record<string, unknown>): LogSearch => {
    const file = search["file"];
    return typeof file === "string" && file.length > 0 ? { file } : {};
  },
});

function Log() {
  const { file } = Route.useSearch();
  const model = useLogPanel({ file });
  const repo = useActor<unknown, RepoMessage>(REPO_ACTOR_ID);
  useEffect(() => {
    repo.send({ kind: "refresh", payload: undefined });
    // mount-only refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <LogPanel model={model} />;
}
